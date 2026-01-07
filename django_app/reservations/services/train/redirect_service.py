"""
코레일 외부 이동 링크 생성 서비스
- 검색 조건을 바탕으로 코레일 예약 페이지 URL 생성
- 외국인 관광객을 위한 Korail Pass 링크 제공
"""
from datetime import date
from urllib.parse import urlencode
import logging

logger = logging.getLogger(__name__)


class MSKorailRedirectService:
    """
    코레일 외부 링크 생성 서비스

    사용자가 기차를 선택한 후 외부 예약 사이트(코레일)로 이동할 때 사용
    """

    # 코레일 예약 페이지 (일반)
    KORAIL_BOOKING_URL = "https://www.letskorail.com/ebizprd/prdMain.do"

    # 코레일 외국인 전용 페이지
    KORAIL_GLOBAL_URL = "https://www.korail.com/global/eng/main.do"

    # 코레일 패스 안내 페이지 (외국인 관광객용)
    KORAIL_PASS_URL = "https://www.korail.com/global/eng/passengerGuide/ticketTypes/korailpass"

    def ms_generate_korail_link(
        self,
        from_station: str,
        to_station: str,
        depart_date: date,
        passengers: int = 1
    ) -> str:
        """
        코레일 예약 페이지 링크 생성

        Args:
            from_station: 출발역 이름
            to_station: 도착역 이름
            depart_date: 출발일
            passengers: 승객 수

        Returns:
            코레일 예약 페이지 URL
        """
        try:
            # 코레일 예약 시스템의 파라미터 형식에 맞춰 URL 생성
            # 실제 코레일 API 문서가 있다면 정확한 파라미터 사용 필요
            # 현재는 일반적인 검색 파라미터 형식 사용

            params = {
                # 일반 열차 예약 파라미터 (코레일 실제 파라미터명 확인 필요)
                "txtGoStart": from_station,  # 출발역
                "txtGoEnd": to_station,  # 도착역
                "selGoYear": depart_date.year,  # 출발 년도
                "selGoMonth": f"{depart_date.month:02d}",  # 출발 월
                "selGoDay": f"{depart_date.day:02d}",  # 출발 일
                "txtPsgFlg_1": passengers,  # 성인 승객 수
                "txtPsgFlg_2": 0,  # 어린이 승객 수
                "txtPsgFlg_3": 0,  # 경로 승객 수
            }

            # URL 생성
            url = f"{self.KORAIL_BOOKING_URL}?{urlencode(params)}"

            logger.info(f"코레일 링크 생성: {from_station} -> {to_station} ({depart_date})")
            return url

        except Exception as e:
            logger.error(f"코레일 링크 생성 실패: {e}")
            # 실패 시 메인 페이지 반환
            return self.KORAIL_BOOKING_URL

    def ms_get_korail_global_link(self) -> str:
        """
        코레일 외국인 전용 페이지 링크

        Returns:
            코레일 글로벌 메인 페이지 URL
        """
        return self.KORAIL_GLOBAL_URL

    def ms_get_korail_pass_link(self) -> str:
        """
        코레일 패스 안내 페이지 링크 (외국인 관광객용)

        Returns:
            코레일 패스 안내 페이지 URL
        """
        return self.KORAIL_PASS_URL
