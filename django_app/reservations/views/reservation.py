"""
예약 생성 API View
- POST /api/v1/reservations/flight
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiExample
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

    # Swagger(스웨거)에게 이 API가 어떤 JSON을 받아/내보내는지 알려줍니다.
    # 이렇게 해야 Swagger UI에서 요청 바디 입력창이 생겨요!
    @extend_schema(
        tags=['항공'],
        request=MSReservationCreateRequestSerializer,
        responses={201: MSReservationCreateResponseSerializer},
        summary="항공편 예약 생성",
        description=(
            "선택한 항공편(offerId)와 승객/연락처/요청사항/좌석선택 정보를 받아 예약을 생성합니다.\n"
            "인증이 필요합니다(로그인 필요)."
        ),
        examples=[
            OpenApiExample(
                name="ReservationCreateExample",
                value={
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
                },
                request_only=True,
            )
        ],
    )
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

        # 2. 항공편 정보 가져오기
        # [수정됨] 프론트엔드에서 보낸 실제 데이터를 사용합니다!
        # flightData가 없으면 Mock 데이터를 사용 (하위 호환성)
        if validated_data.get('flightData'):
            # 프론트엔드에서 보낸 실제 항공편 정보 사용
            flight_data = self._ms_convert_flight_data(
                validated_data['flightData'],
                validated_data['tripType']
            )
            logger.info(f"[OK] 실제 항공편 데이터 사용: {flight_data.get('depAirport')} → {flight_data.get('arrAirport')}")
        else:
            # 이전 버전 호환: flightData가 없으면 Mock 데이터 사용
            flight_data = self._ms_get_flight_data_mock(
                validated_data['offerId'],
                validated_data['tripType']
            )
            logger.warning("[WARN] flightData 없음, Mock 데이터 사용")

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

    def _ms_convert_flight_data(self, frontend_data: dict, trip_type: str) -> dict:
        """
        프론트엔드 데이터를 백엔드 형식으로 변환

        [쉬운 설명]
        프론트엔드에서 보내는 데이터 이름과 백엔드에서 사용하는 이름이 달라요.
        예: 프론트엔드는 'departureAirport', 백엔드는 'depAirport'
        이 함수가 이름을 맞춰주는 "번역가" 역할을 해요!

        Args:
            frontend_data: 프론트엔드에서 보낸 항공편 정보
            trip_type: 편도(ONEWAY) 또는 왕복(ROUNDTRIP)

        Returns:
            백엔드 형식으로 변환된 항공편 정보
        """
        # 편도인 경우
        if trip_type == 'ONEWAY':
            return {
                "offerId": frontend_data.get('offerId', 'FRONTEND_OFFER'),
                "airline": frontend_data.get('airlineName', ''),
                "flightNo": frontend_data.get('flightNumber', ''),
                "depAirport": frontend_data.get('departureAirport', ''),
                "arrAirport": frontend_data.get('arrivalAirport', ''),
                "depAt": frontend_data.get('depAt', ''),
                "arrAt": frontend_data.get('arrAt', ''),
                "durationMin": frontend_data.get('durationMin', 60),
                "pricePerPerson": frontend_data.get('pricePerPerson', 0),
                "totalPrice": frontend_data.get('totalPrice', 0),
                "currency": "KRW",
                "seatAvailabilityNote": frontend_data.get('seatAvailabilityNote', '')
            }

        # 왕복인 경우 (나중에 필요하면 확장)
        else:
            return {
                "offerId": frontend_data.get('offerId', 'FRONTEND_OFFER'),
                "tripType": "ROUNDTRIP",
                "outbound": {
                    "airline": frontend_data.get('airlineName', ''),
                    "flightNo": frontend_data.get('flightNumber', ''),
                    "depAirport": frontend_data.get('departureAirport', ''),
                    "arrAirport": frontend_data.get('arrivalAirport', ''),
                    "depAt": frontend_data.get('depAt', ''),
                    "arrAt": frontend_data.get('arrAt', ''),
                    "durationMin": frontend_data.get('durationMin', 60),
                    "pricePerPerson": frontend_data.get('pricePerPerson', 0)
                },
                "inbound": {
                    # 오는편 정보 (프론트엔드에서 따로 보내면 사용)
                    "airline": frontend_data.get('airlineName', ''),
                    "flightNo": frontend_data.get('flightNumber', ''),
                    "depAirport": frontend_data.get('arrivalAirport', ''),
                    "arrAirport": frontend_data.get('departureAirport', ''),
                    "depAt": frontend_data.get('returnDepAt', ''),
                    "arrAt": frontend_data.get('returnArrAt', ''),
                    "durationMin": frontend_data.get('durationMin', 60),
                    "pricePerPerson": frontend_data.get('pricePerPerson', 0)
                },
                "totalPrice": frontend_data.get('totalPrice', 0),
                "currency": "KRW"
            }

    def _ms_get_flight_data_mock(self, offer_id: str, trip_type: str) -> dict:
        """
        항공편 정보 Mock 데이터 생성

        [주의] 이 함수는 flightData가 없을 때만 사용됩니다!
        가능하면 프론트엔드에서 flightData를 보내주세요.

        실제로는:
        - 검색 결과 캐시에서 가져오거나
        - offerId로 다시 조회해야 함

        Args:
            offer_id: Offer ID
            trip_type: 편도/왕복

        Returns:
            항공편 정보 (Mock)
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
