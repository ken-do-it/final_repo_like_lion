from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):
    """
    [1] 사용자 기본 정보 (users.csv 반영)
    - AbstractUser 상속으로 password_hash, username, email 등 기본 처리
    """
    # 기본 ID는 Django가 자동으로 id (BigInt) 생성

    nickname = models.CharField(max_length=50, blank=True)
    birth_year = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_image_url = models.CharField(max_length=500, blank=True, null=True)
    
    # 계정 상태 및 동의
    class AccountStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        DELETED = 'DELETED', 'Deleted'
        
    account_status = models.CharField(max_length=20, choices=AccountStatus.choices, default=AccountStatus.ACTIVE)
    is_email_verified = models.BooleanField(default=False)
    email_consent = models.BooleanField(default=False)
    
    # 소셜 로그인 정보
    class ProviderType(models.TextChoices):
        LOCAL = 'LOCAL', 'Local'
        GOOGLE = 'GOOGLE', 'Google'
        KAKAO = 'KAKAO', 'Kakao'
        NAVER = 'NAVER', 'Naver'
        
    provider_type = models.CharField(max_length=20, choices=ProviderType.choices, default=ProviderType.LOCAL)
    provider_id = models.CharField(max_length=255, blank=True, null=True)
    
    is_temp_password = models.BooleanField(default=False)
    
    # AbstractUser의 last_login, date_joined(created_at) 사용
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'

class UserPreference(models.Model):
    """
    [5] 사용자 설정 (user_preferences.csv 반영)
    - User와 1:1 관계
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    
    language = models.CharField(max_length=10, default='ko')
    currency = models.CharField(max_length=3, default='KRW')
    
    # 알림 설정
    push_notification = models.BooleanField(default=True)
    email_notification = models.BooleanField(default=True)
    booking_alert = models.BooleanField(default=True)
    schedule_alert = models.BooleanField(default=True)
    flight_alert = models.BooleanField(default=True)
    event_alert = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_preferences'

class EmailVerification(models.Model):
    """
    [2] 이메일 인증 (email_verifications.csv 반영)
    """
    email = models.EmailField(max_length=100)
    verification_code = models.CharField(max_length=6)
    
    class Purpose(models.TextChoices):
        SIGNUP = 'SIGNUP', 'Signup'
        FIND_ID = 'FIND_ID', 'Find ID'
        FIND_PASSWORD = 'FIND_PASSWORD', 'Find Password'
        
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_verifications'
        indexes = [
            models.Index(fields=['email']),
        ]

class PasswordResetToken(models.Model):
    """
    [3] 비밀번호 재설정 (password_reset_tokens.csv 반영)
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_reset_tokens'

class LoginSession(models.Model):
    """
    [4] 로그인 세션 & 리프레시 토큰 (login_sessions.csv 반영)
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_token = models.CharField(max_length=255, unique=True)
    refresh_token = models.CharField(max_length=255, null=True, blank=True)
    
    device_info = models.CharField(max_length=255, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_auto_login = models.BooleanField(default=False)
    
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'login_sessions'

class LoginHistory(models.Model):
    """
    [7] 로그인 이력 (login_history.csv 반영)
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    username = models.CharField(max_length=150, null=True, blank=True) # 시도한 아이디 기록
    
    class LoginType(models.TextChoices):
        LOCAL = 'LOCAL', 'Local'
        GOOGLE = 'GOOGLE', 'Google'
        KAKAO = 'KAKAO', 'Kakao'
        NAVER = 'NAVER', 'Naver'
        
    login_type = models.CharField(max_length=20, choices=LoginType.choices)
    
    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        
    status = models.CharField(max_length=20, choices=Status.choices)
    failure_reason = models.CharField(max_length=100, null=True, blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.CharField(max_length=255, null=True, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'login_history'

class UserWithdrawal(models.Model):
    """
    [6] 회원 탈퇴 기록 (user_withdrawal.csv 반영)
    """
    # 탈퇴하면 User 테이블에서 삭제되거나 비활성화되므로, user_id만 숫자로 남김
    original_user_id = models.BigIntegerField(help_text="탈퇴한 사용자의 원본 ID")
    username = models.CharField(max_length=150, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    
    withdrawal_reason = models.CharField(max_length=50, null=True, blank=True)
    withdrawal_detail = models.TextField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_withdrawal'

class SavedId(models.Model):
    """
    [8] 아이디 저장 (saved_ids.csv 반영)
    """
    device_fingerprint = models.CharField(max_length=255)
    username = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_ids'
        unique_together = ('device_fingerprint', 'username')

class LocalBadge(models.Model):
    """ 
    [통합] 현지인 인증 뱃지 (이연주님 설계) 
    - users 앱에 포함시키는 것이 적절하여 유지함
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='local_badges')
    city = models.CharField(max_length=100, help_text="인증된 도시")
    
    #레벨1 : 인증 시작했지만 아직 뱃지 획득 못함(글 작성 권한 없음)
    #레벨2 : 1주일 간격으로 3번 인증 성공. 뱃지 최저 단계. 여기부터 글 작성 가능
    #레벨3 : 1달 후 인증 성공
    #레벨4 : 6개월 후 인증 성공
    #레벨5 : 1년 후 인증 성공. 이때부턴 계속 1년주기로 인증 갱신
    level = models.IntegerField(default=1, choices=[(i, f'Level {i}') for i in range(1, 6)])
    is_active = models.BooleanField(default=True)
    
    first_authenticated_at = models.DateField(auto_now_add=True)
    last_authenticated_at = models.DateField(auto_now=True)
    next_authentication_due = models.DateField(help_text="다음 인증 예정일")
    
    maintenance_months = models.IntegerField(default=0, help_text="인증 유지 개월 수")

    class Meta:
        db_table = 'local_badges'