"""
항공편 검색 API 시리얼라이저
- 요청/응답 데이터 변환
- API 명세에 맞춘 camelCase 응답
"""
from rest_framework import serializers
from datetime import date


class MSPassengersSerializer(serializers.Serializer):
    """
    승객 정보 (요청용)
    """
    adults = serializers.IntegerField(min_value=1, max_value=9, default=1)
    children = serializers.IntegerField(min_value=0, max_value=9, default=0)
    infants = serializers.IntegerField(min_value=0, max_value=9, default=0)


class MSFlightSearchRequestSerializer(serializers.Serializer):
    """
    항공편 검색 요청

    POST /api/v1/transport/flights/search

    요청 예시:
    {
        "tripType": "ROUNDTRIP",
        "from": "GMP",
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
    """
    tripType = serializers.ChoiceField(
        choices=["ONEWAY", "ROUNDTRIP"],
        required=True,
        help_text="편도/왕복"
    )

    # from은 Python 예약어이므로 source 사용
    from_airport = serializers.CharField(
        source='from',
        max_length=3,
        required=True,
        help_text="출발 공항 코드 (예: GMP)"
    )

    to = serializers.CharField(
        max_length=3,
        required=True,
        help_text="도착 공항 코드 (예: CJU)"
    )

    departDate = serializers.DateField(
        required=True,
        help_text="출발일 (YYYY-MM-DD)"
    )

    returnDate = serializers.DateField(
        required=False,
        allow_null=True,
        help_text="귀국일 (왕복인 경우 필수)"
    )

    passengers = MSPassengersSerializer(required=True)

    cabinClass = serializers.ChoiceField(
        choices=["ECONOMY", "PREMIUM", "BUSINESS", "FIRST"],
        default="ECONOMY",
        help_text="좌석 등급"
    )

    # 선택 필드
    sort = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="정렬 옵션"
    )

    filters = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="필터 옵션"
    )

    def validate(self, data):
        """
        전체 데이터 검증
        """
        trip_type = data.get('tripType')
        return_date = data.get('returnDate')
        depart_date = data.get('departDate')

        # 왕복인 경우 귀국일 필수
        if trip_type == "ROUNDTRIP":
            if not return_date:
                raise serializers.ValidationError({
                    "returnDate": "왕복 예약 시 귀국일은 필수입니다."
                })

            # 귀국일이 출발일보다 이후인지 확인
            if return_date <= depart_date:
                raise serializers.ValidationError({
                    "returnDate": "귀국일은 출발일보다 이후여야 합니다."
                })

        # 출발일이 과거가 아닌지 확인
        from datetime import date as date_class
        today = date_class.today()
        if depart_date < today:
            raise serializers.ValidationError({
                "departDate": "출발일은 오늘 이후여야 합니다."
            })

        return data


class MSFlightSegmentSerializer(serializers.Serializer):
    """
    항공 구간 정보 (응답용)
    """
    flightNo = serializers.CharField(help_text="편명")
    airline = serializers.CharField(help_text="항공사")
    depAt = serializers.DateTimeField(help_text="출발 시각")
    arrAt = serializers.DateTimeField(help_text="도착 시각")
    durationMin = serializers.IntegerField(help_text="소요 시간(분)")
    direction = serializers.CharField(help_text="OUTBOUND/INBOUND")


class MSFlightOfferSummarySerializer(serializers.Serializer):
    """
    항공편 요약 정보 (응답용)

    API 명세의 FlightOfferSummary
    """
    offerId = serializers.CharField(help_text="항공편 Offer ID")
    airline = serializers.CharField(help_text="항공사")

    # 편도인 경우
    flightNo = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="편명"
    )
    depAt = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="출발 시각"
    )
    arrAt = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="도착 시각"
    )
    durationMin = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="소요 시간(분)"
    )
    direction = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="방향"
    )

    # 왕복인 경우
    tripType = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="ONEWAY/ROUNDTRIP"
    )
    outbound = serializers.DictField(
        required=False,
        allow_null=True,
        help_text="가는편 정보"
    )
    inbound = serializers.DictField(
        required=False,
        allow_null=True,
        help_text="오는편 정보"
    )

    # 공통
    pricePerPerson = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="1인 기준 요금"
    )
    totalPrice = serializers.IntegerField(help_text="총 가격")
    currency = serializers.CharField(help_text="통화 (KRW)")
    seatAvailabilityNote = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="잔여 좌석 정보"
    )


class MSFlightSearchResponseSerializer(serializers.Serializer):
    """
    항공편 검색 응답

    응답 예시:
    {
        "searchId": "uuid-string",
        "currency": "KRW",
        "results": [...]
    }
    """
    searchId = serializers.CharField(help_text="검색 결과 ID")
    currency = serializers.CharField(help_text="통화")
    results = MSFlightOfferSummarySerializer(many=True, help_text="검색 결과")


class MSFlightDetailResponseSerializer(serializers.Serializer):
    """
    항공편 상세 정보 응답

    GET /api/v1/transport/flights/{offerId}
    """
    offerId = serializers.CharField(help_text="Offer ID")
    segments = MSFlightSegmentSerializer(many=True, help_text="구간 정보")
    baggageInfo = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="수하물 정보"
    )
    refundRule = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="환불/변경 규정"
    )
    priceBreakdown = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="가격 상세"
    )
