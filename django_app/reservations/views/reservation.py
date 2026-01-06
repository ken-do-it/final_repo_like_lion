"""
예약 생성 API View
- POST /api/v1/reservations/flight
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging

from ..serializers.reservation import (
    MSReservationCreateRequestSerializer,
    MSReservationCreateResponseSerializer
)
from ..services.reservation_service import MSReservationService
from ..services.flight.api_service import MSFlightAPIService

logger = logging.getLogger(__name__)


class MSReservationCreateView(APIView):
    """
    항공편 예약 생성 API

    POST /api/v1/reservations/flight

    인증: 필수 (로그인한 사용자만 예약 가능)

    동작 순서:
    1. 요청 데이터 검증 (승객 정보, offerId 등)
    2. offerId로 항공편 정보 조회 (검색 결과에서 가져옴)
    3. 예약 생성 Service 호출
    4. 생성된 예약 정보 반환
    """
    permission_classes = [IsAuthenticated]  # 로그인 필수

    def post(self, request):
        """
        예약 생성

        요청 예시:
        {
            "offerId": "abc123",
            "tripType": "ONEWAY",
            "cabinClass": "ECONOMY",
            "passengers": [
                {
                    "passengerType": "ADT",
                    "fullName": "홍길동",
                    "birthDate": "1990-01-01",
                    "passportNo": "M12345678"
                }
            ],
            "contacts": {
                "contactEmail": "test@example.com",
                "contactPhone": "010-1234-5678"
            },
            "requests": {
                "specialRequest": "채식 기내식"
            },
            "seatSelections": [
                {
                    "direction": "OUTBOUND",
                    "segmentNo": 1,
                    "seatNo": "12A"
                }
            ]
        }

        응답 예시:
        {
            "reservationId": "uuid",
            "testOrderNo": "FLT_1704441234567_ABCD1234"
        }
        """
        # 1. 요청 데이터 검증
        serializer = MSReservationCreateRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "error": "잘못된 요청입니다.",
                    "details": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data

        # 2. offerId로 항공편 정보 조회
        # TODO: 실제로는 검색 캐시에서 가져오거나, 다시 조회해야 함
        # 지금은 Mock 데이터로 대체
        flight_data = self._ms_get_flight_data_mock(
            validated_data['offerId'],
            validated_data['tripType']
        )

        # 3. 예약 생성 Service 호출
        try:
            service = MSReservationService()

            reservation = service.ms_create_flight_reservation(
                user=request.user,
                offer_id=validated_data['offerId'],
                trip_type=validated_data['tripType'],
                cabin_class=validated_data['cabinClass'],
                passengers=validated_data['passengers'],
                flight_data=flight_data,
                contacts=validated_data.get('contacts'),
                requests=validated_data.get('requests'),
                seat_selections=validated_data.get('seatSelections')
            )

            # 4. 응답 데이터 생성
            response_data = {
                "reservationId": str(reservation.id),
                "testOrderNo": reservation.test_order_no
            }

            response_serializer = MSReservationCreateResponseSerializer(data=response_data)

            if response_serializer.is_valid():
                logger.info(f"[OK] 예약 생성 성공: {reservation.id} (User: {request.user.id})")

                return Response(
                    response_serializer.data,
                    status=status.HTTP_201_CREATED
                )
            else:
                logger.error(f"응답 데이터 직렬화 실패: {response_serializer.errors}")
                return Response(
                    {"error": "예약 생성 중 오류가 발생했습니다."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"예약 생성 중 오류: {e}", exc_info=True)
            return Response(
                {"error": "예약 생성 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _ms_get_flight_data_mock(self, offer_id: str, trip_type: str) -> dict:
        """
        항공편 정보 Mock 데이터 생성

        실제로는:
        - 검색 결과 캐시에서 가져오거나
        - offerId로 다시 조회해야 함

        Args:
            offer_id: Offer ID
            trip_type: 편도/왕복

        Returns:
            항공편 정보
        """
        from datetime import datetime, timedelta

        # 기본 정보
        base_date = datetime.now() + timedelta(days=7)

        # 편도인 경우
        if trip_type == 'ONEWAY':
            return {
                "offerId": offer_id,
                "airline": "대한항공",
                "flightNo": "KE1234",
                "depAirport": "GMP",
                "arrAirport": "CJU",
                "depAt": base_date.isoformat(),
                "arrAt": (base_date + timedelta(hours=1)).isoformat(),
                "durationMin": 60,
                "pricePerPerson": 65000,
                "totalPrice": 65000,
                "currency": "KRW",
                "seatAvailabilityNote": "10석 남음"
            }

        # 왕복인 경우
        else:
            return {
                "offerId": offer_id,
                "tripType": "ROUNDTRIP",
                "outbound": {
                    "airline": "대한항공",
                    "flightNo": "KE1234",
                    "depAirport": "GMP",
                    "arrAirport": "CJU",
                    "depAt": base_date.isoformat(),
                    "arrAt": (base_date + timedelta(hours=1)).isoformat(),
                    "durationMin": 60,
                    "pricePerPerson": 65000
                },
                "inbound": {
                    "airline": "대한항공",
                    "flightNo": "KE5678",
                    "depAirport": "CJU",
                    "arrAirport": "GMP",
                    "depAt": (base_date + timedelta(days=3)).isoformat(),
                    "arrAt": (base_date + timedelta(days=3, hours=1)).isoformat(),
                    "durationMin": 60,
                    "pricePerPerson": 65000
                },
                "totalPrice": 130000,
                "currency": "KRW"
            }
