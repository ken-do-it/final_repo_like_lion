"""
기차 검색 API 뷰
- GET/POST /api/v1/transport/trains/search (기차 검색)
- GET /api/v1/transport/trains/korail-link (코레일 외부 링크 생성)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from django.core.cache import cache
import logging
import hashlib
import json

from ..serializers.train import (
    MSTrainSearchRequestSerializer,
    MSTrainSearchResponseSerializer,
    MSKorailLinkRequestSerializer,
    MSKorailLinkResponseSerializer
)
from ..services.train.api_service import MSTrainAPIService
from ..services.train.redirect_service import MSKorailRedirectService

logger = logging.getLogger(__name__)


class MSTrainSearchView(APIView):
    """
    기차 검색 API

    GET/POST /api/v1/transport/trains/search

    인증: 선택 (비회원도 검색 가능)
    """
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    @extend_schema(
        tags=['기차'],
        request=MSTrainSearchRequestSerializer,
        responses={200: MSTrainSearchResponseSerializer},
        summary="기차 검색",
        description=(
            "출발역, 도착역, 출발일을 입력하여 기차를 검색합니다.\n\n"
            "**주요 기능**:\n"
            "- KTX, SRT, ITX, 무궁화 등 전체 열차 검색\n"
            "- 차량종류별 필터링 지원\n"
            "- 검색 결과 캐싱 (15분)\n\n"
            "**참고**: 실제 예약은 코레일 외부 사이트에서 진행됩니다."
        ),
        examples=[
            OpenApiExample(
                name="기본 검색",
                value={
                    "fromStation": "서울",
                    "toStation": "부산",
                    "departDate": "2025-01-15",
                    "passengers": 2
                },
                request_only=True,
            ),
            OpenApiExample(
                name="시간 지정 검색",
                value={
                    "fromStation": "서울",
                    "toStation": "부산",
                    "departDate": "2025-01-15",
                    "departTime": "14:00",
                    "passengers": 1
                },
                request_only=True,
            ),
            OpenApiExample(
                name="KTX만 검색",
                value={
                    "fromStation": "서울",
                    "toStation": "부산",
                    "departDate": "2025-01-15",
                    "passengers": 1,
                    "filters": {
                        "trainType": "KTX"
                    }
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        """
        기차 검색 (POST)

        요청 예시:
        {
            "fromStation": "서울",
            "toStation": "부산",
            "departDate": "2025-01-15",
            "passengers": 2,
            "filters": {
                "trainType": "KTX"
            }
        }

        응답 예시:
        {
            "results": [
                {
                    "trainNo": "001",
                    "trainType": "KTX",
                    "departureStation": "서울",
                    "arrivalStation": "부산",
                    "departureTime": "08:00",
                    "arrivalTime": "10:45",
                    "duration": "2시간 45분",
                    "adultFare": 59800
                }
            ],
            "totalCount": 15
        }
        """
        # 1. 요청 데이터 검증
        serializer = MSTrainSearchRequestSerializer(data=request.data)

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

        # 3. 캐시 키 생성 (검색 조건으로 해시)
        cache_key = self._ms_generate_cache_key(validated_data)

        # 4. 캐시에서 검색 결과 확인
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"캐시에서 기차 검색 결과 반환: {cache_key}")
            return Response(cached_result, status=status.HTTP_200_OK)

        # 5. 기차 검색 서비스 호출
        try:
            service = MSTrainAPIService()
            result = service.ms_search_trains(
                from_station=validated_data['fromStation'],
                to_station=validated_data['toStation'],
                depart_date=validated_data['departDate'],
                depart_time=validated_data.get('departTime'),  # 시간 정보 추가
                passengers=validated_data.get('passengers', 1),
                filters=validated_data.get('filters')
            )

            # 6. 응답 검증
            response_serializer = MSTrainSearchResponseSerializer(data=result)
            if not response_serializer.is_valid():
                logger.error(f"응답 검증 실패: {response_serializer.errors}")
                return Response(
                    {"error": "검색 결과 처리 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 7. 캐시에 저장 (15분)
            cache.set(cache_key, response_serializer.data, 60 * 15)

            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"기차 검색 중 오류 발생: {e}", exc_info=True)
            return Response(
                {"error": "기차 검색 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        tags=['기차'],
        parameters=[
            OpenApiParameter(
                name='fromStation',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발역 이름',
                required=True
            ),
            OpenApiParameter(
                name='toStation',
                type=str,
                location=OpenApiParameter.QUERY,
                description='도착역 이름',
                required=True
            ),
            OpenApiParameter(
                name='departDate',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발일 (YYYY-MM-DD)',
                required=True
            ),
            OpenApiParameter(
                name='departTime',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발 시간 (HH:MM, 선택사항)',
                required=False
            ),
            OpenApiParameter(
                name='passengers',
                type=int,
                location=OpenApiParameter.QUERY,
                description='승객 수 (기본값: 1)',
                required=False
            ),
        ],
        responses={200: MSTrainSearchResponseSerializer},
        summary="기차 검색 (GET)",
        description="쿼리 파라미터로 기차를 검색합니다. POST 방식 사용을 권장합니다."
    )
    def get(self, request):
        """
        기차 검색 (GET)

        쿼리 파라미터:
        - fromStation: 출발역
        - toStation: 도착역
        - departDate: 출발일 (YYYY-MM-DD)
        - passengers: 승객 수 (옵션)
        """
        # GET 요청을 POST와 동일하게 처리하기 위해 데이터 변환
        data = {
            'fromStation': request.query_params.get('fromStation'),
            'toStation': request.query_params.get('toStation'),
            'departDate': request.query_params.get('departDate'),
            'departTime': request.query_params.get('departTime'),  # 시간 정보 추가
            'passengers': request.query_params.get('passengers', 1),
        }

        # POST 메서드와 동일한 로직 사용
        serializer = MSTrainSearchRequestSerializer(data=data)

        if not serializer.is_valid():
            return Response(
                {
                    "error": "잘못된 요청입니다.",
                    "details": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data

        # 캐시 확인
        cache_key = self._ms_generate_cache_key(validated_data)
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"캐시에서 기차 검색 결과 반환: {cache_key}")
            return Response(cached_result, status=status.HTTP_200_OK)

        # 서비스 호출
        try:
            service = MSTrainAPIService()
            result = service.ms_search_trains(
                from_station=validated_data['fromStation'],
                to_station=validated_data['toStation'],
                depart_date=validated_data['departDate'],
                depart_time=validated_data.get('departTime'),  # 시간 정보 추가
                passengers=validated_data.get('passengers', 1),
                filters=validated_data.get('filters')
            )

            response_serializer = MSTrainSearchResponseSerializer(data=result)
            if not response_serializer.is_valid():
                logger.error(f"응답 검증 실패: {response_serializer.errors}")
                return Response(
                    {"error": "검색 결과 처리 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 캐시 저장
            cache.set(cache_key, response_serializer.data, 60 * 15)

            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"기차 검색 중 오류 발생: {e}", exc_info=True)
            return Response(
                {"error": "기차 검색 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _ms_generate_cache_key(self, validated_data: dict) -> str:
        """
        검색 조건으로 캐시 키 생성

        Args:
            validated_data: 검증된 검색 조건

        Returns:
            캐시 키 (해시)
        """
        # 검색 조건을 JSON 문자열로 변환하고 해시 생성
        search_params = {
            'fromStation': validated_data['fromStation'],
            'toStation': validated_data['toStation'],
            'departDate': str(validated_data['departDate']),
            'departTime': str(validated_data.get('departTime')) if validated_data.get('departTime') else None,  # 시간 정보 추가
            'passengers': validated_data.get('passengers', 1),
            'filters': validated_data.get('filters', {})
        }

        # JSON 문자열로 변환 (정렬하여 일관성 유지)
        json_str = json.dumps(search_params, sort_keys=True)

        # MD5 해시 생성
        hash_obj = hashlib.md5(json_str.encode('utf-8'))
        cache_key = f"train_search:{hash_obj.hexdigest()}"

        return cache_key


class MSKorailLinkView(APIView):
    """
    코레일 외부 이동 링크 생성 API

    GET /api/v1/transport/trains/korail-link

    인증: 선택 (비회원도 사용 가능)
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['기차'],
        parameters=[
            OpenApiParameter(
                name='from',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발역 이름',
                required=True
            ),
            OpenApiParameter(
                name='to',
                type=str,
                location=OpenApiParameter.QUERY,
                description='도착역 이름',
                required=True
            ),
            OpenApiParameter(
                name='departDate',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발일 (YYYY-MM-DD)',
                required=True
            ),
            OpenApiParameter(
                name='departTime',
                type=str,
                location=OpenApiParameter.QUERY,
                description='출발 시간 (HH:MM, 선택사항)',
                required=False
            ),
            OpenApiParameter(
                name='passengers',
                type=int,
                location=OpenApiParameter.QUERY,
                description='승객 수 (기본값: 1)',
                required=False
            ),
        ],
        responses={200: MSKorailLinkResponseSerializer},
        summary="코레일 외부 링크 생성",
        description=(
            "검색 조건을 바탕으로 코레일 예약 페이지 URL을 생성합니다.\n\n"
            "**사용 시나리오**:\n"
            "1. 사용자가 기차 검색 결과에서 원하는 열차 선택\n"
            "2. 이 API로 코레일 예약 URL 생성\n"
            "3. 프론트엔드에서 해당 URL로 리다이렉트\n"
            "4. 코레일 사이트에서 실제 예약 진행\n\n"
            "**참고**: 외국인 관광객은 Korail Pass 구매를 권장합니다."
        ),
    )
    def get(self, request):
        """
        코레일 예약 페이지 링크 생성

        쿼리 파라미터:
        - from: 출발역
        - to: 도착역
        - departDate: 출발일 (YYYY-MM-DD)
        - passengers: 승객 수 (옵션)

        응답 예시:
        {
            "url": "https://www.letskorail.com/..."
        }
        """
        # 1. 요청 데이터 검증
        data = {
            'from': request.query_params.get('from'),
            'to': request.query_params.get('to'),
            'departDate': request.query_params.get('departDate'),
            'departTime': request.query_params.get('departTime'),  # 시간 정보 추가
            'passengers': request.query_params.get('passengers', 1),
        }

        serializer = MSKorailLinkRequestSerializer(data=data)

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

        # 3. 코레일 링크 생성 서비스 호출
        try:
            service = MSKorailRedirectService()
            url = service.ms_generate_korail_link(
                from_station=validated_data['from'],
                to_station=validated_data['to'],
                depart_date=validated_data['departDate'],
                depart_time=validated_data.get('departTime'),  # 시간 정보 추가
                passengers=validated_data.get('passengers', 1)
            )

            # 4. 응답 검증
            response_data = {"url": url}
            response_serializer = MSKorailLinkResponseSerializer(data=response_data)

            if not response_serializer.is_valid():
                logger.error(f"응답 검증 실패: {response_serializer.errors}")
                return Response(
                    {"error": "링크 생성 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"코레일 링크 생성 중 오류 발생: {e}", exc_info=True)
            return Response(
                {"error": "링크 생성 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
