"""
항공편 검색 API 뷰
- POST /api/v1/transport/flights/search
- GET /api/v1/transport/flights/{offerId}
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema, OpenApiParameter
import logging

from ..serializers.flight import (
    MSFlightSearchRequestSerializer,
    MSFlightSearchResponseSerializer,
    MSFlightDetailResponseSerializer,
    MSAirportListResponseSerializer,
    MSAirlineListResponseSerializer
)
from ..services.flight.api_service import MSFlightAPIService

logger = logging.getLogger(__name__)


class MSFlightSearchView(APIView):
    """
    항공편 검색 API

    POST /api/v1/transport/flights/search

    인증: 선택 (비회원도 검색 가능)
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    @extend_schema(
        tags=['항공'],
        request=MSFlightSearchRequestSerializer,
        responses={200: MSFlightSearchResponseSerializer},
        description="항공편 검색 API - 출발지, 도착지, 날짜 등을 입력하여 항공편을 검색합니다.",
        summary="항공편 검색"
    )
    def post(self, request):
        """
        항공편 검색

        요청 예시:
        {
            "tripType": "ROUNDTRIP",
            "from_airport": "GMP",
            "to": "CJU",
            "departDate": "2025-01-15",
            "returnDate": "2025-01-20",
            "passengers": {
                "adults": 2,
                "children": 0,
                "infants": 0
            },
            "cabinClass": "ECONOMY"
        }

        응답 예시:
        {
            "searchId": "uuid",
            "currency": "KRW",
            "results": [...]
        }
        """
        # 1. 요청 데이터 검증
        serializer = MSFlightSearchRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "error": "잘못된 요청입니다.",
                    "details": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 검증된 데이터 가져오기
        validated_data = serializer.validated_data

        # 3. 항공편 검색 서비스 호출
        try:
            service = MSFlightAPIService()
            result = service.ms_search_flights(
                from_airport=validated_data['from'],
                to_airport=validated_data['to'],
                depart_date=validated_data['departDate'],
                trip_type=validated_data['tripType'],
                return_date=validated_data.get('returnDate'),
                adults=validated_data['passengers']['adults'],
                children=validated_data['passengers']['children'],
                infants=validated_data['passengers']['infants'],
                cabin_class=validated_data['cabinClass'],
                # 필터/정렬 옵션 추가 (있으면 전달, 없으면 None)
                filters=validated_data.get('filters'),
                sort=validated_data.get('sort')
            )

            # 4. 응답 데이터 직렬화
            response_serializer = MSFlightSearchResponseSerializer(data=result)

            if response_serializer.is_valid():
                return Response(
                    response_serializer.data,
                    status=status.HTTP_200_OK
                )
            else:
                # 응답 데이터 형식 오류 (내부 오류)
                logger.error(f"응답 데이터 직렬화 실패: {response_serializer.errors}")
                return Response(
                    {"error": "검색 결과 처리 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"항공편 검색 중 오류: {e}", exc_info=True)
            return Response(
                {"error": "항공편 검색 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MSFlightDetailView(APIView):
    """
    항공편 상세 조회 API

    GET /api/v1/transport/flights/{offerId}

    인증: 선택 (비회원도 조회 가능)
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['항공'],
        responses={200: MSFlightDetailResponseSerializer},
        summary="항공편 상세 조회",
        description="항공편의 상세 정보(좌석, 수하물, 환불규정 등)를 조회합니다."
    )
    def get(self, request, offer_id):
        """
        항공편 상세 정보 조회

        URL: /api/v1/transport/flights/{offerId}

        Query Parameters:
        - lang: 언어 (기본값: en)

        응답 예시:
        {
            "offerId": "...",
            "segments": [...],
            "baggageInfo": "...",
            "refundRule": "...",
            "priceBreakdown": {...}
        }
        """
        try:
            # TODO: offerId로 항공편 상세 정보 조회
            # 현재는 Mock 데이터 반환

            lang = request.query_params.get('lang', 'en')

            # Mock 응답
            detail_data = {
                "offerId": offer_id,
                "segments": [
                    {
                        "flightNo": "OZ8141",
                        "airline": "아시아나항공",
                        "depAt": "2025-01-15T09:00:00",
                        "arrAt": "2025-01-15T10:10:00",
                        "durationMin": 70,
                        "direction": "OUTBOUND"
                    }
                ],
                "baggageInfo": "위탁 수하물 1개 (23kg), 기내 수하물 1개 (10kg)",
                "refundRule": "출발 24시간 전: 무료 취소, 그 이후: 수수료 부과",
                "priceBreakdown": {
                    "baseFare": 50000,
                    "tax": 10000,
                    "fuel": 5000,
                    "total": 65000
                }
            }

            serializer = MSFlightDetailResponseSerializer(data=detail_data)

            if serializer.is_valid():
                return Response(
                    serializer.data,
                    status=status.HTTP_200_OK
                )
            else:
                logger.error(f"상세 정보 직렬화 실패: {serializer.errors}")
                return Response(
                    {"error": "상세 정보 조회 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"항공편 상세 조회 중 오류: {e}", exc_info=True)
            return Response(
                {"error": "상세 정보 조회 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MSAirportListView(APIView):
    """
    공항 목록 조회 API (보너스)

    GET /api/v1/transport/airports

    React에서 공항 선택 시 사용
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['항공'],
        summary="공항 목록 조회",
        description="국내 주요 공항 목록을 조회합니다. 프론트엔드에서 공항 선택 시 사용합니다.",
        responses={200: MSAirportListResponseSerializer}
    )
    def get(self, request):
        """
        공항 목록 조회

        응답 예시:
        {
            "airports": [
                {
                    "iataCode": "GMP",
                    "nameEn": "Gimpo International Airport",
                    "nameKo": "김포국제공항",
                    "cityEn": "Seoul",
                    "cityKo": "서울"
                },
                ...
            ]
        }
        """
        # 주요 국내 공항 목록
        airports = [
            {
                "iataCode": "GMP",
                "nameEn": "Gimpo International Airport",
                "nameKo": "김포국제공항",
                "nameJa": "金浦国際空港",
                "nameZh": "金浦国际机场",
                "cityEn": "Seoul",
                "cityKo": "서울",
                "cityJa": "ソウル",
                "cityZh": "首尔"
            },
            {
                "iataCode": "CJU",
                "nameEn": "Jeju International Airport",
                "nameKo": "제주국제공항",
                "nameJa": "済州国際空港",
                "nameZh": "济州国际机场",
                "cityEn": "Jeju",
                "cityKo": "제주",
                "cityJa": "済州",
                "cityZh": "济州"
            },
            {
                "iataCode": "PUS",
                "nameEn": "Gimhae International Airport",
                "nameKo": "김해국제공항",
                "nameJa": "金海国際空港",
                "nameZh": "金海国际机场",
                "cityEn": "Busan",
                "cityKo": "부산",
                "cityJa": "釜山",
                "cityZh": "釜山"
            },
            {
                "iataCode": "TAE",
                "nameEn": "Daegu International Airport",
                "nameKo": "대구국제공항",
                "nameJa": "大邱国際空港",
                "nameZh": "大邱国际机场",
                "cityEn": "Daegu",
                "cityKo": "대구",
                "cityJa": "大邱",
                "cityZh": "大邱"
            },
            {
                "iataCode": "KWJ",
                "nameEn": "Gwangju Airport",
                "nameKo": "광주공항",
                "nameJa": "光州空港",
                "nameZh": "光州机场",
                "cityEn": "Gwangju",
                "cityKo": "광주",
                "cityJa": "光州",
                "cityZh": "光州"
            },
        ]

        return Response(
            {"airports": airports},
            status=status.HTTP_200_OK
        )


class MSAirlineListView(APIView):
    """
    항공사 목록 조회 API

    GET /api/v1/transport/airlines

    React에서 항공사 선택 시 사용
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['항공'],
        summary="항공사 목록 조회",
        description="국내 주요 항공사 목록을 조회합니다. 프론트엔드에서 항공사 선택 시 사용합니다.",
        responses={200: MSAirlineListResponseSerializer}
    )
    def get(self, request):
        """
        항공사 목록 조회

        응답 예시:
        {
            "airlines": [
                {
                    "code": "KE",
                    "nameKo": "대한항공",
                    "nameEn": "Korean Air"
                },
                ...
            ]
        }
        """
        # 주요 국내 항공사 목록
        airlines = [
            {
                "code": "KE",
                "nameKo": "대한항공",
                "nameEn": "Korean Air"
            },
            {
                "code": "OZ",
                "nameKo": "아시아나항공",
                "nameEn": "Asiana Airlines"
            },
            {
                "code": "7C",
                "nameKo": "제주항공",
                "nameEn": "Jeju Air"
            },
            {
                "code": "TW",
                "nameKo": "티웨이항공",
                "nameEn": "T'way Air"
            },
            {
                "code": "LJ",
                "nameKo": "진에어",
                "nameEn": "Jin Air"
            },
            {
                "code": "BX",
                "nameKo": "에어부산",
                "nameEn": "Air Busan"
            },
        ]

        return Response(
            {"airlines": airlines},
            status=status.HTTP_200_OK
        )
