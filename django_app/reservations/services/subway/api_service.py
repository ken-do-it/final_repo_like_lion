"""
지하철 경로 검색 서비스
- ODsay searchStation(역명 → 좌표) + searchPubTransPathT(좌표 → 경로) 사용

초보자용 요약
- 먼저 '강남' 같은 역 이름을 ODsay에 물어봐서 좌표를 받아요.
- 받은 좌표(SX,SY,EX,EY)로 '지하철 경로'를 검색해요.
- 결과를 정렬(빠른/환승적은/싼 요금)해서 최대 3개만 보내줘요.
"""
import logging
import requests
from django.conf import settings


class SubwayError(Exception):
    """지하철 관련 에러 표준화"""

    STATION_NOT_FOUND = ("SUBWAY_001", "역을 찾을 수 없습니다")
    NO_ROUTE = ("SUBWAY_002", "경로를 찾을 수 없습니다")
    ODSAY_ERROR = ("SUBWAY_003", "외부 API 오류")

    def __init__(self, error_tuple):
        self.code, self.message = error_tuple
        super().__init__(self.message)


logger = logging.getLogger(__name__)


class MSSubwayAPIService:
    """
    ODsay API 연동 서비스
    - 역명 → 좌표(searchStation)
    - 좌표 → 경로(searchPubTransPathT)
    - 옵션 정렬 후 최대 3개 반환
    """

    BASE_URL = "https://api.odsay.com/v1/api"

    # 노선 색상 코드(일부)
    LINE_COLORS = {
        "1호선": "#0052A4",
        "2호선": "#00A84D",
        "3호선": "#EF7C1C",
        "4호선": "#00A5DE",
        "5호선": "#996CAC",
        "6호선": "#CD7C2F",
        "7호선": "#747F00",
        "8호선": "#E6186C",
        "9호선": "#BDB092",
        "경의중앙선": "#77C4A3",
        "공항철도": "#0090D2",
        "경춘선": "#0C8E72",
        "수인분당선": "#FABE00",
        "신분당선": "#D4003B",
        "우이신설선": "#B0CE18",
        "서해선": "#8FC31F",
        "김포골드라인": "#A17E00",
        "신림선": "#6789CA",
        # 부산/대구/광주/대전 일부 생략
    }

    def __init__(self):
        """API 키 초기화"""
        self.api_key = settings.ODSAY_API_KEY
        if not self.api_key:
            raise ValueError("ODSAY_API_KEY가 설정되지 않았습니다.")

    # =============== 내부 유틸 ===============
    def _mask_api_key(self, key: str) -> str:
        """로그에 노출 시 API 키 일부만 보여주기(보안)"""
        if not key or len(key) < 6:
            return "****"
        return f"{key[:3]}****{key[-3:]}"

    # =============== 외부 API 호출 ===============
    def _ms_get_station_coords(self, station_name: str) -> dict:
        """
        역 이름으로 좌표를 조회합니다(searchStation).

        - '역' 접미사는 제거해도 검색이 잘 됩니다.
        - 다국어/다도시 혼재 시에는 '도시 바운딩박스 필터'를 추가로 적용할 수 있어요(선택).
        """
        query = station_name.replace("역", "").strip()

        url = f"{self.BASE_URL}/searchStation"
        params = {
            "apiKey": self.api_key,  # requests가 안전하게 인코딩
            "stationName": query,
        }

        try:
            logger.debug(
                "ODsay searchStation: stationName=%s, apiKey=%s",
                query,
                self._mask_api_key(self.api_key),
            )
            resp = requests.get(url, params=params, timeout=8)
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                logger.error("ODsay searchStation 오류: %s", data["error"])
                raise SubwayError(SubwayError.ODSAY_ERROR)

            stations = data.get("result", {}).get("station", [])
            if not stations:
                raise SubwayError(SubwayError.STATION_NOT_FOUND)

            # 간단화: 최상위 1개 사용(도시 필터/이름 완전일치/거리 근접 로직은 선택 구현)
            top = stations[0]
            return {"lng": float(top.get("x")), "lat": float(top.get("y"))}

        except requests.RequestException as e:
            logger.error("searchStation 네트워크 오류: %s", e)
            raise SubwayError(SubwayError.ODSAY_ERROR)

    # =============== 공개 메서드 ===============
    def ms_search_subway_route(
        self,
        from_station: str,
        to_station: str,
        option: str = "FAST",
    ) -> dict:
        """
        지하철 경로를 검색합니다(좌표 기반 경로검색).

        1) 역명 → 좌표(searchStation)
        2) 좌표 → 경로(searchPubTransPathT)
        3) 옵션 정렬 후 최대 3개 반환
        """
        # 1. 출발/도착 좌표 조회
        from_xy = self._ms_get_station_coords(from_station)
        to_xy = self._ms_get_station_coords(to_station)

        # 2. searchPubTransPathT 호출(지하철 위주: SearchPathType=1, 추천: OPT=0)
        url = f"{self.BASE_URL}/searchPubTransPathT"
        params = {
            "apiKey": self.api_key,
            "SX": from_xy["lng"],
            "SY": from_xy["lat"],
            "EX": to_xy["lng"],
            "EY": to_xy["lat"],
            "SearchPathType": 1,  # 지하철 위주
            "OPT": 0,              # 추천(서버에서 재정렬)
        }

        try:
            logger.debug(
                "ODsay searchPubTransPathT: from=%s,to=%s, params=%s",
                from_station,
                to_station,
                {k: (self._mask_api_key(v) if k == 'apiKey' else v) for k, v in params.items()},
            )
            resp = requests.get(url, params=params, timeout=10)
            logger.debug("ODsay 응답 코드: %s", resp.status_code)
            logger.debug("ODsay 응답(앞부분): %s", resp.text[:500])
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                logger.error("ODsay 경로검색 오류: %s", data["error"])
                raise SubwayError(SubwayError.ODSAY_ERROR)

            # 3. 응답 변환 → 옵션 정렬 → 상위 3개
            routes = self._ms_transform_odsay_response(data)
            if not routes:
                raise SubwayError(SubwayError.NO_ROUTE)

            routes = self._ms_sort_routes(routes, option)
            return {"routes": routes[:3]}

        except requests.RequestException as e:
            logger.error("경로검색 네트워크 오류: %s", e)
            raise SubwayError(SubwayError.ODSAY_ERROR)

    # =============== 변환/정렬 ===============
    def _ms_transform_odsay_response(self, data: dict) -> list:
        """
        ODsay searchPubTransPathT 응답을 우리 스키마로 변환합니다.
        - duration: 총 소요시간(분)
        - transfers: 환승 횟수
        - fare: {card, cash}
        - steps: [{ line, lineColor, from, to, stations, duration }]
        """
        result = data.get("result", {})
        path_list = result.get("path", [])

        routes = []
        for path in path_list:
            info = path.get("info", {})
            sub_path_list = path.get("subPath", [])

            total_time = info.get("totalTime", 0)  # 분
            transfer_count = info.get("busTransitCount", 0) + info.get("subwayTransitCount", 0) - 1
            if transfer_count < 0:
                transfer_count = 0

            payment = info.get("payment", 0)
            fare = {
                "card": payment,
                "cash": payment + 100,  # 현금은 카드보다 100원 비쌈(보수적 가정)
            }

            steps = []
            for sub_path in sub_path_list:
                if sub_path.get("trafficType") == 1:  # 지하철만
                    lane = (sub_path.get("lane") or [{}])[0]
                    line_name = lane.get("name", "")
                    steps.append(
                        {
                            "line": line_name,
                            "lineColor": self.LINE_COLORS.get(line_name, "#999999"),
                            "from": sub_path.get("startName", ""),
                            "to": sub_path.get("endName", ""),
                            "stations": sub_path.get("stationCount", 0),
                            "duration": sub_path.get("sectionTime", 0),  # 분
                        }
                    )

            routes.append(
                {
                    "duration": total_time,
                    "transfers": transfer_count,
                    "fare": fare,
                    "steps": steps,
                }
            )

        return routes

    def _ms_sort_routes(self, routes: list, option: str) -> list:
        """옵션에 따라 경로 정렬"""
        if option == "FEW_TRANSFER":
            routes.sort(key=lambda x: (x.get("transfers", 0), x.get("duration", 0)))
        elif option == "CHEAP":
            routes.sort(key=lambda x: (x.get("fare", {}).get("card", 0), x.get("duration", 0)))
        else:  # FAST
            routes.sort(key=lambda x: x.get("duration", 0))
        return routes

