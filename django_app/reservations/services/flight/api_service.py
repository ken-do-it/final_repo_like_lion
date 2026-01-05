"""
항공편 검색 API 서비스
- 한국공항공사 공공 API 연동
- TAGO(국토교통부) API 연동
"""
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

    def __init__(self):
        """
        API 키 설정

        환경변수 필요:
        - TAGO_SERVICE_KEY: TAGO API 인증키
        - KAC_SERVICE_KEY: 한국공항공사 API 인증키
        """
        self.tago_key = getattr(settings, 'TAGO_SERVICE_KEY', None)
        self.kac_key = getattr(settings, 'KAC_SERVICE_KEY', None)

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
        cabin_class: str = "ECONOMY"
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
                timeout=10
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
        # 편명
        flight_no = flight_data.get("vihicleId", "")

        # 항공사
        airline = flight_data.get("airlineNm", "Unknown")

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

    def _ms_parse_datetime(self, time_str: str) -> Optional[datetime]:
        """
        TAGO API 시각 형식 파싱

        형식: YYYYMMDDHHmm (예: "202501051430")
        """
        if not time_str or len(time_str) < 12:
            return None

        try:
            return datetime.strptime(time_str, "%Y%m%d%H%M")
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
