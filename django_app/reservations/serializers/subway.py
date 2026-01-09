"""
지하철 API 시리얼라이저
요청/응답 데이터 형식을 정의합니다.
"""
from rest_framework import serializers


class MSSubwayRouteRequestSerializer(serializers.Serializer):
    """
    지하철 경로 검색 요청 시리얼라이저

    확장: 호출 수 절감을 위해 좌표 직접 입력/스톱 포함 옵션을 지원합니다.
    - fromLat, fromLng, toLat, toLng: 있으면 역명→좌표 조회 2회를 생략합니다.
    - include: 'stops'를 포함하면 각 step에 stops[{name,lat,lng}]를 포함합니다.
    """
    fromStation = serializers.CharField(
        max_length=50,
        help_text="출발역 이름 (예: 강남, 강남역)"
    )
    toStation = serializers.CharField(
        max_length=50,
        help_text="도착역 이름 (예: 홍대입구, 홍대입구역)"
    )
    option = serializers.ChoiceField(
        choices=["FAST", "FEW_TRANSFER", "CHEAP"],
        default="FAST",
        help_text="경로 옵션: FAST(최단시간), FEW_TRANSFER(최소환승), CHEAP(최소비용)"
    )

    # 좌표 직접 입력 (선택)
    fromLat = serializers.FloatField(required=False, allow_null=True, help_text="출발역 위도(선택)")
    fromLng = serializers.FloatField(required=False, allow_null=True, help_text="출발역 경도(선택)")
    toLat = serializers.FloatField(required=False, allow_null=True, help_text="도착역 위도(선택)")
    toLng = serializers.FloatField(required=False, allow_null=True, help_text="도착역 경도(선택)")

    # include 옵션: 'stops' 포함 시 정거장 좌표 리스트 포함
    include = serializers.CharField(required=False, allow_blank=True, help_text="옵션: 'stops' 포함 시 정거장 리스트 포함")


class MSSubwayStopSerializer(serializers.Serializer):
    name = serializers.CharField(help_text="정거장 이름")
    lat = serializers.FloatField(help_text="위도")
    lng = serializers.FloatField(help_text="경도")

class MSSubwayStepSerializer(serializers.Serializer):
    """
    지하철 경로의 각 구간 정보
    """
    line = serializers.CharField(help_text="노선명 (예: 2호선)")
    lineColor = serializers.CharField(help_text="노선 색상 코드 (예: #00A84D)")
    from_field = serializers.CharField(
        source="from",
        help_text="출발역"
    )
    to = serializers.CharField(help_text="도착역")
    stations = serializers.IntegerField(help_text="정거장 수")
    duration = serializers.IntegerField(help_text="소요 시간(분)")
    # 지도 시각화를 위한 정거장 좌표 리스트(옵션, include=stops일 때만 존재)
    stops = MSSubwayStopSerializer(many=True, required=False, help_text="정거장 리스트")

    def to_representation(self, instance):
        """
        from_field를 from으로 변환
        """
        ret = super().to_representation(instance)
        ret["from"] = ret.pop("from_field")
        return ret


class MSSubwayFareSerializer(serializers.Serializer):
    """
    요금 정보
    """
    card = serializers.IntegerField(help_text="교통카드 요금")
    cash = serializers.IntegerField(help_text="현금 요금")


class MSSubwayRouteSerializer(serializers.Serializer):
    """
    지하철 경로 1개의 정보
    """
    duration = serializers.IntegerField(help_text="총 소요 시간(분)")
    transfers = serializers.IntegerField(help_text="환승 횟수")
    fare = MSSubwayFareSerializer(help_text="요금 정보")
    steps = MSSubwayStepSerializer(many=True, help_text="경로 구간 정보")
    # 각 step 안에 선택적으로 stops 배열이 포함될 수 있어요. (런타임 추가 필드)
    # DRF는 선언되지 않은 필드도 to_representation 결과에 있으면 그대로 통과합니다.


class MSSubwayRouteResponseSerializer(serializers.Serializer):
    """
    지하철 경로 검색 응답 시리얼라이저
    """
    routes = MSSubwayRouteSerializer(many=True, help_text="경로 목록 (최대 3개)")


class MSSubwayMapMetaRequestSerializer(serializers.Serializer):
    """
    노선도 메타 정보 요청 시리얼라이저
    """
    city = serializers.ChoiceField(
        choices=["SEOUL", "BUSAN", "DAEGU", "GWANGJU", "DAEJEON"],
        help_text="도시 선택"
    )


class MSSubwayMapMetaResponseSerializer(serializers.Serializer):
    """
    노선도 메타 정보 응답 시리얼라이저
    """
    mapUrl = serializers.URLField(help_text="노선도 이미지 URL")
    version = serializers.CharField(help_text="노선도 버전")
