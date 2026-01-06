"""
예약 API URL 라우팅

Base: /api/v1/reservations/
"""
from django.urls import path
from .views.reservation import MSReservationCreateView

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
]
