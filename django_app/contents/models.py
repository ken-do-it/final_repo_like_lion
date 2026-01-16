from django.db import models
from django.conf import settings
from django.utils import timezone

class Shortform(models.Model):
    """
    [1] 숏폼 영상 (shortforms)
    - 엑셀 파일의 'Shortforms' 테이블 반영
    - 카운터 캐시(total_...) 포함
    - 영상 메타데이터 필드 추가 (duration, width, height, file_size)
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shortforms')

    video_url = models.CharField(max_length=255, help_text="영상 파일 URL")
    thumbnail_url = models.CharField(max_length=255, blank=True, null=True, help_text="썸네일 이미지 URL")
    
    # [NEW] 위치 정보 (단순 텍스트 필드)
    location = models.CharField(max_length=100, blank=True, null=True, help_text="촬영 위치 (예: Seoul, Korea)")

    title = models.TextField(help_text="영상 제목")
    content = models.TextField(blank=True, null=True, help_text="영상 설명/내용")

    # 공개 범위 (엑셀: PUBLIC/FRIENDS/PRIVATE)
    class Visibility(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public'
        FRIENDS = 'FRIENDS', 'Friends Only'
        PRIVATE = 'PRIVATE', 'Private'

    visibility = models.CharField(max_length=20, choices=Visibility.choices, default=Visibility.PUBLIC)

    # 원본 언어 (번역 기준점)
    source_lang = models.CharField(max_length=10, default='ko', help_text="작성 언어 (예: ko, en)")

    # 성능 최적화용 카운터 (DB 부하 줄이기용)
    total_likes = models.IntegerField(default=0)
    total_comments = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)

    # 영상 메타데이터 (FFprobe로 추출)
    duration = models.IntegerField(null=True, blank=True, help_text="영상 길이 (초)")
    width = models.IntegerField(null=True, blank=True, help_text="영상 너비 (px)")
    height = models.IntegerField(null=True, blank=True, help_text="영상 높이 (px)")
    file_size = models.BigIntegerField(null=True, blank=True, help_text="파일 크기 (bytes)")

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
    - 비로그인 사용자도 조회 가능하도록 user nullable 처리
    - IP 주소 기반 중복 체크
    """
    shortform = models.ForeignKey(Shortform, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True, help_text="IP 주소 (중복 체크용)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shortform_views'
        indexes = [
            models.Index(fields=['shortform', 'user']), # 중복 조회 체크용 (로그인 사용자)
            models.Index(fields=['shortform', 'ip_address']), # 중복 조회 체크용 (비로그인 사용자)
        ]

class TranslationEntry(models.Model):
    """
    [6] ★ AI 번역 캐시 테이블 (translation_entries)
    - 엑셀 파일 설계 완벽 반영
    - entity_type, entity_id로 어떤 테이블이든 번역 가능
    - source_hash로 원본 변경 감지 (비용 절감)
    """
    # 어떤 엔티티인가? (예: 'shortform', 'comment', 'review', 'post')
    entity_type = models.CharField(max_length=50, help_text="엔티티 타입 (shortform, comment 등)")
    # 몇 번 레코드인가? (해당 테이블의 PK)
    entity_id = models.BigIntegerField(null=False, blank=True,help_text="엔티티 ID")

    # 번역할 필드명 (예: title, content, description)
    field = models.CharField(max_length=100, help_text="번역할 필드명")

    source_lang = models.CharField(max_length=10, help_text="원본 언어 (예: ko)")
    target_lang = models.CharField(max_length=10, help_text="번역된 언어 (예: en)")

    # ★ 원본 해시 (Source Hash)
    # 원본 텍스트의 변경 여부를 감지하여, 변경 시에만 AI 번역을 다시 수행하기 위함 (비용 절감)
    source_hash = models.CharField(max_length=64, db_index=True, help_text="SHA-256 해시")

    translated_text = models.TextField(help_text="번역된 텍스트")

    # AI 번역 제공자 및 모델 정보
    provider = models.CharField(max_length=50, default='nllb', help_text="번역 제공자 (nllb, google, papago 등)")
    model = models.CharField(max_length=100, default='facebook/nllb-200-distilled-600M', help_text="사용된 모델명")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(default=timezone.now, help_text="마지막 사용 시간 (캐시 정리용)")

    class Meta:
        db_table = 'translation_entries'
        unique_together = ('entity_type', 'entity_id', 'field', 'target_lang')
        indexes = [
            models.Index(fields=['source_hash']), # 해시 조회 최적화
            models.Index(fields=['last_used_at']), # 오래된 캐시 정리용
        ]