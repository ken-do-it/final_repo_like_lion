from rest_framework import serializers
from .models import Shortform, ShortformComment


class ShortformSerializer(serializers.ModelSerializer):
    # 업로드용 파일 필드 (write-only)
    video_file = serializers.FileField(write_only=True, required=True)
    # 번역 결과를 담을 읽기 전용 필드
    title_translated = serializers.CharField(read_only=True)
    content_translated = serializers.CharField(read_only=True)

    class Meta:
        model = Shortform
        fields = [
            'id',
            'user',
            'video_url',
            'thumbnail_url',
            'title',
            'content',
            'visibility',
            'source_lang',
            'total_likes',
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


class ShortformCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShortformComment
        fields = [
            'id',
            'shortform',
            'user',
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
            'total_likes',
            'created_at',
            'updated_at',
        ]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("content is required.")
        return value
