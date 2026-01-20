from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserPreference, LoginSession, EmailVerification, PasswordResetToken, LocalBadge

User = get_user_model()

# places 앱의 모델 import
try:
    from places.models import PlaceBookmark, PlaceReview
except ImportError:
    PlaceBookmark = None
    PlaceReview = None


class UserPreferenceSerializer(serializers.ModelSerializer):
    """사용자 설정 Serializer"""

    class Meta:
        model = UserPreference
        fields = [
            'language', 'currency',
            'push_notification', 'email_notification',
            'booking_alert', 'schedule_alert',
            'flight_alert', 'event_alert'
        ]


class LocalBadgeSerializer(serializers.ModelSerializer):
    """현지인 인증 뱃지 Serializer"""

    class Meta:
        model = LocalBadge
        fields = [
            'id', 'city', 'level', 'is_active',
            'first_authenticated_at', 'last_authenticated_at',
            'next_authentication_due', 'maintenance_months'
        ]


class UserSerializer(serializers.ModelSerializer):
    """사용자 기본 정보 Serializer"""
    preferences = UserPreferenceSerializer(read_only=True)
    local_badges = LocalBadgeSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'nickname',
            'birth_year', 'country', 'city',
            'phone_number', 'profile_image_url',
            'account_status', 'is_email_verified',
            'provider_type', 'preferences', 'local_badges',
            'date_joined', 'last_login'
        ]
        read_only_fields = [
            'id', 'account_status', 'is_email_verified',
            'provider_type', 'date_joined', 'last_login'
        ]


class RegisterSerializer(serializers.ModelSerializer):
    """회원가입 Serializer"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'nickname', 'birth_year', 'country', 'city', 'phone_number'
        ]

    def validate_email(self, value):
        """이메일 중복 검증"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("이미 사용 중인 이메일입니다.")
        return value

    def validate_username(self, value):
        """사용자명 중복 검증"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("이미 사용 중인 사용자명입니다.")
        return value

    def validate(self, attrs):
        """비밀번호 확인 검증"""
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({
                "password": "비밀번호가 일치하지 않습니다."
            })
        return attrs

    def create(self, validated_data):
        """사용자 생성"""
        validated_data.pop('password_confirm')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            nickname=validated_data.get('nickname', ''),
            birth_year=validated_data.get('birth_year'),
            country=validated_data.get('country'),
            city=validated_data.get('city'),
            phone_number=validated_data.get('phone_number'),
        )

        # 기본 설정 생성
        UserPreference.objects.create(user=user)

        return user


class LoginSerializer(serializers.Serializer):
    """로그인 Serializer"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    remember_me = serializers.BooleanField(required=False, default=False)


class EmailVerificationSerializer(serializers.Serializer):
    """이메일 인증 Serializer"""
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, max_length=6)


class SendVerificationSerializer(serializers.Serializer):
    """인증 코드 발송 Serializer"""
    email = serializers.EmailField(required=True)
    purpose = serializers.ChoiceField(
        choices=EmailVerification.Purpose.choices,
        default='SIGNUP'
    )


class PasswordResetRequestSerializer(serializers.Serializer):
    """비밀번호 재설정 요청 Serializer"""
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        """이메일 존재 여부 검증"""
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("등록되지 않은 이메일입니다.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """비밀번호 재설정 확인 Serializer"""
    token = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        """비밀번호 확인 검증"""
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({
                "password": "비밀번호가 일치하지 않습니다."
            })
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    """비밀번호 변경 Serializer"""
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        """비밀번호 확인 검증"""
        if attrs.get('new_password') != attrs.get('new_password_confirm'):
            raise serializers.ValidationError({
                "new_password": "비밀번호가 일치하지 않습니다."
            })
        return attrs


class TokenRefreshSerializer(serializers.Serializer):
    """토큰 갱신 Serializer"""
    refresh_token = serializers.CharField(required=True)


class UserWithdrawalSerializer(serializers.Serializer):
    """회원 탈퇴 Serializer"""
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    withdrawal_reason = serializers.CharField(required=False, allow_blank=True)
    withdrawal_detail = serializers.CharField(required=False, allow_blank=True)


# ============================================================================
# 마이페이지 Serializers
# ============================================================================

class SavedPlaceSerializer(serializers.ModelSerializer):
    """저장한 장소 Serializer"""
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_address = serializers.CharField(source='place.address', read_only=True)
    place_category = serializers.CharField(source='place.category_main', read_only=True)
    place_rating = serializers.DecimalField(source='place.average_rating', read_only=True, max_digits=3, decimal_places=2)

    class Meta:
        model = PlaceBookmark
        fields = [
            'id', 'place', 'place_name', 'place_address',
            'place_category', 'place_rating', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MyReviewSerializer(serializers.ModelSerializer):
    """내 리뷰 Serializer"""
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_address = serializers.CharField(source='place.address', read_only=True)

    class Meta:
        model = PlaceReview
        fields = [
            'id', 'place', 'place_name', 'place_address',
            'rating', 'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
