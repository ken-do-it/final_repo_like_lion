"""
교통(항공/기차/지하철) API URL 라우팅

Base: /api/v1/transport/
"""
from django.urls import path
from .views.flight import (
    MSFlightSearchView,
    MSFlightDetailView,
    MSAirportListView
)

app_name = 'reservations'

urlpatterns = [
    # 항공 API
    path(
        'flights/search/',
        MSFlightSearchView.as_view(),
        name='flight-search'
    ),
    path(
        'flights/<str:offer_id>/',
        MSFlightDetailView.as_view(),
        name='flight-detail'
    ),

    # 공항 목록 (보너스)
    path(
        'airports/',
        MSAirportListView.as_view(),
        name='airport-list'
    ),

    # TODO: 기차 API
    # path('trains/search/', MSTrainSearchView.as_view(), name='train-search'),

    # TODO: 지하철 API
    # path('subway/route/', MSSubwayRouteView.as_view(), name='subway-route'),
]
