"""
지하철 API 시리얼라이저
요청/응답 데이터 형식을 정의합니다.
"""
from rest_framework import serializers


class MSSubwayRouteRequestSerializer(serializers.Serializer):
    """
    지하철 경로 검색 요청 시리얼라이저
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
