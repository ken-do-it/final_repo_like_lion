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
