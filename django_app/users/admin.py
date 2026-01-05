from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, UserPreference, LocalBadge, EmailVerification,
    PasswordResetToken, LoginSession, LoginHistory,
    UserWithdrawal, SavedId
)


class UserPreferenceInline(admin.StackedInline):
    """사용자 설정 인라인"""
    model = UserPreference
    can_delete = False
    verbose_name = '사용자 설정'
    verbose_name_plural = '사용자 설정'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """커스텀 유저 관리"""
    inlines = (UserPreferenceInline,)
    list_display = [
        'username', 'email', 'nickname', 'provider_type',
        'account_status', 'is_email_verified', 'date_joined'
    ]
    list_filter = [
        'provider_type', 'account_status', 'is_email_verified',
        'is_active', 'is_staff', 'date_joined'
    ]
    search_fields = ['username', 'email', 'nickname']
    ordering = ['-date_joined']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('추가 정보', {
            'fields': (
                'nickname', 'birth_year', 'country', 'city',
                'phone_number', 'profile_image_url'
            )
        }),
        ('계정 상태', {
            'fields': (
                'account_status', 'is_email_verified',
                'email_consent', 'is_temp_password'
            )
        }),
        ('소셜 로그인', {
            'fields': ('provider_type', 'provider_id')
        }),
    )


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    """사용자 설정 관리"""
    list_display = [
        'user', 'language', 'currency',
        'push_notification', 'email_notification'
    ]
    list_filter = ['language', 'currency']
    search_fields = ['user__username', 'user__email']


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    """이메일 인증 관리"""
    list_display = [
        'email', 'purpose', 'verification_code',
        'is_verified', 'expires_at', 'created_at'
    ]
    list_filter = ['purpose', 'is_verified', 'created_at']
    search_fields = ['email']
    readonly_fields = ['created_at']


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """비밀번호 재설정 토큰 관리"""
    list_display = ['user', 'is_used', 'expires_at', 'created_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['token', 'created_at']


@admin.register(LoginSession)
class LoginSessionAdmin(admin.ModelAdmin):
    """로그인 세션 관리"""
    list_display = [
        'user', 'ip_address', 'is_auto_login',
        'expires_at', 'created_at', 'last_activity_at'
    ]
    list_filter = ['is_auto_login', 'created_at']
    search_fields = ['user__username', 'ip_address']
    readonly_fields = ['created_at', 'last_activity_at']


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    """로그인 이력 관리"""
    list_display = [
        'username', 'login_type', 'status',
        'ip_address', 'attempted_at'
    ]
    list_filter = ['login_type', 'status', 'attempted_at']
    search_fields = ['username', 'ip_address']
    readonly_fields = ['attempted_at']


@admin.register(UserWithdrawal)
class UserWithdrawalAdmin(admin.ModelAdmin):
    """회원 탈퇴 기록 관리"""
    list_display = [
        'original_user_id', 'username', 'email',
        'withdrawal_reason', 'withdrawn_at'
    ]
    list_filter = ['withdrawal_reason', 'withdrawn_at']
    search_fields = ['username', 'email']
    readonly_fields = ['withdrawn_at']


@admin.register(SavedId)
class SavedIdAdmin(admin.ModelAdmin):
    """저장된 아이디 관리"""
    list_display = ['device_fingerprint', 'username', 'created_at']
    search_fields = ['username', 'device_fingerprint']
    readonly_fields = ['created_at']


@admin.register(LocalBadge)
class LocalBadgeAdmin(admin.ModelAdmin):
    """현지인 인증 뱃지 관리"""
    list_display = [
        'user', 'city', 'level', 'is_active',
        'maintenance_months', 'next_authentication_due'
    ]
    list_filter = ['level', 'is_active', 'city']
    search_fields = ['user__username', 'city']
    readonly_fields = ['first_authenticated_at', 'last_authenticated_at']