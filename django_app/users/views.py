from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from django.shortcuts import render, redirect
from urllib.parse import urlencode
from datetime import timedelta
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiExample

from .models import (
    UserPreference, LoginSession, LoginHistory,
    EmailVerification, PasswordResetToken, UserWithdrawal, SavedId
)
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    EmailVerificationSerializer, SendVerificationSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    PasswordChangeSerializer, TokenRefreshSerializer,
    UserPreferenceSerializer, UserWithdrawalSerializer
)
from .utils import (
    generate_jwt_token, decode_jwt_token,
    generate_verification_code, generate_reset_token,
    send_verification_email, send_password_reset_email,
    get_client_ip, get_device_info, generate_device_fingerprint
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """회원가입 API"""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'message': '회원가입이 완료되었습니다.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """로그인 API"""
    permission_classes = [AllowAny]

    @extend_schema(
        summary="로그인",
        description="사용자 아이디와 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.",
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(
                response={
                    'type': 'object',
                    'properties': {
                        'message': {'type': 'string', 'example': '로그인 성공'},
                        'access_token': {'type': 'string', 'example': 'eyJ0eXAiOiJKV1QiLCJhbGc...'},
                        'refresh_token': {'type': 'string', 'example': 'eyJ0eXAiOiJKV1QiLCJhbGc...'},
                        'user': {'type': 'object'}
                    }
                },
                description="로그인 성공 시 JWT 토큰과 사용자 정보 반환"
            ),
            401: OpenApiResponse(description="이메일 또는 비밀번호가 올바르지 않습니다."),
            403: OpenApiResponse(description="비활성화된 계정입니다.")
        },
        examples=[
            OpenApiExample(
                'Login Example',
                value={
                    'username': 'testuser',
                    'password': 'password123',
                    'remember_me': False
                },
                request_only=True,
            ),
        ],
        tags=['인증']
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        remember_me = serializer.validated_data.get('remember_me', False)

        # 사용자 인증
        user = authenticate(username=username, password=password)

        # 로그인 이력 기록
        ip_address = get_client_ip(request)
        device_info = get_device_info(request)

        if user is None:
            LoginHistory.objects.create(
                username=username,
                login_type='LOCAL',
                status='FAILED',
                failure_reason='Invalid credentials',
                ip_address=ip_address,
                device_info=device_info
            )
            return Response({
                'error': '아이디 또는 비밀번호가 올바르지 않습니다.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            LoginHistory.objects.create(
                user=user,
                username=username,
                login_type='LOCAL',
                status='FAILED',
                failure_reason='Account inactive',
                ip_address=ip_address,
                device_info=device_info
            )
            return Response({
                'error': '비활성화된 계정입니다.'
            }, status=status.HTTP_403_FORBIDDEN)

        # JWT 토큰 생성
        access_token = generate_jwt_token(user.id, 'access')
        refresh_token = generate_jwt_token(user.id, 'refresh')

        # 로그인 세션 생성
        session = LoginSession.objects.create(
            user=user,
            session_token=access_token,
            refresh_token=refresh_token,
            device_info=device_info,
            ip_address=ip_address,
            is_auto_login=remember_me,
            expires_at=timezone.now() + timedelta(hours=1)
        )

        # 로그인 성공 이력 기록
        LoginHistory.objects.create(
            user=user,
            username=username,
            login_type='LOCAL',
            status='SUCCESS',
            ip_address=ip_address,
            device_info=device_info
        )

        # 마지막 로그인 시간 업데이트
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # 아이디 저장 기능
        if remember_me:
            device_fingerprint = generate_device_fingerprint(request)
            SavedId.objects.get_or_create(
                device_fingerprint=device_fingerprint,
                username=username
            )

        return Response({
            'message': '로그인 성공',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """로그아웃 API"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # 현재 세션 토큰 가져오기
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

            # 세션 삭제
            LoginSession.objects.filter(
                user=request.user,
                session_token=token
            ).delete()

        return Response({
            'message': '로그아웃되었습니다.'
        }, status=status.HTTP_200_OK)


class TokenRefreshView(APIView):
    """토큰 갱신 API"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data['refresh_token']

        # 리프레시 토큰 검증
        payload = decode_jwt_token(refresh_token)
        if not payload or payload.get('type') != 'refresh':
            return Response({
                'error': '유효하지 않은 리프레시 토큰입니다.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 세션 확인
        try:
            session = LoginSession.objects.get(
                refresh_token=refresh_token,
                user_id=payload['user_id']
            )
        except LoginSession.DoesNotExist:
            return Response({
                'error': '세션을 찾을 수 없습니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 새로운 액세스 토큰 생성
        new_access_token = generate_jwt_token(payload['user_id'], 'access')

        # 세션 업데이트
        session.session_token = new_access_token
        session.expires_at = timezone.now() + timedelta(hours=1)
        session.save()

        return Response({
            'access_token': new_access_token
        }, status=status.HTTP_200_OK)


class SendVerificationView(APIView):
    """인증 코드 발송 API"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        purpose = serializer.validated_data['purpose']

        # 기존 인증 코드 삭제
        EmailVerification.objects.filter(email=email, purpose=purpose).delete()

        # 새 인증 코드 생성
        code = generate_verification_code()
        expires_at = timezone.now() + timedelta(minutes=10)

        EmailVerification.objects.create(
            email=email,
            verification_code=code,
            purpose=purpose,
            expires_at=expires_at
        )

        # 이메일 발송
        try:
            send_verification_email(email, code, purpose)
            return Response({
                'message': '인증 코드가 발송되었습니다.'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': '이메일 발송에 실패했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(APIView):
    """이메일 인증 API"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        try:
            verification = EmailVerification.objects.get(
                email=email,
                verification_code=code,
                is_verified=False
            )

            # 만료 확인
            if verification.expires_at < timezone.now():
                return Response({
                    'error': '인증 코드가 만료되었습니다.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 인증 완료
            verification.is_verified = True
            verification.save()

            # 회원가입 목적인 경우 사용자 이메일 인증 상태 업데이트
            if verification.purpose == 'SIGNUP':
                User.objects.filter(email=email).update(is_email_verified=True)

            return Response({
                'message': '이메일 인증이 완료되었습니다.'
            }, status=status.HTTP_200_OK)

        except EmailVerification.DoesNotExist:
            return Response({
                'error': '유효하지 않은 인증 코드입니다.'
            }, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """비밀번호 재설정 요청 API"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = User.objects.get(email=email)

        # 기존 토큰 삭제
        PasswordResetToken.objects.filter(user=user).delete()

        # 새 토큰 생성
        token = generate_reset_token()
        expires_at = timezone.now() + timedelta(hours=24)

        PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )

        # 이메일 발송
        try:
            send_password_reset_email(email, token)
            return Response({
                'message': '비밀번호 재설정 링크가 발송되었습니다.'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': '이메일 발송에 실패했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PasswordResetConfirmView(APIView):
    """비밀번호 재설정 확인 API"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        try:
            reset_token = PasswordResetToken.objects.get(
                token=token,
                is_used=False
            )

            # 만료 확인
            if reset_token.expires_at < timezone.now():
                return Response({
                    'error': '토큰이 만료되었습니다.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 비밀번호 변경
            user = reset_token.user
            user.set_password(password)
            user.save()

            # 토큰 사용 처리
            reset_token.is_used = True
            reset_token.save()

            return Response({
                'message': '비밀번호가 변경되었습니다.'
            }, status=status.HTTP_200_OK)

        except PasswordResetToken.DoesNotExist:
            return Response({
                'error': '유효하지 않은 토큰입니다.'
            }, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeView(APIView):
    """비밀번호 변경 API"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_password = serializer.validated_data['old_password']
        new_password = serializer.validated_data['new_password']

        # 기존 비밀번호 확인
        if not request.user.check_password(old_password):
            return Response({
                'error': '기존 비밀번호가 올바르지 않습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 비밀번호 변경
        request.user.set_password(new_password)
        request.user.save()

        return Response({
            'message': '비밀번호가 변경되었습니다.'
        }, status=status.HTTP_200_OK)


class ProfileView(generics.RetrieveUpdateDestroyAPIView):
    """프로필 조회/수정/삭제 API"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        """프로필 업데이트 (PUT을 PATCH처럼 처리)"""
        partial = kwargs.pop('partial', True)  # 기본적으로 부분 업데이트 허용
        instance = self.get_object()
        
        # 업데이트 가능한 필드만 추출
        allowed_fields = ['nickname', 'country', 'city', 'phone_number', 'birth_year']
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        serializer = self.get_serializer(instance, data=update_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """프로필 부분 업데이트 (PATCH)"""
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """회원 탈퇴"""
        serializer = UserWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password = serializer.validated_data['password']

        # 비밀번호 확인
        if not request.user.check_password(password):
            return Response({
                'error': '비밀번호가 올바르지 않습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 탈퇴 기록 생성
        UserWithdrawal.objects.create(
            original_user_id=request.user.id,
            username=request.user.username,
            email=request.user.email,
            withdrawal_reason=serializer.validated_data.get('withdrawal_reason'),
            withdrawal_detail=serializer.validated_data.get('withdrawal_detail')
        )

        # 계정 비활성화 (또는 삭제)
        request.user.account_status = 'DELETED'
        request.user.is_active = False
        request.user.save()

        # 모든 세션 삭제
        LoginSession.objects.filter(user=request.user).delete()

        return Response({
            'message': '회원 탈퇴가 완료되었습니다.'
        }, status=status.HTTP_200_OK)



class PreferencesView(generics.RetrieveUpdateAPIView):
    """사용자 설정 조회/수정 API"""
    serializer_class = UserPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # 설정이 없으면 생성
        preferences, created = UserPreference.objects.get_or_create(
            user=self.request.user
        )
        return preferences


class MainPageView(APIView):
    """메인페이지 데이터 API"""
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Triple 스타일 메인페이지 데이터 반환
        - 인증된 사용자: 개인화된 추천
        - 비인증 사용자: 일반 추천
        """
        user = request.user if request.user.is_authenticated else None

        # Triple 스타일 응답 데이터
        response_data = {
            'hero': {
                'title': 'Discover Korea',
                'subtitle': 'Travel smarter with local insights',
                'cta_text': 'Start Planning',
                'background_image': '/static/images/hero-seoul.jpg'
            },
            'trending_destinations': [
                {
                    'id': 1,
                    'name': 'Seoul',
                    'name_ko': '서울',
                    'country': 'South Korea',
                    'rating': 4.8,
                    'review_count': 12453,
                    'image_url': 'https://images.unsplash.com/photo-1578193661644-dee2e18a5e6a',
                    'tags': ['Culture', 'Food', 'Shopping', 'Night Life'],
                    'description': 'Where ancient palaces meet modern skyscrapers',
                    'average_cost': '₩80,000',
                    'best_season': 'Spring, Fall'
                },
                {
                    'id': 2,
                    'name': 'Busan',
                    'name_ko': '부산',
                    'country': 'South Korea',
                    'rating': 4.7,
                    'review_count': 8932,
                    'image_url': 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22',
                    'tags': ['Beach', 'Seafood', 'Temple', 'Market'],
                    'description': 'Korea\'s coastal paradise with fresh seafood',
                    'average_cost': '₩60,000',
                    'best_season': 'Summer, Fall'
                },
                {
                    'id': 3,
                    'name': 'Jeju Island',
                    'name_ko': '제주도',
                    'country': 'South Korea',
                    'rating': 4.9,
                    'review_count': 15678,
                    'image_url': 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2',
                    'tags': ['Nature', 'Hiking', 'Beach', 'Volcano'],
                    'description': 'Island of natural wonders and volcanic beauty',
                    'average_cost': '₩70,000',
                    'best_season': 'All Year'
                },
                {
                    'id': 4,
                    'name': 'Gyeongju',
                    'name_ko': '경주',
                    'country': 'South Korea',
                    'rating': 4.6,
                    'review_count': 5234,
                    'image_url': 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22',
                    'tags': ['History', 'Temple', 'UNESCO', 'Culture'],
                    'description': 'Museum without walls, ancient Silla capital',
                    'average_cost': '₩50,000',
                    'best_season': 'Spring, Fall'
                }
            ],
            'featured_experiences': [
                {
                    'id': 1,
                    'title': 'Korean Temple Stay',
                    'location': 'Nationwide',
                    'image_url': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9',
                    'duration': '1-2 days',
                    'price': '₩50,000',
                    'rating': 4.8,
                    'category': 'Culture'
                },
                {
                    'id': 2,
                    'title': 'DMZ Tour',
                    'location': 'Paju',
                    'image_url': 'https://images.unsplash.com/photo-1578193661644-dee2e18a5e6a',
                    'duration': '8 hours',
                    'price': '₩120,000',
                    'rating': 4.7,
                    'category': 'History'
                },
                {
                    'id': 3,
                    'title': 'Hanbok Experience',
                    'location': 'Seoul',
                    'image_url': 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22',
                    'duration': '3 hours',
                    'price': '₩30,000',
                    'rating': 4.9,
                    'category': 'Culture'
                },
                {
                    'id': 4,
                    'title': 'K-Food Cooking Class',
                    'location': 'Seoul',
                    'image_url': 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2',
                    'duration': '2 hours',
                    'price': '₩60,000',
                    'rating': 4.8,
                    'category': 'Food'
                }
            ],
            'local_recommendations': [
                {
                    'id': 1,
                    'title': 'Hidden Hanok Cafe in Ikseon-dong',
                    'location': 'Seoul, Jongno-gu',
                    'author': 'Local Guide Kim',
                    'author_badge': 'Seoul Expert Lv.5',
                    'image_url': 'https://images.unsplash.com/photo-1554118811-1e0d58224f24',
                    'saved_count': 2341,
                    'tip': 'Visit on weekday mornings to avoid crowds'
                },
                {
                    'id': 2,
                    'title': 'Sunrise at Gamcheon Culture Village',
                    'location': 'Busan, Saha-gu',
                    'author': 'Local Guide Park',
                    'author_badge': 'Busan Expert Lv.4',
                    'image_url': 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22',
                    'saved_count': 1823,
                    'tip': 'Arrive before 6 AM for the best photos'
                },
                {
                    'id': 3,
                    'title': 'Secret Beach in Udo Island',
                    'location': 'Jeju, Udo',
                    'author': 'Local Guide Lee',
                    'author_badge': 'Jeju Expert Lv.5',
                    'image_url': 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2',
                    'saved_count': 3156,
                    'tip': 'Rent an e-bike to explore the entire island'
                }
            ],
            'travel_tips': [
                {
                    'icon': 'wifi',
                    'title': 'Free WiFi Everywhere',
                    'description': 'Get a T-money card for subway and free WiFi at all stations'
                },
                {
                    'icon': 'translate',
                    'title': 'Translation Apps',
                    'description': 'Papago and Google Translate work great for Korean'
                },
                {
                    'icon': 'payment',
                    'title': 'Cashless Society',
                    'description': 'Credit cards accepted everywhere, but keep some cash for markets'
                },
                {
                    'icon': 'transport',
                    'title': 'T-money Card',
                    'description': 'One card for all public transportation across Korea'
                }
            ],
            'quick_stats': {
                'destinations': 247,
                'experiences': 1432,
                'local_guides': 892,
                'reviews': 156234
            }
        }

        # 인증된 사용자인 경우 개인화 데이터 추가
        if user:
            response_data['user'] = {
                'id': user.id,
                'username': user.username,
                'nickname': user.nickname or user.username,
                'profile_image': user.profile_image_url or '/static/images/default-avatar.png',
                'badges': [],
                'saved_places_count': 0,
                'trips_count': 0
            }

            # 사용자 설정 기반 개인화
            try:
                preferences = user.preferences
                response_data['personalized'] = {
                    'language': preferences.language,
                    'currency': preferences.currency,
                    'recommended_for_you': [
                        {
                            'title': 'Based on your interests',
                            'items': response_data['trending_destinations'][:2]
                        }
                    ]
                }
            except UserPreference.DoesNotExist:
                pass

            # 현지인 뱃지 확인
            try:
                badges = user.local_badges.filter(is_active=True)
                response_data['user']['badges'] = [
                    {
                        'city': badge.city,
                        'level': badge.level,
                        'icon': f'/static/badges/{badge.city.lower()}-lv{badge.level}.png'
                    }
                    for badge in badges
                ]
            except:
                pass

        return Response(response_data, status=status.HTTP_200_OK)


class SavedIdCheckView(APIView):
    """저장된 아이디 확인 API"""
    permission_classes = [AllowAny]

    def get(self, request):
        """
        디바이스에 저장된 아이디 목록 반환
        """
        device_fingerprint = generate_device_fingerprint(request)

        saved_ids = SavedId.objects.filter(
            device_fingerprint=device_fingerprint
        ).values_list('username', flat=True)

        return Response({
            'saved_ids': list(saved_ids)
        }, status=status.HTTP_200_OK)


class SessionTokenView(APIView):
    """소셜 로그인 후 세션에서 토큰 가져오기 API"""
    permission_classes = [AllowAny]

    def get(self, request):
        """
        세션에 저장된 토큰과 사용자 정보 반환 후 세션에서 삭제
        """
        access_token = request.session.get('access_token', '')
        refresh_token = request.session.get('refresh_token', '')
        user_id = request.session.get('user_id', '')
        username = request.session.get('username', '')
        email = request.session.get('email', '')
        nickname = request.session.get('nickname', '')
        social_provider = request.session.get('social_provider', '')

        if access_token and refresh_token:
            # 토큰 반환
            response_data = {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email,
                    'nickname': nickname,
                    'social_provider': social_provider
                }
            }

            # 보안을 위해 세션에서 토큰 삭제 (한 번만 사용)
            request.session.pop('access_token', None)
            request.session.pop('refresh_token', None)
            request.session.pop('user_id', None)
            request.session.pop('username', None)
            request.session.pop('email', None)
            request.session.pop('nickname', None)
            request.session.pop('social_provider', None)

            return Response(response_data, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'No session token found'
            }, status=status.HTTP_404_NOT_FOUND)



# 템플릿 렌더링 뷰
def login_page(request):
    """로그인 페이지 렌더링"""
    return render(request, 'users/login.html')


def register_page(request):
    """회원가입 페이지 렌더링"""
    return render(request, 'users/register.html')


def main_page(request):
    """메인 페이지 렌더링"""
    return render(request, 'users/main.html')


def api_test_page(request):
    """API 테스트 페이지 렌더링"""
    return render(request, 'users/api_test.html')


def social_callback_page(request):
    """소셜 로그인 성공 후 프론트엔드로 리다이렉트 (토큰은 세션에 저장)"""
    # 세션에 토큰이 있는지 확인 (signals.py에서 저장됨)
    access_token = request.session.get('access_token', '')
    
    if access_token:
        # 토큰이 세션에 있으면 프론트엔드로 리다이렉트 (URL에 토큰 노출하지 않음)
        frontend_url = "https://tripko.p-e.kr/auth/social-callback?success=true"
    else:
        # 토큰이 없으면 실패
        frontend_url = "https://tripko.p-e.kr/auth/social-callback?success=false"
    
    return redirect(frontend_url)


def mypage_page(request):
    """마이페이지 렌더링"""
    return render(request, 'users/mypage.html')


# ============================================================================
# 마이페이지 API Views
# ============================================================================

try:
    from places.models import PlaceBookmark, PlaceReview
    from .serializers import SavedPlaceSerializer, MyReviewSerializer

    class SavedPlacesView(generics.ListCreateAPIView):
        """저장한 장소 목록 조회 및 저장"""
        permission_classes = [IsAuthenticated]
        serializer_class = SavedPlaceSerializer

        @extend_schema(
            summary="저장한 장소 목록",
            description="사용자가 저장한 장소(찜) 목록을 조회합니다.",
            responses={200: SavedPlaceSerializer(many=True)},
            tags=['마이페이지']
        )
        def get(self, request, *args, **kwargs):
            return super().get(request, *args, **kwargs)

        @extend_schema(
            summary="장소 저장",
            description="장소를 찜 목록에 추가합니다.",
            request=SavedPlaceSerializer,
            responses={201: SavedPlaceSerializer},
            tags=['마이페이지']
        )
        def post(self, request, *args, **kwargs):
            return super().post(request, *args, **kwargs)

        def get_queryset(self):
            return PlaceBookmark.objects.filter(user=self.request.user).select_related('place')

        def perform_create(self, serializer):
            serializer.save(user=self.request.user)


    class SavedPlaceDetailView(generics.RetrieveDestroyAPIView):
        """저장한 장소 상세 조회 및 삭제"""
        permission_classes = [IsAuthenticated]
        serializer_class = SavedPlaceSerializer

        @extend_schema(
            summary="저장한 장소 삭제",
            description="찜 목록에서 장소를 제거합니다.",
            responses={204: None},
            tags=['마이페이지']
        )
        def delete(self, request, *args, **kwargs):
            return super().delete(request, *args, **kwargs)

        def get_queryset(self):
            return PlaceBookmark.objects.filter(user=self.request.user)


    class MyReviewsView(generics.ListAPIView):
        """내 리뷰 목록"""
        permission_classes = [IsAuthenticated]
        serializer_class = MyReviewSerializer

        @extend_schema(
            summary="내 리뷰 목록",
            description="사용자가 작성한 리뷰 목록을 조회합니다.",
            responses={200: MyReviewSerializer(many=True)},
            tags=['마이페이지']
        )
        def get(self, request, *args, **kwargs):
            return super().get(request, *args, **kwargs)

        def get_queryset(self):
            return PlaceReview.objects.filter(user=self.request.user).select_related('place')


    class MyReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
        """내 리뷰 상세 조회/수정/삭제"""
        permission_classes = [IsAuthenticated]
        serializer_class = MyReviewSerializer

        @extend_schema(
            summary="리뷰 수정",
            description="작성한 리뷰를 수정합니다.",
            request=MyReviewSerializer,
            responses={200: MyReviewSerializer},
            tags=['마이페이지']
        )
        def put(self, request, *args, **kwargs):
            return super().put(request, *args, **kwargs)

        @extend_schema(
            summary="리뷰 삭제",
            description="작성한 리뷰를 삭제합니다.",
            responses={204: None},
            tags=['마이페이지']
        )
        def delete(self, request, *args, **kwargs):
            return super().delete(request, *args, **kwargs)

        def get_queryset(self):
            return PlaceReview.objects.filter(user=self.request.user)

except ImportError:
    # places 앱이 없는 경우 더미 뷰
    SavedPlacesView = None
    SavedPlaceDetailView = None
    MyReviewsView = None
    MyReviewDetailView = None
