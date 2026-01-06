"""
항공편 검색 API 서비스
- 한국공항공사 공공 API 연동
- TAGO(국토교통부) API 연동
"""
import os
import requests
from django.conf import settings
from typing import Optional, List, Dict
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)


class MSFlightAPIService:
    """
    항공편 검색 서비스

    외부 API:
    - TAGO API (국토교통부): 항공운항정보
    - 한국공항공사 API: 실시간 운항현황
    """

    # TAGO API (국토교통부)
    TAGO_BASE_URL = "http://apis.data.go.kr/1613000/DmstcFlightNvgInfoService"

    # 한국공항공사 API
    KAC_BASE_URL = "http://openapi.airport.co.kr/service/rest"

    # 항공사 코드 -> 이름 매핑
    AIRLINE_CODE_MAPPING = {
        "AAR": "아시아나항공",
        "KAL": "대한항공",
        "JNA": "진에어",
        "TWB": "티웨이항공",
        "ABL": "에어부산",
        "ESR": "이스타항공",
        "LCC": "제주항공",
        "JJA": "제주항공",
        "PTA": "피치항공",
        "BX": "에어부산",
        "7C": "제주항공",
        "LJ": "진에어",
        "TW": "티웨이항공",
        "RS": "에어서울",
        "ZE": "이스타항공",
        "OZ": "아시아나항공",
        "KE": "대한항공",
    }

    def __init__(self):
        """
        API 키 설정

        환경변수 필요:
        - TAGO_SERVICE_KEY: TAGO API 인증키
        - KAC_SERVICE_KEY: 한국공항공사 API 인증키
        """
        # Django settings에 없으면 .env(환경변수)에서 폴백으로 읽기
        self.tago_key = getattr(settings, 'TAGO_SERVICE_KEY', None) or os.getenv('TAGO_SERVICE_KEY')
        self.kac_key = getattr(settings, 'KAC_SERVICE_KEY', None) or os.getenv('KAC_SERVICE_KEY')

    def ms_search_flights(
        self,
        from_airport: str,
        to_airport: str,
        depart_date: date,
        trip_type: str = "ONEWAY",
        return_date: Optional[date] = None,
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        cabin_class: str = "ECONOMY",
        filters: Optional[Dict] = None,
        sort: Optional[str] = None
    ) -> Dict:
        """
        항공편 검색

        Args:
            from_airport: 출발 공항 코드 (예: "GMP")
            to_airport: 도착 공항 코드 (예: "CJU")
            depart_date: 출발 날짜
            trip_type: "ONEWAY" 또는 "ROUNDTRIP"
            return_date: 귀국 날짜 (왕복인 경우)
            adults: 성인 수
            children: 소아 수
            infants: 유아 수
            cabin_class: 좌석 등급
            filters: 필터 옵션 (가격 범위, 출발 시간대 등)
            sort: 정렬 옵션 (PRICE_ASC, PRICE_DESC, DEPARTURE_ASC, DEPARTURE_DESC)

        Returns:
            {
                "searchId": "uuid",
                "currency": "KRW",
                "results": [항공편 목록]
            }
        """
        # 공항 코드를 TAGO API 형식으로 변환
        from_airport_id = self._ms_convert_to_airport_id(from_airport)
        to_airport_id = self._ms_convert_to_airport_id(to_airport)

        # 가는편 검색
        outbound_flights = self._ms_fetch_flights_from_tago(
            from_airport_id,
            to_airport_id,
            depart_date
        )

        # 왕복인 경우 오는편 검색
        inbound_flights = []
        if trip_type == "ROUNDTRIP" and return_date:
            inbound_flights = self._ms_fetch_flights_from_tago(
                to_airport_id,
                from_airport_id,
                return_date
            )

        # 검색 결과 조합
        results = self._ms_combine_flight_results(
            outbound_flights,
            inbound_flights,
            trip_type,
            adults,
            children,
            infants
        )

        # 필터 적용 (가격 범위, 출발 시간대 등으로 결과 걸러내기)
        if filters:
            results = self._ms_apply_filters(results, filters)

        # 정렬 적용 (가격순, 시간순 등으로 순서 바꾸기)
        if sort:
            results = self._ms_apply_sort(results, sort)

        # 검색 ID 생성 (간단하게 타임스탬프 사용)
        import uuid
        search_id = str(uuid.uuid4())

        return {
            "searchId": search_id,
            "currency": "KRW",
            "results": results
        }

    def _ms_fetch_flights_from_tago(
        self,
        dep_airport_id: str,
        arr_airport_id: str,
        dep_date: date
    ) -> List[Dict]:
        """
        TAGO API에서 항공편 정보 조회

        Args:
            dep_airport_id: 출발 공항 ID (TAGO 형식)
            arr_airport_id: 도착 공항 ID (TAGO 형식)
            dep_date: 출발 날짜

        Returns:
            항공편 목록
        """
        if not self.tago_key:
            logger.warning("TAGO_SERVICE_KEY가 설정되지 않았습니다. 빈 결과 반환")
            return []

        params = {
            "serviceKey": self.tago_key,
            "depAirportId": dep_airport_id,
            "arrAirportId": arr_airport_id,
            "depPlandTime": dep_date.strftime("%Y%m%d"),
            "numOfRows": 50,  # 최대 50개 조회
            "pageNo": 1,
            "_type": "json"
        }

        try:
            response = requests.get(
                f"{self.TAGO_BASE_URL}/getFlightOpratInfoList",
                params=params,
                timeout=5
            )
            response.raise_for_status()

            data = response.json()
            return self._ms_parse_tago_response(data)

        except requests.exceptions.RequestException as e:
            logger.error(f"TAGO API 호출 실패: {e}")
            return []
        except Exception as e:
            logger.error(f"항공편 조회 중 오류: {e}")
            return []

    def _ms_parse_tago_response(self, data: Dict) -> List[Dict]:
        """
        TAGO API 응답 파싱

        TAGO API 응답 형식:
        {
            "response": {
                "body": {
                    "items": {"item": [...]},
                    "totalCount": 10
                }
            }
        }
        """
        try:
            body = data.get("response", {}).get("body", {})
            items = body.get("items", {}).get("item", [])

            # item이 dict인 경우 (결과가 1개) 리스트로 변환
            if isinstance(items, dict):
                items = [items]

            return items

        except Exception as e:
            logger.error(f"TAGO 응답 파싱 실패: {e}")
            return []

    def _ms_convert_to_airport_id(self, iata_code: str) -> str:
        """
        IATA 코드를 TAGO API용 공항 ID로 변환

        예: "GMP" -> "NAARKSS"
        """
        # 주요 공항 매핑
        airport_mapping = {
            "GMP": "NAARKSS",  # 김포
            "CJU": "NAARKPC",  # 제주
            "PUS": "NAARKPK",  # 김해(부산)
            "TAE": "NAARKTN",  # 대구
            "KWJ": "NAARKJJ",  # 광주
            "CJJ": "NAARKTU",  # 청주
            "MWX": "NAARKJB",  # 무안
            "RSU": "NAARKJY",  # 여수
            "USN": "NAARKPU",  # 울산
            "HIN": "NAARKPS",  # 사천
            "KPO": "NAARKTH",  # 포항
            "WJU": "NAARKNY",  # 원주
        }

        return airport_mapping.get(iata_code.upper(), iata_code)

    def _ms_combine_flight_results(
        self,
        outbound_flights: List[Dict],
        inbound_flights: List[Dict],
        trip_type: str,
        adults: int,
        children: int,
        infants: int
    ) -> List[Dict]:
        """
        가는편/오는편 항공편을 조합하여 최종 결과 생성

        Returns:
            FlightOfferSummary 형식의 리스트
        """
        results = []

        if trip_type == "ONEWAY":
            # 편도: 가는편만 반환
            for flight in outbound_flights:
                offer = self._ms_convert_to_offer_summary(
                    flight,
                    adults,
                    children,
                    infants,
                    "OUTBOUND"
                )
                results.append(offer)
        else:
            # 왕복: 가는편 x 오는편 조합
            for out_flight in outbound_flights:
                for in_flight in inbound_flights:
                    offer = self._ms_combine_roundtrip_offer(
                        out_flight,
                        in_flight,
                        adults,
                        children,
                        infants
                    )
                    results.append(offer)

        return results

    def _ms_convert_to_offer_summary(
        self,
        flight_data: Dict,
        adults: int,
        children: int,
        infants: int,
        direction: str = "OUTBOUND"
    ) -> Dict:
        """
        TAGO API 항공편 데이터를 FlightOfferSummary 형식으로 변환

        TAGO 필드:
        - vihicleId: 편명 (예: "OZ8141")
        - airlineNm: 항공사명
        - depPlandTime: 출발시각 (YYYYMMDDHHmm)
        - arrPlandTime: 도착시각 (YYYYMMDDHHmm)
        """
        # [로깅] TAGO API에서 받은 실제 데이터 확인하기
        # 이렇게 하면 콘솔에 어떤 데이터가 오는지 볼 수 있습니다
        logger.info(f"[항공편 데이터] {flight_data}")

        # 편명 (예: "OZ8141", "KE1234")
        flight_no = flight_data.get("vihicleId", "")

        # 항공사 이름 찾기 (3단계 시도)
        airline = self._ms_extract_airline_name(flight_data, flight_no)

        # 출발/도착 시각 파싱
        dep_time_str = flight_data.get("depPlandTime", "")
        arr_time_str = flight_data.get("arrPlandTime", "")

        dep_at = self._ms_parse_datetime(dep_time_str)
        arr_at = self._ms_parse_datetime(arr_time_str)

        # 소요 시간 계산 (분)
        duration_min = 0
        if dep_at and arr_at:
            duration_min = int((arr_at - dep_at).total_seconds() / 60)

        # 가격 계산 (Mock - 실제 API에는 가격 정보 없음)
        price_per_person = self._ms_calculate_mock_price(
            flight_data.get("depAirportNm", ""),
            flight_data.get("arrAirportNm", "")
        )

        # 총 가격 계산
        total_price = (adults * price_per_person) + \
                     (children * price_per_person * 0.75) + \
                     (infants * price_per_person * 0.1)

        # offerId 생성 (TAGO에는 없으므로 임시로 생성)
        import hashlib
        offer_id = hashlib.md5(
            f"{flight_no}_{dep_time_str}_{arr_time_str}".encode()
        ).hexdigest()

        return {
            "offerId": offer_id,
            "airline": airline,
            "flightNo": flight_no,
            "depAt": dep_at.isoformat() if dep_at else None,
            "arrAt": arr_at.isoformat() if arr_at else None,
            "durationMin": duration_min,
            "pricePerPerson": price_per_person,
            "totalPrice": int(total_price),
            "currency": "KRW",
            "seatAvailabilityNote": "제공사 확인 필요",
            "direction": direction
        }

    def _ms_combine_roundtrip_offer(
        self,
        outbound: Dict,
        inbound: Dict,
        adults: int,
        children: int,
        infants: int
    ) -> Dict:
        """
        왕복 항공편 조합

        가는편 + 오는편을 하나의 offer로 조합
        """
        out_offer = self._ms_convert_to_offer_summary(
            outbound, adults, children, infants, "OUTBOUND"
        )
        in_offer = self._ms_convert_to_offer_summary(
            inbound, adults, children, infants, "INBOUND"
        )

        # 왕복 offer ID 생성
        import hashlib
        roundtrip_id = hashlib.md5(
            f"{out_offer['offerId']}_{in_offer['offerId']}".encode()
        ).hexdigest()

        return {
            "offerId": roundtrip_id,
            "tripType": "ROUNDTRIP",
            "outbound": out_offer,
            "inbound": in_offer,
            "totalPrice": out_offer["totalPrice"] + in_offer["totalPrice"],
            "currency": "KRW"
        }

    def _ms_parse_datetime(self, time_str: str | int | None) -> Optional[datetime]:
        """
        TAGO API 시각 형식 파싱을 안전하게 처리

        - 입력이 정수(예: 202501051430)로 올 수도 있어 문자열로 변환
        - 숫자 이외 문자가 섞여도 숫자만 추출해 앞 12자리 사용
        - 기대 형식: YYYYMMDDHHmm (12자리)
        """
        if time_str is None:
            return None

        # 문자열로 변환 후 숫자만 추출
        s = str(time_str)
        digits = ''.join(ch for ch in s if ch.isdigit())

        if len(digits) < 12:
            return None

        candidate = digits[:12]

        try:
            return datetime.strptime(candidate, "%Y%m%d%H%M")
        except ValueError:
            return None

    def _ms_calculate_mock_price(self, dep_airport: str, arr_airport: str) -> int:
        """
        Mock 가격 산정

        실제 API에는 가격 정보가 없으므로 임시로 계산
        """
        # 기본 가격표 (구간별)
        base_prices = {
            ("김포", "제주"): 65000,
            ("제주", "김포"): 65000,
            ("김포", "김해"): 55000,
            ("김해", "김포"): 55000,
            ("김포", "대구"): 45000,
            ("대구", "김포"): 45000,
        }

        # 매칭되는 가격 찾기
        price = base_prices.get((dep_airport, arr_airport), 50000)

        return price

    def _ms_extract_airline_name(self, flight_data: Dict, flight_no: str) -> str:
        """
        항공사 이름 추출하기 (3단계 시도)

        [왜 이렇게 하는지?]
        TAGO API에서 airlineNm 필드가 비어있는 경우가 있어요.
        그래서 편명(예: "OZ8141")에서 앞 2-3글자를 추출해서
        우리가 만든 매핑 테이블에서 찾습니다.

        단계:
        1. API의 airlineNm 필드 확인 → 있으면 사용
        2. 편명에서 항공사 코드 추출 (예: "OZ8141" → "OZ")
        3. 매핑 테이블에서 찾기 (예: "OZ" → "아시아나항공")
        4. 없으면 "Unknown" 반환

        Args:
            flight_data: TAGO API에서 받은 항공편 정보
            flight_no: 편명 (예: "OZ8141")

        Returns:
            항공사 이름 (예: "아시아나항공")
        """
        # [1단계] API에서 항공사명 확인
        airline_from_api = flight_data.get("airlineNm", "").strip()

        # API에 항공사명이 있고, "Unknown"이 아니면 사용
        if airline_from_api and airline_from_api != "Unknown":
            logger.info(f"[OK] API에서 항공사명 찾음: {airline_from_api}")
            return airline_from_api

        # [2단계] 편명에서 항공사 코드 추출
        # 편명 예시: "OZ8141" → 앞 2글자 "OZ"
        #           "KE1234" → 앞 2글자 "KE"
        #           "7C101" → 앞 2글자 "7C"
        if not flight_no:
            logger.warning("[주의] 편명이 없어서 항공사를 알 수 없습니다")
            return "Unknown"

        # 편명에서 숫자가 아닌 부분만 추출 (항공사 코드)
        # "OZ8141" → "OZ", "7C101" → "7C", "PTA/6501" → "PTA/"
        airline_code = ""
        for i, char in enumerate(flight_no):
            if char.isdigit():
                # 숫자가 나오면 그 앞까지가 항공사 코드
                airline_code = flight_no[:i]
                break

        if not airline_code:
            # 전부 문자인 경우 (드물지만) 앞 2-3자 사용
            airline_code = flight_no[:3]

        # 특수문자 제거 (슬래시, 공백, 하이픈 등)
        # "PTA/" → "PTA", "KE-123" → "KE"
        airline_code_clean = ''.join(c for c in airline_code if c.isalnum())

        logger.info(f"[확인] 편명 '{flight_no}'에서 항공사 코드 추출: '{airline_code}' → '{airline_code_clean}'")

        # [3단계] 매핑 테이블에서 찾기 (깨끗한 코드 사용)
        airline_name = self.AIRLINE_CODE_MAPPING.get(airline_code_clean)

        if airline_name:
            logger.info(f"[OK] 매핑 테이블에서 찾음: {airline_code_clean} → {airline_name}")
            return airline_name

        # [4단계] 못 찾으면 Unknown 반환
        logger.warning(f"[주의] 항공사 코드 '{airline_code_clean}'를 매핑 테이블에서 찾을 수 없습니다")
        return "Unknown"

    def _ms_apply_filters(self, results: List[Dict], filters: Dict) -> List[Dict]:
        """
        검색 결과에 필터 적용 (결과를 걸러내기)

        필터 옵션:
        - minPrice: 최소 가격 (이 가격보다 비싼 것만)
        - maxPrice: 최대 가격 (이 가격보다 싼 것만)
        - depTimeStart: 출발 시간 시작 (예: "09:00")
        - depTimeEnd: 출발 시간 끝 (예: "18:00")

        예시:
        filters = {
            "minPrice": 50000,
            "maxPrice": 100000,
            "depTimeStart": "09:00",
            "depTimeEnd": "18:00"
        }

        Args:
            results: 원본 검색 결과 (필터 적용 전)
            filters: 필터 조건들

        Returns:
            필터링된 결과 (조건에 맞는 것만)
        """
        filtered_results = results.copy()

        # 1. 가격 범위 필터
        # "50,000원 ~ 100,000원 사이만 보여줘!"
        min_price = filters.get('minPrice')
        max_price = filters.get('maxPrice')

        if min_price is not None:
            # totalPrice가 최소 가격보다 크거나 같은 것만
            filtered_results = [
                r for r in filtered_results
                if r.get('totalPrice', 0) >= min_price
            ]

        if max_price is not None:
            # totalPrice가 최대 가격보다 작거나 같은 것만
            filtered_results = [
                r for r in filtered_results
                if r.get('totalPrice', 0) <= max_price
            ]

        # 2. 출발 시간대 필터
        # "오전 9시 ~ 오후 6시 사이 출발만 보여줘!"
        dep_time_start = filters.get('depTimeStart')
        dep_time_end = filters.get('depTimeEnd')

        if dep_time_start or dep_time_end:
            filtered_results = [
                r for r in filtered_results
                if self._ms_check_departure_time_filter(r, dep_time_start, dep_time_end)
            ]

        return filtered_results

    def _ms_check_departure_time_filter(
        self,
        flight: Dict,
        time_start: Optional[str],
        time_end: Optional[str]
    ) -> bool:
        """
        출발 시간이 필터 범위 안에 있는지 확인

        Args:
            flight: 항공편 정보
            time_start: 시작 시간 (예: "09:00")
            time_end: 종료 시간 (예: "18:00")

        Returns:
            True: 필터 조건에 맞음
            False: 필터 조건에 안 맞음
        """
        # 편도인 경우
        dep_at_str = flight.get('depAt')

        # 왕복인 경우 (가는편 기준)
        if not dep_at_str and 'outbound' in flight:
            dep_at_str = flight['outbound'].get('depAt')

        if not dep_at_str:
            # 출발 시간 정보가 없으면 통과시킴
            return True

        try:
            # ISO 형식 파싱: "2025-01-15T09:00:00" → datetime
            from datetime import datetime
            dep_at = datetime.fromisoformat(dep_at_str.replace('Z', '+00:00'))
            dep_time = dep_at.strftime("%H:%M")  # "09:00" 형식

            # 시작 시간 체크
            if time_start and dep_time < time_start:
                return False

            # 종료 시간 체크
            if time_end and dep_time > time_end:
                return False

            return True

        except Exception as e:
            logger.error(f"출발 시간 필터 확인 중 오류: {e}")
            return True  # 오류 시 통과

    def _ms_apply_sort(self, results: List[Dict], sort: str) -> List[Dict]:
        """
        검색 결과 정렬 (순서 바꾸기)

        정렬 옵션:
        - PRICE_ASC: 가격 낮은 순 (오름차순)
        - PRICE_DESC: 가격 높은 순 (내림차순)
        - DEPARTURE_ASC: 출발시간 빠른 순 (오름차순)
        - DEPARTURE_DESC: 출발시간 늦은 순 (내림차순)

        Args:
            results: 정렬 전 결과
            sort: 정렬 방식

        Returns:
            정렬된 결과
        """
        # 정렬할 결과 복사본 만들기
        sorted_results = results.copy()

        # 1. 가격 낮은 순
        if sort == "PRICE_ASC":
            sorted_results.sort(key=lambda x: x.get('totalPrice', 0))

        # 2. 가격 높은 순
        elif sort == "PRICE_DESC":
            sorted_results.sort(key=lambda x: x.get('totalPrice', 0), reverse=True)

        # 3. 출발시간 빠른 순
        elif sort == "DEPARTURE_ASC":
            sorted_results.sort(key=lambda x: self._ms_get_departure_time(x))

        # 4. 출발시간 늦은 순
        elif sort == "DEPARTURE_DESC":
            sorted_results.sort(key=lambda x: self._ms_get_departure_time(x), reverse=True)

        return sorted_results

    def _ms_get_departure_time(self, flight: Dict) -> str:
        """
        항공편의 출발 시간 가져오기 (정렬용)

        편도/왕복 모두 처리

        Args:
            flight: 항공편 정보

        Returns:
            출발 시간 문자열 (ISO 형식)
        """
        # 편도인 경우
        dep_at = flight.get('depAt')

        # 왕복인 경우 (가는편 기준)
        if not dep_at and 'outbound' in flight:
            dep_at = flight['outbound'].get('depAt')

        # 출발 시간이 없으면 빈 문자열 반환 (정렬 시 맨 앞으로)
        return dep_at or ""
