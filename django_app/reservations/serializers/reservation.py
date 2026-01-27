"""
예약 생성 API Serializer
- POST /api/v1/reservations/flight
- 항공편 예약 생성 (테스트용)
"""
from rest_framework import serializers
from ..models import (
    Reservation,
    ReservationFlight,
    ReservationFlightSegment,
    ReservationPassenger,
    ReservationSeatSelection
)


class MSPassengerInputSerializer(serializers.Serializer):
    """
    승객 정보 입력

    요청 예시:
    {
        "passengerType": "ADT",  # ADT(성인), CHD(소아), INF(유아)
        "fullName": "홍길동",
        "birthDate": "1990-01-01",  # 선택사항
        "passportNo": "M12345678"   # 선택사항
    }
    """
    # passengerType: 승객 타입 (성인/소아/유아)
    passengerType = serializers.ChoiceField(
        choices=['ADT', 'CHD', 'INF'],
        required=True,
        help_text="승객 타입 (ADT: 성인, CHD: 소아, INF: 유아)"
    )

    # fullName: 승객 이름
    fullName = serializers.CharField(
        max_length=100,
        required=True,
        help_text="승객 이름"
    )

    # birthDate: 생년월일 (선택사항)
    birthDate = serializers.DateField(
        required=False,
        allow_null=True,
        help_text="생년월일 (YYYY-MM-DD)"
    )

    # passportNo: 여권번호 (선택사항)
    passportNo = serializers.CharField(
        max_length=30,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="여권번호"
    )


class MSContactInputSerializer(serializers.Serializer):
    """
    연락처 정보 입력

    요청 예시:
    {
        "contactEmail": "test@example.com",
        "contactPhone": "010-1234-5678"
    }
    """
    # contactEmail: 연락 이메일
    contactEmail = serializers.EmailField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="연락 이메일"
    )

    # contactPhone: 연락처
    contactPhone = serializers.CharField(
        max_length=40,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="연락처"
    )


class MSRequestInputSerializer(serializers.Serializer):
    """
    특별 요청사항 입력

    요청 예시:
    {
        "specialRequest": "기내식: 채식, 휠체어 필요"
    }
    """
    # specialRequest: 특별 요청사항 (기내식, 휠체어 등)
    specialRequest = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="특별 요청사항 (기내식, 휠체어, 유아 요람 등)"
    )


class MSFlightDataInputSerializer(serializers.Serializer):
    """
    항공편 정보 입력 (프론트엔드에서 선택한 실제 항공편 데이터)

    [쉬운 설명]
    사용자가 검색해서 선택한 항공편 정보를 받아요.
    이 정보가 없으면 Mock(가짜) 데이터가 저장되어서
    마이페이지에서 이상한 정보가 보이게 됩니다!

    요청 예시:
    {
        "airlineName": "제주항공",
        "flightNumber": "7C101",
        "departureAirport": "GMP",
        "arrivalAirport": "CJU",
        "depAt": "2026-01-27T15:00:00",
        "arrAt": "2026-01-27T16:05:00",
        "pricePerPerson": 85000,
        "totalPrice": 85000
    }
    """
    # airlineName: 항공사 이름 (예: "제주항공", "대한항공")
    airlineName = serializers.CharField(
        max_length=50,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="항공사 이름"
    )

    # flightNumber: 편명 (예: "7C101", "KE1234")
    flightNumber = serializers.CharField(
        max_length=20,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="편명"
    )

    # departureAirport: 출발 공항 코드 (예: "GMP", "ICN")
    departureAirport = serializers.CharField(
        max_length=10,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="출발 공항 코드"
    )

    # arrivalAirport: 도착 공항 코드 (예: "CJU", "PUS")
    arrivalAirport = serializers.CharField(
        max_length=10,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="도착 공항 코드"
    )

    # depAt: 출발 시각 (ISO 형식: "2026-01-27T15:00:00")
    depAt = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="출발 시각 (ISO 형식)"
    )

    # arrAt: 도착 시각 (ISO 형식: "2026-01-27T16:05:00")
    arrAt = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="도착 시각 (ISO 형식)"
    )

    # pricePerPerson: 1인당 가격
    pricePerPerson = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="1인당 가격"
    )

    # totalPrice: 총 가격
    totalPrice = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="총 가격"
    )


class MSSeatSelectionInputSerializer(serializers.Serializer):
    """
    좌석 선택 정보 입력 (테스트용)

    요청 예시:
    {
        "direction": "OUTBOUND",  # OUTBOUND(가는편), INBOUND(오는편)
        "segmentNo": 1,
        "seatNo": "12A",
        "seatNote": "창가 좌석"
    }

    [주의] 테스트 저장용이며, 실제 좌석 배정에는 반영되지 않습니다!
    """
    # direction: 방향 (가는편/오는편)
    direction = serializers.ChoiceField(
        choices=['OUTBOUND', 'INBOUND'],
        required=True,
        help_text="방향 (OUTBOUND: 가는편, INBOUND: 오는편)"
    )

    # segmentNo: 구간 번호
    segmentNo = serializers.IntegerField(
        required=True,
        help_text="구간 번호"
    )

    # seatNo: 좌석 번호 (예: 12A)
    seatNo = serializers.CharField(
        max_length=10,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="좌석 번호 (예: 12A)"
    )

    # seatNote: 좌석 메모
    seatNote = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="테스트 저장용 메모"
    )


class MSReservationCreateRequestSerializer(serializers.Serializer):
    """
    예약 생성 요청

    POST /api/v1/reservations/flight

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
    """
    # offerId: 선택한 항공편 Offer ID
    offerId = serializers.CharField(
        required=True,
        help_text="선택한 항공편 Offer ID"
    )

    # tripType: 편도/왕복
    tripType = serializers.ChoiceField(
        choices=['ONEWAY', 'ROUNDTRIP'],
        required=True,
        help_text="편도/왕복"
    )

    # cabinClass: 좌석 등급
    cabinClass = serializers.CharField(
        max_length=30,
        required=True,
        help_text="좌석 등급"
    )

    # passengers: 승객 정보 리스트 (필수)
    passengers = MSPassengerInputSerializer(
        many=True,
        required=True,
        help_text="승객 정보 리스트"
    )

    # contacts: 연락처 정보 (선택사항)
    contacts = MSContactInputSerializer(
        required=False,
        allow_null=True,
        help_text="연락처 정보"
    )

    # requests: 특별 요청사항 (선택사항)
    requests = MSRequestInputSerializer(
        required=False,
        allow_null=True,
        help_text="특별 요청사항"
    )

    # seatSelections: 좌석 선택 (선택사항)
    seatSelections = MSSeatSelectionInputSerializer(
        many=True,
        required=False,
        allow_null=True,
        help_text="좌석 선택 (테스트용)"
    )

    # flightData: 실제 항공편 정보 (프론트엔드에서 전달)
    # [중요] 이 필드가 없으면 Mock 데이터가 저장됩니다!
    flightData = MSFlightDataInputSerializer(
        required=False,
        allow_null=True,
        help_text="실제 항공편 정보 (프론트엔드에서 선택한 데이터)"
    )

    def validate_passengers(self, value):
        """
        승객 정보 검증

        - 최소 1명 이상이어야 함
        """
        if not value or len(value) == 0:
            raise serializers.ValidationError("승객 정보는 최소 1명 이상 필요합니다.")

        return value


class MSReservationCreateResponseSerializer(serializers.Serializer):
    """
    예약 생성 응답

    응답 예시:
    {
        "reservationId": "uuid",
        "testOrderNo": "FLT_1234567890_ABCD1234"
    }
    """
    # reservationId: 생성된 예약 ID
    reservationId = serializers.UUIDField(
        help_text="생성된 예약 ID"
    )

    # testOrderNo: 테스트 주문번호 (UI 노출용)
    testOrderNo = serializers.CharField(
        help_text="테스트 주문번호 (UI 노출용)"
    )
