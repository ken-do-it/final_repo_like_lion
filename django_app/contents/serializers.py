from rest_framework import serializers
from .models import Shortform, ShortformComment


class ShortformSerializer(serializers.ModelSerializer):
    # 업로드용 파일 필드 (write-only). UI에 파일 선택기가 보이도록 추가.
    video_file = serializers.FileField(write_only=True, required=True)

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
        ]

    def validate(self, attrs):
        if not attrs.get('video_file'):
            raise serializers.ValidationError({"video_file": "This field is required."})
        return attrs

    def create(self, validated_data):
        # video_file은 모델 필드가 아니므로 제거하고 나머지만 모델에 저장
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
