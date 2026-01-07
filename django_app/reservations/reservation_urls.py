"""
예약 API URL 라우팅

Base: /api/v1/
"""
from django.urls import path
from django.conf import settings
from .views.reservation import MSReservationCreateView
from .views.payment import (
    MSPaymentCreateView,
    MSPaymentConfirmView,
    MSPaymentCancelView,
    MSPaymentDetailView,
    MSPaymentTestView,
    MSPaymentSuccessPageView,
    MSPaymentFailPageView,
)
from .views.train import (
    MSTrainSearchView,
    MSKorailLinkView,
)

app_name = 'reservations_api'

urlpatterns = [
    # 예약 생성 API
    # POST /api/v1/reservations/flight
    path(
        'reservations/flight',
        MSReservationCreateView.as_view(),
        name='reservation-create-flight'
    ),

    # TODO: 내 예약 목록 (마이페이지)
    # GET /api/v1/my/reservations
    # path('my/reservations', MSMyReservationListView.as_view(), name='my-reservations'),

    # TODO: 내 예약 상세
    # GET /api/v1/my/reservations/{reservationId}
    # path('my/reservations/<uuid:reservation_id>', MSMyReservationDetailView.as_view(), name='my-reservation-detail'),

    # ========================================
    # 기차 API
    # ========================================
    # 기차 검색
    # GET/POST /api/v1/transport/trains/search
    path(
        'transport/trains/search',
        MSTrainSearchView.as_view(),
        name='train-search'
    ),

    # 코레일 외부 링크 생성
    # GET /api/v1/transport/trains/korail-link
    path(
        'transport/trains/korail-link',
        MSKorailLinkView.as_view(),
        name='train-korail-link'
    ),

    # ========================================
    # 결제 API
    # ========================================
    # 결제 생성
    # POST /api/v1/payments/
    path(
        'payments/',
        MSPaymentCreateView.as_view(),
        name='payment-create'
    ),

    # 결제 승인
    # POST /api/v1/payments/confirm/
    path(
        'payments/confirm/',
        MSPaymentConfirmView.as_view(),
        name='payment-confirm'
    ),

    # 결제 취소
    # POST /api/v1/payments/{payment_key}/cancel/
    path(
        'payments/<str:payment_key>/cancel/',
        MSPaymentCancelView.as_view(),
        name='payment-cancel'
    ),

    # 결제 상세 조회
    # GET /api/v1/payments/{order_id}/
    path(
        'payments/<str:order_id>/',
        MSPaymentDetailView.as_view(),
        name='payment-detail'
    ),
]

# ========================================
# 테스트용 HTML 페이지 (개발 환경에서만 활성화)
# ========================================
# DEBUG 모드일 때만 테스트 페이지를 사용할 수 있어요
# 배포 환경(DEBUG=False)에서는 자동으로 비활성화됩니다
if settings.DEBUG:
    urlpatterns += [
        # 결제 테스트 페이지
        # GET /api/v1/payments/test
        path(
            'payments/test',
            MSPaymentTestView.as_view(),
            name='payment-test'
        ),

        # 결제 성공 페이지
        # GET /api/v1/payments/success
        path(
            'payments/success',
            MSPaymentSuccessPageView.as_view(),
            name='payment-success-page'
        ),

        # 결제 실패 페이지
        # GET /api/v1/payments/fail
        path(
            'payments/fail',
            MSPaymentFailPageView.as_view(),
            name='payment-fail-page'
        ),
    ]
