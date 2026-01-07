from rest_framework import serializers
from .models import TravelPlan, PlanDetail, PlanDetailImage
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
    
    class Meta:
        model = PlanDetail
        fields = [
            'id', 'plan', 'place', 'place_name', 'place_address',
            'date', 'description', 'order_index', 'images', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TravelPlanDetailSerializer(serializers.ModelSerializer):
    """일정 상세 조회용 Serializer (날짜별 장소 포함)"""
    details = PlanDetailSerializer(many=True, read_only=True)
    user_nickname = serializers.CharField(source='user.nickname', read_only=True)
    
    class Meta:
        model = TravelPlan
        fields = [
            'id', 'user', 'user_nickname', 'title', 'description', 
            'plan_type', 'ai_prompt', 'start_date', 'end_date', 
            'is_public', 'details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class TravelPlanCreateSerializer(serializers.ModelSerializer):
    """여행 일정 생성용 (장소 제외)"""
    
    class Meta:
        model = TravelPlan
        fields = [
            'title', 'description', 'plan_type', 'ai_prompt',
            'start_date', 'end_date', 'is_public'
        ]




class PlanDetailCreateSerializer(serializers.ModelSerializer):
    """날짜별 장소 생성용"""
    
    images = PlanDetailImageCreateSerializer(many=True, required=False)
    
    class Meta:
        model = PlanDetail
        fields = ['place', 'date', 'description', 'order_index', 'images']
    
    def create(self, validated_data):
        # images 데이터 분리
        images_data = validated_data.pop('images', [])
        
        # PlanDetail 생성
        plan_detail = PlanDetail.objects.create(**validated_data)
        
        # PlanDetailImage 생성
        for image_data in images_data:
            PlanDetailImage.objects.create(
                detail=plan_detail,
                **image_data
            )
        
        return plan_detail


class PlanDetailUpdateSerializer(serializers.ModelSerializer):
    """날짜별 장소 조회용 (이미지 포함)"""
    
    images = PlanDetailImageSerializer(many=True, read_only=True)
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_address = serializers.CharField(source='place.address', read_only=True)
    
    class Meta:
        model = PlanDetail
        fields = [
            'id', 'place', 'place_name', 'place_address',
            'date', 'description', 'order_index', 'images', 'created_at'
        ]

class TravelPlanListSerializer(serializers.ModelSerializer):
    """여행 일정 목록 조회용 (간단 정보만)"""
    
    user_nickname = serializers.CharField(source='user.nickname', read_only=True)
    detail_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelPlan
        fields = [
            'id', 'user', 'user_nickname', 'title', 'description',
            'plan_type', 'start_date', 'end_date', 'is_public',
            'detail_count', 'created_at', 'updated_at'
        ]
    
    def get_detail_count(self, obj)->int:
        """일정에 포함된 장소 개수"""
        return obj.details.count()


class TravelPlanUpdateSerializer(serializers.ModelSerializer):
    """여행 일정 수정용"""
    
    class Meta:
        model = TravelPlan
        fields = [
            'title', 'description', 'plan_type', 'ai_prompt',
            'start_date', 'end_date', 'is_public'
        ]

class PlanDetailEditSerializer(serializers.ModelSerializer):
    """장소 수정용 (이미지 제외)"""
    
    class Meta:
        model = PlanDetail
        fields = ['place', 'date', 'description', 'order_index']
    
def validate(self, data):
    """날짜 유효성 검사"""
    start_date = data.get('start_date')
    end_date = data.get('end_date')
        
    # 인스턴스가 있으면 (수정 시) 기존 값 사용
    if self.instance:
        start_date = start_date or self.instance.start_date
        end_date = end_date or self.instance.end_date
        
    if start_date and end_date and start_date > end_date:
        raise serializers.ValidationError(
            "종료 날짜는 시작 날짜보다 늦어야 합니다."
        )
        
    return data