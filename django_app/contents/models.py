from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Shortform(models.Model):
    """
    [1] 숏폼 영상 (shortforms)
    - 엑셀 파일의 'Shortforms' 테이블 반영
    - 카운터 캐시(total_...) 포함
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shortforms')
    
    video_url = models.CharField(max_length=500, help_text="영상 파일 URL")
    thumbnail_url = models.CharField(max_length=500, blank=True, null=True, help_text="썸네일 이미지 URL")
    
    title = models.TextField(help_text="영상 제목")
    content = models.TextField(blank=True, null=True, help_text="영상 설명/내용")
    
    # 공개 범위 (엑셀: PUBLIC/FRIENDS/PRIVATE)
    class Visibility(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public'
        FRIENDS = 'FRIENDS', 'Friends Only'
        PRIVATE = 'PRIVATE', 'Private'
        
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PUBLIC)
    
    # 원본 언어 (번역 기준점)
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")
    
    # 성능 최적화용 카운터 (DB 부하 줄이기용)
    total_likes = models.IntegerField(default=0)
    total_comments = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shortforms'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
            models.Index(fields=['visibility']),
        ]

class ShortformComment(models.Model):
    """
    [2] 숏폼 댓글 (shortform_comments)
    """
    shortform = models.ForeignKey(Shortform, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    content = models.TextField()
    source_lang = models.CharField(max_length=10, default='ko')
    
    total_likes = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shortform_comments'
        ordering = ['-created_at']

class ShortformLike(models.Model):
    """
    [3] 숏폼 좋아요 (shortform_likes)
    """
    shortform = models.ForeignKey(Shortform, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shortform_likes'
        unique_together = ('shortform', 'user') # 중복 좋아요 방지

class ShortformCommentLike(models.Model):
    """
    [4] 댓글 좋아요 (shortform_comment_likes)
    """
    comment = models.ForeignKey(ShortformComment, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shortform_comment_likes'
        unique_together = ('comment', 'user')

class ShortformView(models.Model):
    """
    [5] 숏폼 조회 기록 (shortform_views)
    - 엑셀 파일: 'Shortform_Views'
    - 데이터가 많이 쌓이므로 주기적인 삭제(Batch) 고려 필요
    """
    shortform = models.ForeignKey(Shortform, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shortform_views'
        indexes = [
            models.Index(fields=['shortform', 'user']), # 중복 조회 체크용
        ]

class TranslationEntry(models.Model):
    """
    [6] ★ 만능 AI 번역 테이블 (translation_entries)
    - 엑셀 파일 설계 완벽 반영
    - Polymorphic (GenericForeignKey) 사용하여 어떤 테이블이든 번역 가능
    """
    # 1. 어떤 테이블인가? (예: Shortform, PlaceReview, TravelPost)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    # 2. 몇 번 글인가? (PK)
    object_id = models.PositiveIntegerField()
    # 3. 실제 연결 (Django 내부용)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 번역된 컬럼명 (예: title, content, description)
    field_name = models.CharField(max_length=100)
    
    source_lang = models.CharField(max_length=10, help_text="원본 언어 (예: ko)")
    target_lang = models.CharField(max_length=10, help_text="번역된 언어 (예: en)")
    
    # ★ 원본 해시 (Source Hash)
    # 원본 텍스트의 변경 여부를 감지하여, 변경 시에만 AI 번역을 다시 수행하기 위함 (비용 절감)
    source_hash = models.CharField(max_length=64, db_index=True)
    
    translated_text = models.TextField()
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'translation_entries'
        unique_together = ('content_type', 'object_id', 'field_name', 'target_lang')
        indexes = [
            models.Index(fields=['source_hash']), # 해시 조회 최적화
        ]