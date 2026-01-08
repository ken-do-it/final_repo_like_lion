"""
기차 검색 API 시리얼라이저
- 요청/응답 데이터 변환
- API 명세에 맞춘 camelCase 응답
- TAGO 열차정보 API 연동
"""
from rest_framework import serializers
from datetime import date, datetime


class MSTrainSearchRequestSerializer(serializers.Serializer):
    """
    기차 검색 요청

    GET/POST /api/v1/transport/trains/search

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
    """
    fromStation = serializers.CharField(
        max_length=50,
        required=True,
        help_text="출발역 이름 (예: 서울, 용산)"
    )

    toStation = serializers.CharField(
        max_length=50,
        required=True,
        help_text="도착역 이름 (예: 부산, 대전)"
    )

    departDate = serializers.DateField(
        required=True,
        help_text="출발일 (YYYY-MM-DD)"
    )

    # 출발 시간 추가 (선택사항)
    # 예: "14:00" 형식
    # 지정하지 않으면 모든 시간대 검색
    departTime = serializers.TimeField(
        required=False,
        allow_null=True,
        help_text="출발 시간 (HH:MM, 선택사항)"
    )

    passengers = serializers.IntegerField(
        min_value=1,
        max_value=9,
        default=1,
        required=False,
        help_text="승객 수 (1~9명)"
    )

    filters = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="필터 옵션 (trainType: KTX/SRT/ITX/무궁화 등)"
    )

    def validate_departDate(self, value):
        """
        출발일 검증 - 과거 날짜 불가
        """
        if value < date.today():
            raise serializers.ValidationError("출발일은 오늘 이후만 가능합니다.")
        return value

    def validate(self, data):
        """
        전체 데이터 검증
        """
        from_station = data.get('fromStation')
        to_station = data.get('toStation')

        # 출발역과 도착역이 같으면 안됨
        if from_station == to_station:
            raise serializers.ValidationError({
                "toStation": "출발역과 도착역이 같을 수 없습니다."
            })

        return data


class MSTrainResultSerializer(serializers.Serializer):
    """
    개별 기차 검색 결과

    응답 예시:
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
    """
    trainNo = serializers.CharField(
        help_text="열차번호"
    )

    trainType = serializers.CharField(
        help_text="차량종류 (KTX, SRT, ITX, 무궁화 등)"
    )

    departureStation = serializers.CharField(
        help_text="출발역 이름"
    )

    arrivalStation = serializers.CharField(
        help_text="도착역 이름"
    )

    departureTime = serializers.CharField(
        help_text="출발시간 (HH:MM)"
    )

    arrivalTime = serializers.CharField(
        help_text="도착시간 (HH:MM)"
    )

    duration = serializers.CharField(
        help_text="소요시간 (예: 2시간 45분)"
    )

    adultFare = serializers.IntegerField(
        help_text="성인 운임 (원)"
    )


class MSTrainSearchResponseSerializer(serializers.Serializer):
    """
    기차 검색 응답

    응답 예시:
    {
        "results": [...],
        "totalCount": 15
    }
    """
    results = MSTrainResultSerializer(
        many=True,
        help_text="검색 결과 목록"
    )

    totalCount = serializers.IntegerField(
        help_text="전체 결과 수"
    )


class MSKorailLinkRequestSerializer(serializers.Serializer):
    """
    코레일 외부 이동 링크 생성 요청

    GET /api/v1/transport/trains/korail-link

    쿼리 파라미터 예시:
    ?fromStation=서울&toStation=부산&departDate=2025-01-15&passengers=2
    """
    # 출발역 (from은 Python 예약어라서 fromStation 사용)
    fromStation = serializers.CharField(
        max_length=50,
        required=True,
        help_text="출발역 이름"
    )

    # 도착역
    toStation = serializers.CharField(
        max_length=50,
        required=True,
        help_text="도착역 이름"
    )

    departDate = serializers.DateField(
        required=True,
        help_text="출발일 (YYYY-MM-DD)"
    )

    # 출발 시간 추가 (선택사항)
    # 코레일 예약 페이지로 이동할 때 시간 정보도 전달
    departTime = serializers.TimeField(
        required=False,
        allow_null=True,
        help_text="출발 시간 (HH:MM, 선택사항)"
    )

    passengers = serializers.IntegerField(
        min_value=1,
        max_value=9,
        default=1,
        required=False,
        help_text="승객 수"
    )

    def validate_departDate(self, value):
        """
        출발일 검증
        """
        if value < date.today():
            raise serializers.ValidationError("출발일은 오늘 이후만 가능합니다.")
        return value


class MSKorailLinkResponseSerializer(serializers.Serializer):
    """
    코레일 외부 이동 링크 응답

    응답 예시:
    {
        "url": "https://www.letskorail.com/..."
    }
    """
    url = serializers.URLField(
        help_text="코레일 예약 페이지 URL"
    )
