from django.db import models
from django.conf import settings
from places.models import Place  # places 앱의 Place 모델 참조


class TravelPlan(models.Model):
    """
    여행 일정 (travel_plans)
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='plans')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    class PlanType(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        AI_RECOMMENDED = 'ai_recommended', 'AI Recommended'
        
    plan_type = models.CharField(max_length=20, choices=PlanType.choices, default=PlanType.PERSONAL)
    ai_prompt = models.TextField(blank=True, null=True)
    
    start_date = models.DateField()
    end_date = models.DateField()
    
    is_public = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_plans'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
            models.Index(fields=['is_public']),
        ]


class PlanDetail(models.Model):
    """
    일정 상세 (plan_details)
    """
    plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE, related_name='details')
    place = models.ForeignKey(Place, on_delete=models.SET_NULL, null=True, blank=True, related_name='plan_details')
    
    date = models.DateField()
    description = models.TextField(blank=True, null=True)
    order_index = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plan_details'
        ordering = ['date', 'order_index']
        indexes = [
            models.Index(fields=['plan']),
            models.Index(fields=['date']),
        ]


class PlanDetailImage(models.Model):
    """
    일정 상세 사진 (plan_detail_images)
    """
    detail = models.ForeignKey(PlanDetail, on_delete=models.CASCADE, related_name='images')
    image_file = models.ImageField(
        upload_to='plan_images/',  # media/plan_images/
        blank=True,
        null=True
    )
    order_index = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plan_detail_images'
        ordering = ['order_index']
        indexes = [
            models.Index(fields=['detail']),
        ]


class AIQuestion(models.Model):
    """
    AI 추천 질문/답변 (ai_questions)
    """
    plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE, related_name='ai_questions')
    question = models.TextField()
    answer = models.TextField()
    order_index = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_questions'
        ordering = ['order_index']
        indexes = [
            models.Index(fields=['plan']),
        ]


class TravelPost(models.Model):
    """
    여행 후기 게시물 (travel_posts)
    """
    plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE, related_name='posts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    thumbnail_url = models.CharField(max_length=500, blank=True, null=True)
    
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_posts'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
            models.Index(fields=['like_count']),
        ]


class PostLike(models.Model):
    """
    게시물 좋아요 (post_likes)
    """
    post = models.ForeignKey(TravelPost, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'post_likes'
        unique_together = ('post', 'user')
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['user']),
        ]


class Comment(models.Model):
    """
    댓글 (comments)
    """
    post = models.ForeignKey(TravelPost, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    content = models.TextField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'comments'
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
        ]