"""
기차 검색 API 서비스
- TAGO(국토교통부) 열차정보 API 연동
- 역 이름 기반 검색
"""
import os
import requests
from django.conf import settings
from typing import Optional, List, Dict
from datetime import date, datetime, time
from urllib.parse import quote
import logging

logger = logging.getLogger(__name__)


class MSTrainAPIService:
    """
    기차 검색 서비스

    외부 API:
    - TAGO API (국토교통부): 열차정보
    """

    # TAGO API (국토교통부)
    TAGO_BASE_URL = "http://apis.data.go.kr/1613000/TrainInfoService"

    # 주요 기차역 이름 -> 역 ID 매핑
    # TAGO API의 nodeid를 사용
    STATION_ID_MAPPING = {
        # 경부선
        "서울": "NAT010000",
        "용산": "NAT010032",
        "영등포": "NAT010415",
        "수원": "NAT010754",
        "천안": "NAT011668",
        "천안아산": "NAT011668",
        "오송": "NAT174",
        "대전": "NAT011072",
        "김천구미": "NAT600",
        "동대구": "NAT013271",
        "대구": "NAT013271",
        "신경주": "NAT800",
        "울산": "NAT013889",
        "부산": "NAT014445",

        # 호남선
        "광주송정": "NAT031345",
        "광주": "NAT031345",
        "목포": "NAT032257",
        "여수EXPO": "NAT032658",

        # 경전선
        "마산": "NAT014955",
        "진주": "NAT015293",

        # 강릉선
        "청량리": "NAT800710",
        "상봉": "NAT800711",
        "평창": "NAT800730",
        "진부": "NAT800735",
        "강릉": "NAT800748",

        # 전라선
        "익산": "NAT030825",
        "전주": "NAT031229",
        "남원": "NAT031650",
        "순천": "NAT032300",

        # 중앙선
        "청량리": "NAT800710",
        "안동": "NAT201",

        # 충북선
        "조치원": "NAT012500",
        "충주": "NAT012552",
    }

    def __init__(self):
        """
        API 키 설정

        환경변수 필요:
        - TAGO_SERVICE_KEY: TAGO API 인증키
        """
        # Django settings에 없으면 .env(환경변수)에서 폴백으로 읽기
        self.tago_key = getattr(settings, 'TAGO_SERVICE_KEY', None) or os.getenv('TAGO_SERVICE_KEY')

    def ms_search_trains(
        self,
        from_station: str,
        to_station: str,
        depart_date: date,
        depart_time: Optional[time] = None,  # 시간 정보 추가
        passengers: int = 1,
        filters: Optional[Dict] = None
    ) -> Dict:
        """
        기차 검색

        Args:
            from_station: 출발역 이름 (예: "서울")
            to_station: 도착역 이름 (예: "부산")
            depart_date: 출발 날짜
            depart_time: 출발 시간 (선택사항, 예: time(14, 0) = 14:00)
            passengers: 승객 수
            filters: 필터 옵션 (trainType: KTX/SRT/ITX/무궁화 등)

        Returns:
            {
                "results": [기차 목록],
                "totalCount": 15
            }
        """
        # 역 이름을 TAGO API 역 ID로 변환
        from_station_id = self._ms_convert_to_station_id(from_station)
        to_station_id = self._ms_convert_to_station_id(to_station)

        # TAGO API에서 기차 검색
        trains = self._ms_fetch_trains_from_tago(
            from_station_id,
            to_station_id,
            depart_date,
            filters
        )

        # 필터 적용 (차량종류 등으로 결과 걸러내기)
        if filters:
            trains = self._ms_apply_filters(trains, filters)

        # 시간 필터링 추가
        # 사용자가 출발 시간을 지정한 경우, 해당 시간 이후의 기차만 표시
        if depart_time:
            trains = self._ms_filter_by_time(trains, depart_time)

        # 총 결과 수
        total_count = len(trains)

        return {
            "results": trains,
            "totalCount": total_count
        }

    def _ms_convert_to_station_id(self, station_name: str) -> str:
        """
        역 이름을 TAGO API용 역 ID로 변환

        Args:
            station_name: 역 이름 (예: "서울", "부산")

        Returns:
            역 ID (예: "NAT010000")
        """
        # 공백 제거 및 정규화
        station_name = station_name.strip()

        # 매핑 테이블에서 찾기
        station_id = self.STATION_ID_MAPPING.get(station_name)

        if not station_id:
            logger.warning(f"역 ID를 찾을 수 없습니다: {station_name}")
            # 역 이름을 그대로 반환 (API가 이름도 지원할 수 있음)
            return station_name

        return station_id

    def _ms_fetch_trains_from_tago(
        self,
        from_station_id: str,
        to_station_id: str,
        depart_date: date,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        TAGO API에서 기차 정보 가져오기

        Args:
            from_station_id: 출발역 ID
            to_station_id: 도착역 ID
            depart_date: 출발 날짜
            filters: 필터 옵션

        Returns:
            기차 정보 리스트
        """
        if not self.tago_key:
            logger.error("TAGO API 키가 설정되지 않았습니다.")
            return []

        # API 엔드포인트
        endpoint = "/getStrtpntAlocFndTrainInfo"
        url = f"{self.TAGO_BASE_URL}{endpoint}"

        # 날짜를 YYYYMMDD 형식으로 변환
        depart_date_str = depart_date.strftime("%Y%m%d")

        # 요청 파라미터
        params = {
            "serviceKey": self.tago_key,  # URL 인코딩은 requests가 자동 처리
            "depPlaceId": from_station_id,
            "arrPlaceId": to_station_id,
            "depPlandTime": depart_date_str,
            "numOfRows": 100,  # 최대 100개
            "pageNo": 1,
            "_type": "json"
        }

        # 필터에서 차량종류 코드 추출
        if filters and "trainType" in filters:
            train_type = filters["trainType"]
            # trainType을 TAGO API의 trainGradeCode로 변환
            # KTX, SRT, ITX, 무궁화 등
            params["trainGradeCode"] = train_type

        try:
            # 기차 검색 시작 로그
            logger.info(f"기차 검색: {from_station_id} → {to_station_id} ({depart_date_str})")

            # API 호출
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            # JSON 파싱
            data = response.json()

            # 응답 파싱
            items = self._ms_parse_tago_response(data)

            # 우리 형식으로 변환
            trains = []
            for item in items:
                train = self._ms_convert_train_result(item)
                if train:
                    trains.append(train)

            logger.info(f"✅ {len(trains)}개 열차 검색 완료")
            return trains

        except requests.exceptions.Timeout:
            logger.error("TAGO API 타임아웃")
            return []
        except requests.exceptions.RequestException as e:
            logger.error(f"TAGO API 호출 실패: {e}")
            return []
        except Exception as e:
            logger.error(f"TAGO API 처리 중 오류: {e}", exc_info=True)
            return []

    def _ms_parse_tago_response(self, data: Dict) -> List[Dict]:
        """
        TAGO API 응답 파싱

        TAGO API 응답 형식:
        {
            "response": {
                "header": {...},
                "body": {
                    "items": {"item": [...]},
                    "totalCount": 10
                }
            }
        }
        """
        try:
            response = data.get("response", {})
            header = response.get("header", {})

            # 에러 체크
            result_code = header.get("resultCode")
            if result_code != "00":
                result_msg = header.get("resultMsg", "알 수 없는 오류")
                logger.error(f"TAGO API 오류: {result_code} - {result_msg}")
                return []

            body = response.get("body", {})
            items = body.get("items", {})

            # items가 없으면 빈 리스트 반환
            if not items:
                logger.info("TAGO API: 검색 결과 없음")
                return []

            item = items.get("item", [])

            # item이 dict인 경우 (결과가 1개) 리스트로 변환
            if isinstance(item, dict):
                item = [item]

            return item

        except Exception as e:
            logger.error(f"TAGO 응답 파싱 실패: {e}")
            return []

    def _ms_convert_train_result(self, item: Dict) -> Optional[Dict]:
        """
        TAGO API 응답 항목을 우리 형식으로 변환

        TAGO API 응답 필드:
        - traingradename: 차량종류명 (예: KTX)
        - trainno: 열차번호
        - depplandtime: 출발시간 (예: 080000)
        - arrplandtime: 도착시간 (예: 104500)
        - depplacename: 출발역
        - arrplacename: 도착역
        - adultcharge: 성인 운임

        우리 형식:
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
        try:
            # 필드 추출
            train_type = item.get("traingradename", "")
            train_no = item.get("trainno", "")
            dep_time_raw = item.get("depplandtime", "")
            arr_time_raw = item.get("arrplandtime", "")
            dep_station = item.get("depplacename", "")
            arr_station = item.get("arrplacename", "")
            adult_fare = item.get("adultcharge", 0)

            # 시간 포맷 변환 (080000 -> 08:00)
            dep_time = self._ms_format_time(dep_time_raw)
            arr_time = self._ms_format_time(arr_time_raw)

            # 소요시간 계산
            duration = self._ms_calculate_duration(dep_time_raw, arr_time_raw)

            # 운임을 정수로 변환
            try:
                adult_fare = int(adult_fare)
            except (ValueError, TypeError):
                adult_fare = 0

            return {
                "trainNo": train_no,
                "trainType": train_type,
                "departureStation": dep_station,
                "arrivalStation": arr_station,
                "departureTime": dep_time,
                "arrivalTime": arr_time,
                "duration": duration,
                "adultFare": adult_fare
            }

        except Exception as e:
            logger.error(f"기차 결과 변환 실패: {e}")
            return None

    def _ms_format_time(self, time_value) -> str:
        """
        시간 데이터 포맷 변환

        Args:
            time_value: TAGO API가 보내는 시간 데이터
                - 숫자 형식: 20260113060000 (YYYYMMDDHHmmss)
                - 문자열 형식: "20260113060000" 또는 "060000"

        Returns:
            HH:MM 형식 (예: "06:00")
        """
        try:
            # None이거나 빈 값이면 기본값 반환
            if not time_value:
                return "00:00"

            # 숫자면 문자열로 변환
            time_str = str(time_value)

            # 14자리면 YYYYMMDDHHmmss 형식
            # 뒤 6자리(HHmmss)만 사용
            if len(time_str) == 14:
                time_str = time_str[8:14]  # "20260113060000" → "060000"

            # 6자리 미만이면 에러
            if len(time_str) < 4:
                return "00:00"

            # HHmmss에서 HH:MM 추출
            hours = time_str[:2]
            minutes = time_str[2:4]
            return f"{hours}:{minutes}"

        except Exception as e:
            logger.warning(f"시간 변환 실패: {time_value} - {e}")
            return "00:00"

    def _ms_calculate_duration(self, dep_time_value, arr_time_value) -> str:
        """
        소요시간 계산

        Args:
            dep_time_value: 출발시간 (숫자 또는 문자열)
            arr_time_value: 도착시간 (숫자 또는 문자열)

        Returns:
            "X시간 Y분" 형식
        """
        try:
            # None이거나 빈 값이면 에러
            if not dep_time_value or not arr_time_value:
                return "정보 없음"

            # 숫자면 문자열로 변환
            dep_time_str = str(dep_time_value)
            arr_time_str = str(arr_time_value)

            # 14자리면 YYYYMMDDHHmmss 형식 → 뒤 6자리만 사용
            if len(dep_time_str) == 14:
                dep_time_str = dep_time_str[8:14]
            if len(arr_time_str) == 14:
                arr_time_str = arr_time_str[8:14]

            # 최소 4자리 필요 (HHMM)
            if len(dep_time_str) < 4 or len(arr_time_str) < 4:
                return "정보 없음"

            # 시간 파싱
            dep_hours = int(dep_time_str[:2])
            dep_minutes = int(dep_time_str[2:4])
            arr_hours = int(arr_time_str[:2])
            arr_minutes = int(arr_time_str[2:4])

            # 분 단위로 변환
            dep_total_minutes = dep_hours * 60 + dep_minutes
            arr_total_minutes = arr_hours * 60 + arr_minutes

            # 소요시간 계산
            duration_minutes = arr_total_minutes - dep_total_minutes

            # 음수인 경우 (자정 넘어가는 경우) 24시간 추가
            if duration_minutes < 0:
                duration_minutes += 24 * 60

            # 시간과 분으로 변환
            hours = duration_minutes // 60
            minutes = duration_minutes % 60

            # 포맷팅
            if hours > 0 and minutes > 0:
                return f"{hours}시간 {minutes}분"
            elif hours > 0:
                return f"{hours}시간"
            else:
                return f"{minutes}분"

        except Exception as e:
            logger.warning(f"소요시간 계산 실패: {dep_time_value} → {arr_time_value} - {e}")
            return "정보 없음"

    def _ms_apply_filters(self, trains: List[Dict], filters: Dict) -> List[Dict]:
        """
        필터 적용

        Args:
            trains: 기차 목록
            filters: 필터 옵션
                - trainType: 차량종류 (KTX, SRT, ITX, 무궁화 등)
                - departureTimeStart: 출발 시간 시작 (HH:MM)
                - departureTimeEnd: 출발 시간 종료 (HH:MM)
                - maxDuration: 최대 소요시간 (분)
                - maxFare: 최대 운임

        Returns:
            필터링된 기차 목록
        """
        filtered = trains

        # 차량종류 필터 (이미 API 호출 시 적용되었지만, 추가 확인)
        if "trainType" in filters:
            train_type = filters["trainType"]
            filtered = [t for t in filtered if t["trainType"] == train_type]

        # 출발 시간 범위 필터
        if "departureTimeStart" in filters or "departureTimeEnd" in filters:
            start = filters.get("departureTimeStart", "00:00")
            end = filters.get("departureTimeEnd", "23:59")
            filtered = [
                t for t in filtered
                if start <= t["departureTime"] <= end
            ]

        # 최대 운임 필터
        if "maxFare" in filters:
            max_fare = filters["maxFare"]
            filtered = [t for t in filtered if t["adultFare"] <= max_fare]

        return filtered

    def _ms_filter_by_time(self, trains: List[Dict], depart_time: time) -> List[Dict]:
        """
        출발 시간으로 필터링

        사용자가 지정한 시간 이후에 출발하는 기차만 반환합니다.

        Args:
            trains: 기차 목록
            depart_time: 출발 시간 (예: time(14, 0) = 14:00)

        Returns:
            필터링된 기차 목록

        예시:
            - 사용자가 14:00을 입력하면
            - 14:00 이후에 출발하는 기차만 표시
        """
        # 시간을 "HH:MM" 형식 문자열로 변환
        time_str = depart_time.strftime("%H:%M")

        # 해당 시간 이후 출발하는 기차만 필터링
        filtered = [
            t for t in trains
            if t["departureTime"] >= time_str
        ]

        logger.info(f"⏰ 시간 필터링: {time_str} 이후 출발 → {len(filtered)}개 열차")
        return filtered
