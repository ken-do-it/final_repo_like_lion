"""
예약 API URL 라우팅

Base: /api/v1/
"""
from django.urls import path
from .views.reservation import MSReservationCreateView
from .views.payment import (
    MSPaymentCreateView,
    MSPaymentConfirmView,
    MSPaymentCancelView,
    MSPaymentDetailView,
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
