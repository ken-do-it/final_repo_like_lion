from rest_framework import serializers
from .models import Shortform, ShortformComment


class ShortformSerializer(serializers.ModelSerializer):
    # 업로드용 파일 필드 (write-only)
    video_file = serializers.FileField(write_only=True, required=False)
    # 번역 결과를 담을 읽기 전용 필드
    title_translated = serializers.CharField(read_only=True)
    content_translated = serializers.CharField(read_only=True)
    location_translated = serializers.CharField(read_only=True)
    
    # 작성자 정보
    nickname = serializers.CharField(source='user.nickname', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    profile_image_url = serializers.CharField(source='user.profile_image_url', read_only=True)

    # 현재 사용자의 좋아요 여부
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Shortform
        fields = [
            'id',
            'user',
            'video_url',
            'thumbnail_url',
            'title',
            'content',
            'location',
            'visibility',
            'source_lang',
            'total_likes',
            'is_liked', # 추가됨
            'total_comments',
            'total_views',
            'duration',
            'width',
            'height',
            'file_size',
            'created_at',
            'updated_at',
            'video_file',  # write-only
            'title_translated',
            'content_translated',
            'location_translated',
            'nickname', 
            'username',
            'profile_image_url',
        ]
        read_only_fields = [
            'id',
            'user',
            'video_url',
            'thumbnail_url',
            'total_likes',
            'total_comments',
            'total_views',
            'duration',
            'width',
            'height',
            'file_size',
            'created_at',
            'updated_at',
            'title_translated',
            'content_translated',
            'nickname', 
            'username',
            'profile_image_url',
        ]

    def validate(self, attrs):
        # 생성(create) 시에만 비디오 파일 필수 체크
        if not self.instance and not attrs.get('video_file'):
            raise serializers.ValidationError({"video_file": "This field is required."})
        return attrs

    def create(self, validated_data):
        # video_file은 실제 저장 시 소비되므로 직렬화 대상에서 제거
        validated_data.pop('video_file', None)
        return super().create(validated_data)

    def get_is_liked(self, obj):
        # [성능] 주석 처리된(annotated) 값이 있으면 사용
        if hasattr(obj, 'is_liked_val'):
            return obj.is_liked_val

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # ShortformLike 모델을 여기서 import하여 순환 참조 방지
            from .models import ShortformLike
            return ShortformLike.objects.filter(shortform=obj, user=request.user).exists()
        return False


class ShortformCommentSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source='user.nickname', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    profile_image_url = serializers.CharField(source='user.profile_image_url', read_only=True)
    
    class Meta:
        model = ShortformComment
        fields = [
            'id',
            'shortform',
            'user',
            'nickname',  # Added nickname
            'username',
            'profile_image_url', # Added profile_image_url
            'content',
            'source_lang',
            'total_likes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'shortform',
            'user',
            'nickname',
            'username',
            'profile_image_url',
            'total_likes',
            'created_at',
            'updated_at',
        ]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("content is required.")
        return value
