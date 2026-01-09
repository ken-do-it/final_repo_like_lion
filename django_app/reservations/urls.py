"""
교통(항공/기차/지하철) API URL 라우팅

Base: /api/v1/transport/
"""
from django.urls import path

# 항공 관련 뷰 (화면)
from .views.flight import (
    MSFlightSearchView,
    MSFlightDetailView,
    MSAirportListView
)

# 기차 관련 뷰 (화면)
from .views.train import (
    MSTrainSearchView,      # 기차 검색
    MSKorailLinkView        # 코레일 외부 링크 생성
)

# 지하철 관련 뷰 (화면)
from .views.subway import (
    MSSubwayRouteView,      # 지하철 경로 검색
    MSSubwayMapMetaView     # 노선도 메타 정보
)

app_name = 'reservations'

urlpatterns = [
    # ============================================
    # 항공 API
    # ============================================
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

    # ============================================
    # 기차 API
    # ============================================
    # 기차 검색 API
    # GET/POST /api/v1/transport/trains/search/
    # 출발역, 도착역, 날짜, 시간으로 기차 검색
    path(
        'trains/search/',
        MSTrainSearchView.as_view(),
        name='train-search'
    ),

    # 코레일 외부 링크 생성 API
    # GET /api/v1/transport/trains/korail-link/
    # 코레일 예약 페이지로 이동하는 URL 생성
    path(
        'trains/korail-link/',
        MSKorailLinkView.as_view(),
        name='korail-link'
    ),

    # ============================================
    # 지하철 API
    # ============================================
    # 지하철 경로 검색 API
    # GET /api/v1/transport/subway/route/
    # 출발역, 도착역, 옵션(최단시간/최소환승/최소비용)으로 경로 검색
    path(
        'subway/route/',
        MSSubwayRouteView.as_view(),
        name='subway-route'
    ),

    # 노선도 메타 정보 API (선택사항)
    # GET /api/v1/transport/subway/map-meta/
    # 도시별 노선도 URL 및 버전 정보 제공
    path(
        'subway/map-meta/',
        MSSubwayMapMetaView.as_view(),
        name='subway-map-meta'
    ),
]
