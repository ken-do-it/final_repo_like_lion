"""
지하철 API 뷰
지하철 경로 검색 및 노선도 정보를 제공합니다.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter

from ..services.subway import MSSubwayAPIService
from ..services.subway.api_service import SubwayError
from ..serializers.subway import (
    MSSubwayRouteRequestSerializer,
    MSSubwayRouteResponseSerializer,
    MSSubwayMapMetaRequestSerializer,
    MSSubwayMapMetaResponseSerializer,
)


class MSSubwayRouteView(APIView):
    """
    지하철 경로 검색 API

    출발역과 도착역을 입력하면 최적의 경로를 제공합니다.
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    @extend_schema(
        summary="지하철 경로 검색",
        description="""
        출발역과 도착역을 기반으로 지하철 경로를 검색합니다.
        최대 3개의 경로를 반환하며, 옵션에 따라 정렬됩니다.

        - FAST: 최단 시간 경로
        - FEW_TRANSFER: 최소 환승 경로
        - CHEAP: 최저 요금 경로

        주의: powered by www.ODsay.com
        """,
        parameters=[
            OpenApiParameter(
                name="fromStation",
                type=str,
                location=OpenApiParameter.QUERY,
                description="출발역 이름 (예: 강남, 강남역)",
                required=True,
            ),
            OpenApiParameter(
                name="toStation",
                type=str,
                location=OpenApiParameter.QUERY,
                description="도착역 이름 (예: 홍대입구, 홍대입구역)",
                required=True,
            ),
            OpenApiParameter(
                name="option",
                type=str,
                location=OpenApiParameter.QUERY,
                description="경로 옵션: FAST(최단시간), FEW_TRANSFER(최소환승), CHEAP(최소비용)",
                required=False,
                enum=["FAST", "FEW_TRANSFER", "CHEAP"],
            ),
        ],
        responses={
            200: MSSubwayRouteResponseSerializer,
            400: {"description": "잘못된 요청 파라미터"},
            404: {"description": "역을 찾을 수 없거나 경로가 없음"},
            502: {"description": "외부 API 오류"},
        },
    )
    def get(self, request):
        """
        지하철 경로 검색

        Query Parameters:
            fromStation: 출발역 이름
            toStation: 도착역 이름
            option: 경로 옵션 (FAST, FEW_TRANSFER, CHEAP)

        Returns:
            200: 경로 목록 (최대 3개)
            400: 잘못된 요청
            404: 역을 찾을 수 없음
            502: 외부 API 오류
        """
        # 요청 파라미터 검증
        serializer = MSSubwayRouteRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "요청 파라미터가 올바르지 않습니다.",
                        "details": serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 파라미터 추출
        from_station = serializer.validated_data["fromStation"]
        to_station = serializer.validated_data["toStation"]
        option = serializer.validated_data.get("option", "FAST")

        # 호출 수 줄이기 위한 선택 파라미터들
        from_lat = serializer.validated_data.get("fromLat")
        from_lng = serializer.validated_data.get("fromLng")
        to_lat = serializer.validated_data.get("toLat")
        to_lng = serializer.validated_data.get("toLng")

        include_raw = serializer.validated_data.get("include", "") or ""
        include_tokens = {t.strip().lower() for t in include_raw.split(',') if t.strip()}
        include_stops = 'stops' in include_tokens

        try:
            # 지하철 경로 검색
            service = MSSubwayAPIService()
            result = service.ms_search_subway_route(
                from_station=from_station,
                to_station=to_station,
                option=option,
                from_lat=from_lat,
                from_lng=from_lng,
                to_lat=to_lat,
                to_lng=to_lng,
                include_stops=include_stops,
            )

            # 응답 반환
            response_serializer = MSSubwayRouteResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except SubwayError as e:
            # 지하철 관련 에러
            if e.code == "SUBWAY_001":  # 역을 찾을 수 없음
                status_code = status.HTTP_404_NOT_FOUND
            elif e.code == "SUBWAY_002":  # 경로 없음
                status_code = status.HTTP_404_NOT_FOUND
            else:  # 외부 API 오류
                status_code = status.HTTP_502_BAD_GATEWAY

            return Response(
                {
                    "success": False,
                    "error": {
                        "code": e.code,
                        "message": e.message
                    }
                },
                status=status_code
            )

        except Exception as e:
            # 예상치 못한 에러
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "서버 내부 오류가 발생했습니다."
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MSSubwayMapMetaView(APIView):
    """
    지하철 노선도 메타 정보 API

    도시별 노선도 이미지 URL과 버전 정보를 제공합니다.
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    # 도시별 노선도 정보 (정적 데이터)
    SUBWAY_MAP_DATA = {
        "SEOUL": {
            "mapUrl": "https://www.seoulmetro.co.kr/kr/page.do?menuIdx=548",
            "version": "2024.01"
        },
        "BUSAN": {
            "mapUrl": "http://www.humetro.busan.kr/default.htm",
            "version": "2024.01"
        },
        "DAEGU": {
            "mapUrl": "http://www.dtro.or.kr/",
            "version": "2024.01"
        },
        "GWANGJU": {
            "mapUrl": "https://www.gwangju-metro1.co.kr/",
            "version": "2024.01"
        },
        "DAEJEON": {
            "mapUrl": "https://www.djet.co.kr/",
            "version": "2024.01"
        }
    }

    @extend_schema(
        summary="지하철 노선도 메타 정보",
        description="""
        도시별 지하철 노선도 URL과 버전 정보를 제공합니다.
        실제 노선도 이미지는 각 도시 지하철 공사 웹사이트에서 확인할 수 있습니다.
        """,
        parameters=[
            OpenApiParameter(
                name="city",
                type=str,
                location=OpenApiParameter.QUERY,
                description="도시 선택",
                required=True,
                enum=["SEOUL", "BUSAN", "DAEGU", "GWANGJU", "DAEJEON"],
            ),
        ],
        responses={
            200: MSSubwayMapMetaResponseSerializer,
            400: {"description": "잘못된 요청 파라미터"},
            404: {"description": "해당 도시의 노선도 정보 없음"},
        },
    )
    def get(self, request):
        """
        노선도 메타 정보 조회

        Query Parameters:
            city: 도시 코드 (SEOUL, BUSAN, DAEGU, GWANGJU, DAEJEON)

        Returns:
            200: 노선도 URL 및 버전 정보
            400: 잘못된 요청
            404: 해당 도시 정보 없음
        """
        # 요청 파라미터 검증
        serializer = MSSubwayMapMetaRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "요청 파라미터가 올바르지 않습니다.",
                        "details": serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        city = serializer.validated_data["city"]

        # 노선도 정보 조회
        map_data = self.SUBWAY_MAP_DATA.get(city)
        if not map_data:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "MAP_NOT_FOUND",
                        "message": "해당 도시의 노선도 정보를 찾을 수 없습니다."
                    }
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # 응답 반환
        response_serializer = MSSubwayMapMetaResponseSerializer(map_data)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
