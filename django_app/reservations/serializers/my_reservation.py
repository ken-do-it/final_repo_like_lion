"""
마이페이지 팀이 재사용할 수 있는 "내 예약 조회 전용" 직렬화(Serializer)

초등학생도 이해할 수 있게 쉽게 설명해요!

이 파일은 "사전 형태의 파이썬 데이터를 JSON으로 내보내기 위해
필드 타입/이름을 정확히 검증"하는 역할만 해요.
실제 데이터 조회는 services/my_reservation_query_service.py에서 이루어지고,
그 결과를 이 Serializer에 넣어 유효성 검사 후 응답으로 사용하면 됩니다.

공통 스펙 준수
- 목록: items[{reservationId, title, type, status, startAt, endAt, totalAmount, currency, testOrderNo, createdAt}],
        pageInfo{page, limit, total}
- 상세: reservation + flightDetail + (옵션) segments[], passengers[], seats[]
"""

from rest_framework import serializers


# ---------------------------------------------
# 공통: 예약 요약(목록 아이템)
# ---------------------------------------------
class MSMyReservationListItemSerializer(serializers.Serializer):
    reservationId = serializers.UUIDField(help_text="예약 ID")
    title = serializers.CharField(help_text="예약 제목")
    type = serializers.CharField(help_text="예약 타입 (예: FLIGHT)")
    status = serializers.CharField(help_text="예약 상태")

    # 날짜/시간은 ISO8601 문자열로 출력돼요 (DRF 기본 설정)
    startAt = serializers.DateTimeField(help_text="여행 시작 일시")
    endAt = serializers.DateTimeField(required=False, allow_null=True, help_text="여행 종료 일시")

    totalAmount = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="총 결제 금액")
    currency = serializers.CharField(help_text="통화 (예: KRW)")
    testOrderNo = serializers.CharField(help_text="테스트 주문번호 (UI 표시용)")
    createdAt = serializers.DateTimeField(help_text="생성일")


class MSMyReservationPageInfoSerializer(serializers.Serializer):
    page = serializers.IntegerField(help_text="현재 페이지")
    limit = serializers.IntegerField(help_text="페이지 당 아이템 수")
    total = serializers.IntegerField(help_text="전체 아이템 수")


class MSMyReservationListResponseSerializer(serializers.Serializer):
    """
    내 예약 목록 응답

    사용 예시 (뷰에서):
    result = service.list_user_reservations(user, request.query_params, page, limit)
    serializer = MSMyReservationListResponseSerializer(data=result)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.data)
    """
    items = MSMyReservationListItemSerializer(many=True, help_text="예약 목록")
    pageInfo = MSMyReservationPageInfoSerializer(help_text="페이지 정보")


# ---------------------------------------------
# 상세: flight detail / segments / passengers / seats
# ---------------------------------------------
class MSMyReservationFlightDetailSerializer(serializers.Serializer):
    tripType = serializers.CharField(help_text="편도/왕복")
    cabinClass = serializers.CharField(help_text="좌석 등급")
    adults = serializers.IntegerField(help_text="성인 수")
    children = serializers.IntegerField(help_text="소아 수")
    infants = serializers.IntegerField(help_text="유아 수")

    baggageInfo = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="수하물 정보")
    refundRule = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="환불 규정")
    specialRequest = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="특별 요청")
    contactEmail = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="연락 이메일")
    contactPhone = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="연락처")


class MSMyReservationSegmentSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="구간 ID")
    direction = serializers.CharField(help_text="OUTBOUND/INBOUND")
    segmentNo = serializers.IntegerField(help_text="구간 번호")
    airlineCode = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="항공사 코드")
    flightNo = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="편명")
    depAirport = serializers.CharField(help_text="출발 공항")
    arrAirport = serializers.CharField(help_text="도착 공항")
    depAt = serializers.DateTimeField(help_text="출발 시각")
    arrAt = serializers.DateTimeField(help_text="도착 시각")
    durationMin = serializers.IntegerField(required=False, allow_null=True, help_text="소요 시간(분)")
    farePerPerson = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, help_text="1인 요금")
    seatAvailabilityNote = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="잔여 좌석 메모")


class MSMyReservationPassengerSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="승객 ID")
    passengerType = serializers.CharField(help_text="ADT/CHD/INF")
    fullName = serializers.CharField(help_text="승객 이름")
    birthDate = serializers.DateField(required=False, allow_null=True, help_text="생년월일")
    passportNo = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="여권번호")


class MSMyReservationSeatSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="좌석 선택 ID")
    passengerId = serializers.UUIDField(required=False, allow_null=True, help_text="승객 ID")
    direction = serializers.CharField(help_text="OUTBOUND/INBOUND")
    segmentNo = serializers.IntegerField(help_text="구간 번호")
    seatNo = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="좌석 번호")
    seatNote = serializers.CharField(required=False, allow_null=True, allow_blank=True, help_text="좌석 메모")


# ---------------------------------------------
# 상세: 최상위 응답
# ---------------------------------------------
class MSMyReservationDetailReservationSerializer(serializers.Serializer):
    reservationId = serializers.UUIDField(help_text="예약 ID")
    title = serializers.CharField(help_text="예약 제목")
    type = serializers.CharField(help_text="예약 타입")
    status = serializers.CharField(help_text="예약 상태")
    startAt = serializers.DateTimeField(help_text="여행 시작 일시")
    endAt = serializers.DateTimeField(required=False, allow_null=True, help_text="여행 종료 일시")
    totalAmount = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="총 결제 금액")
    currency = serializers.CharField(help_text="통화")
    testOrderNo = serializers.CharField(help_text="테스트 주문번호")
    createdAt = serializers.DateTimeField(help_text="생성일")


class MSMyReservationDetailResponseSerializer(serializers.Serializer):
    """
    내 예약 상세 응답

    기본 포함: reservation + flightDetail
    옵션: segments[], passengers[], seats[] (include 파라미터로 제어)

    사용 예시 (뷰에서):
    result = service.get_user_reservation_detail(user, reservation_id, include)
    serializer = MSMyReservationDetailResponseSerializer(data=result)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.data)
    """
    reservation = MSMyReservationDetailReservationSerializer(help_text="예약 기본 정보")
    flightDetail = MSMyReservationFlightDetailSerializer(allow_null=True, help_text="항공 상세 정보")

    # include에 포함됐을 때만 전달하면 되므로 required=False
    segments = MSMyReservationSegmentSerializer(many=True, required=False, help_text="항공 구간 리스트")
    passengers = MSMyReservationPassengerSerializer(many=True, required=False, help_text="승객 리스트")
    seats = MSMyReservationSeatSerializer(many=True, required=False, help_text="좌석 선택 리스트")

