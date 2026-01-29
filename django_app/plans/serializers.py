from rest_framework import serializers
from .models import TravelPlan, PlanDetail, PlanDetailImage, AITravelRequest, PlanLike, PlanComment
from places.models import Place

class PlanDetailImageCreateSerializer(serializers.ModelSerializer):
    """이미지 생성용"""
    
    class Meta:
        model = PlanDetailImage
        fields = ['image_file', 'order_index']


class PlanDetailImageSerializer(serializers.ModelSerializer):
    """이미지 조회용"""
    
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = PlanDetailImage
        fields = ['id', 'image_url', 'image_file' , 'order_index', 'created_at']
    
    def get_image_url(self, obj)->str:
        """파일 URL 반환"""
        request = self.context.get('request')
        if obj.image_file:
            if request:
                return request.build_absolute_uri(obj.image_file.url)
            return obj.image_file.url
        return None



class PlanDetailSerializer(serializers.ModelSerializer):
    """일정 상세 Serializer"""
    images = PlanDetailImageSerializer(many=True, read_only=True)
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_address = serializers.CharField(source='place.address', read_only=True)
    place_api_id = serializers.CharField(source='place.place_api_id', read_only=True)
    place_latitude = serializers.DecimalField(source='place.latitude', max_digits=10, decimal_places=7, read_only=True)
    place_longitude = serializers.DecimalField(source='place.longitude', max_digits=10, decimal_places=7, read_only=True)

    class Meta:
        model = PlanDetail
        fields = [
            'id', 'plan', 'place', 'place_name', 'place_address', 'place_api_id',
            'place_latitude', 'place_longitude',
            'date', 'description', 'order_index', 'images', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TravelPlanDetailSerializer(serializers.ModelSerializer):
    """일정 상세 조회용 Serializer (날짜별 장소 포함)"""
    details = PlanDetailSerializer(many=True, read_only=True)
    user_nickname = serializers.CharField(source='user.nickname', read_only=True)
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = TravelPlan
        fields = [
            'id', 'user', 'user_nickname', 'title', 'description',
            'plan_type', 'ai_prompt', 'start_date', 'end_date',
            'is_public', 'details', 'like_count', 'comment_count', 'is_liked',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_like_count(self, obj)->int:
        """좋아요 개수"""
        return obj.likes.count()

    def get_comment_count(self, obj)->int:
        """댓글 개수"""
        return obj.comments.count()

    def get_is_liked(self, obj)->bool:
        """현재 사용자가 좋아요 했는지 여부"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False


class TravelPlanCreateSerializer(serializers.ModelSerializer):
    """여행 일정 생성용 (장소 제외)"""
    
    class Meta:
        model = TravelPlan
        fields = [
            'title', 'description', 'plan_type', 'ai_prompt',
            'start_date', 'end_date', 'is_public'
        ]




class PlanDetailCreateSerializer(serializers.ModelSerializer):
    """날짜별 장소 생성/수정용"""

    place_name = serializers.CharField(
        required=False,
        write_only=True,
        help_text="장소 이름으로 검색 (예: '경복궁', 'N Seoul Tower'). place와 place_name 중 하나만 제공"
    )
    place = serializers.PrimaryKeyRelatedField(
        queryset=Place.objects.all(),
        required=False,
        allow_null=True,
        help_text="기존 장소 ID (place_name과 함께 사용 불가)"
    )
    date = serializers.DateField(
        required=False,
        help_text="방문 날짜 (YYYY-MM-DD)"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="메모"
    )
    order_index = serializers.IntegerField(
        required=False,
        default=0,
        help_text="순서"
    )

    class Meta:
        model = PlanDetail
        fields = ['place', 'place_name', 'date', 'description', 'order_index']
    
    def validate(self, data):
        """place와 place_name 검증"""
        place = data.get('place')
        place_name = data.get('place_name')
        date = data.get('date')

        # 생성 시 검증
        if not self.instance:
            # place 또는 place_name 중 하나는 필수
            if not place and not place_name:
                raise serializers.ValidationError({
                    "place": "place 또는 place_name 중 하나는 반드시 제공해야 합니다.",
                    "place_name": "place 또는 place_name 중 하나는 반드시 제공해야 합니다."
                })

            # date는 생성 시 필수
            if not date:
                raise serializers.ValidationError({
                    "date": "날짜는 필수입니다."
                })

        # 둘 다 제공하면 안 됨 (생성/수정 공통)
        if place and place_name:
            raise serializers.ValidationError({
                "place": "place와 place_name을 동시에 제공할 수 없습니다.",
                "place_name": "place와 place_name을 동시에 제공할 수 없습니다."
            })

        return data

    def create(self, validated_data):
        # place_name은 views.py에서 처리하므로 제거
        validated_data.pop('place_name', None)

        # PlanDetail 생성
        plan_detail = PlanDetail.objects.create(**validated_data)

        return plan_detail


class PlanDetailUpdateSerializer(serializers.ModelSerializer):
    """날짜별 장소 조회용 (이미지 포함)"""

    images = PlanDetailImageSerializer(many=True, read_only=True)
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_address = serializers.CharField(source='place.address', read_only=True)
    place_api_id = serializers.CharField(source='place.place_api_id', read_only=True)
    place_latitude = serializers.DecimalField(source='place.latitude', max_digits=10, decimal_places=7, read_only=True)
    place_longitude = serializers.DecimalField(source='place.longitude', max_digits=10, decimal_places=7, read_only=True)

    class Meta:
        model = PlanDetail
        fields = [
            'id', 'plan', 'place', 'place_name', 'place_address', 'place_api_id',
            'place_latitude', 'place_longitude',
            'date', 'description', 'order_index', 'images', 'created_at'
        ]

class TravelPlanListSerializer(serializers.ModelSerializer):
    """여행 일정 목록 조회용 (간단 정보만)"""

    user_nickname = serializers.CharField(source='user.nickname', read_only=True)
    detail_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = TravelPlan
        fields = [
            'id', 'user', 'user_nickname', 'title', 'description',
            'plan_type', 'start_date', 'end_date', 'is_public',
            'detail_count', 'like_count', 'comment_count', 'created_at', 'updated_at'
        ]

    def get_detail_count(self, obj)->int:
        """일정에 포함된 장소 개수"""
        return obj.details.count()

    def get_like_count(self, obj)->int:
        """좋아요 개수"""
        return obj.likes.count()

    def get_comment_count(self, obj)->int:
        """댓글 개수"""
        return obj.comments.count()


class TravelPlanUpdateSerializer(serializers.ModelSerializer):
    """여행 일정 수정용"""

    class Meta:
        model = TravelPlan
        fields = [
            'title', 'description', 'plan_type', 'ai_prompt',
            'start_date', 'end_date', 'is_public'
        ]


class PlanCommentSerializer(serializers.ModelSerializer):
    """댓글 조회용"""
    user_nickname = serializers.CharField(source='user.nickname', read_only=True)

    class Meta:
        model = PlanComment
        fields = ['id', 'plan', 'user', 'user_nickname', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'plan', 'user', 'created_at', 'updated_at']


class PlanCommentCreateSerializer(serializers.ModelSerializer):
    """댓글 생성용"""

    class Meta:
        model = PlanComment
        fields = ['content']


class PlanLikeSerializer(serializers.ModelSerializer):
    """좋아요 조회용"""

    class Meta:
        model = PlanLike
        fields = ['id', 'plan', 'user', 'created_at']
        read_only_fields = ['id', 'plan', 'user', 'created_at']


class AITravelRequestSerializer(serializers.ModelSerializer):
    """AI 여행 추천 요청 생성용"""

    class Meta:
        model = AITravelRequest
        fields = [
            'destination', 'start_date', 'end_date',
            'travel_style', 'companions', 'additional_request'
        ]

    def validate(self, data):
        """날짜 및 인원 검증"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if start_date and end_date:
            if start_date >= end_date:
                raise serializers.ValidationError({
                    'end_date': '종료일은 시작일보다 이후여야 합니다.'
                })

            duration = (end_date - start_date).days + 1
            if duration > 30:
                raise serializers.ValidationError({
                    'end_date': '여행 기간은 최대 30일까지 가능합니다.'
                })

        companions = data.get('companions', 1)
        if companions < 1:
            raise serializers.ValidationError({
                'companions': '동행 인원은 최소 1명 이상이어야 합니다.'
            })

        return data


class AITravelRequestDetailSerializer(serializers.ModelSerializer):
    """AI 여행 추천 요청 조회용"""

    destination_display = serializers.CharField(source='get_destination_display', read_only=True)
    travel_style_display = serializers.CharField(source='get_travel_style_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    duration_days = serializers.IntegerField(read_only=True)
    created_plan_detail = TravelPlanDetailSerializer(source='created_plan', read_only=True)

    class Meta:
        model = AITravelRequest
        fields = [
            'id', 'user', 'destination', 'destination_display',
            'start_date', 'end_date', 'duration_days',
            'travel_style', 'travel_style_display',
            'companions', 'additional_request',
            'status', 'status_display', 'error_message',
            'ai_response', 'created_plan', 'created_plan_detail',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'status', 'error_message',
            'ai_response', 'created_plan', 'created_at', 'updated_at'
        ]

