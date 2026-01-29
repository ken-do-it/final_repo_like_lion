"""
마이페이지 팀이 재사용할 수 있는 "내 예약 조회 전용" 도메인 서비스

초등학생도 이해할 수 있게 아주 쉽게 설명해요!

이 파일은 "데이터를 DB에서 꺼내어 보기 좋게 담아 주는 역할"만 해요.
즉, URL/뷰(엔드포인트)는 마이페이지 팀이 만들고,
그 뷰에서 이 서비스를 불러서 결과를 받아가면 됩니다.

중요한 약속(공통환경/스펙 준수)
- 목록 정렬: createdAt 내림차순
- 필터: type?, status?, fromDate?, toDate? (from/to는 startAt 기준, YYYY-MM-DD)
- 페이징: page(기본 1), limit(기본 20)
- 상세 include: "segments,passengers,seats" 중 원하는 것을 콤마로 전달

주의: 이 파일은 reservations 폴더 안에서만 사용되며, 다른 폴더 수정은 필요 없습니다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date, time, timezone as py_timezone
from typing import Dict, List, Optional, Tuple

from django.db.models import QuerySet
from django.utils import timezone

from ..models import (
    Reservation,
    ReservationFlight,
    ReservationFlightSegment,
    ReservationPassenger,
    ReservationSeatSelection,
)


@dataclass
class PageInfo:
    """
    페이징 정보(몇 페이지, 한 페이지에 몇 개, 전체 몇 개인지)
    """
    page: int
    limit: int
    total: int


class MSMyReservationQueryService:
    """
    마이페이지에서 재사용하는 "내 예약 조회" 전용 서비스

    - list_user_reservations: 내 예약 목록을 가져와요
    - get_user_reservation_detail: 내 예약 한 건의 자세한 내용을 가져와요

    여기서는 "DB에서 꺼내서 딕셔너리로 변환"만 하고, 실제 응답(JSON 직렬화)은
    serializers/my_reservation.py에서 해요.
    """

    # -------------------------------
    # 목록 조회
    # -------------------------------
    def list_user_reservations(
        self,
        user,
        filters: Optional[Dict] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict:
        """
        내 예약 목록을 가져옵니다.

        - filters: {'type': 'FLIGHT', 'status': 'CONFIRMED_TEST', 'fromDate': '2024-01-01', 'toDate': '2024-12-31'}
          fromDate/toDate는 startAt(여행 시작일) 기준입니다.
        - page, limit: 페이지네이션 정보

        반환 형태(딕셔너리):
        {
          'items': [ {...}, {...} ],
          'pageInfo': {'page': 1, 'limit': 20, 'total': 3}
        }
        """
        filters = filters or {}

        # 1) 내 예약만 기본으로 가져오기
        qs: QuerySet[Reservation] = Reservation.objects.filter(user=user)

        # 2) 필터 적용
        res_type = self._get_str(filters, 'type')
        if res_type:
            qs = qs.filter(type=res_type)

        status_value = self._get_str(filters, 'status')
        if status_value:
            qs = qs.filter(status=status_value)

        # fromDate/toDate는 startAt(여행 시작일) 기준
        from_date = self._parse_date_safe(self._get_str(filters, 'fromDate'))
        to_date = self._parse_date_safe(self._get_str(filters, 'toDate'))

        if from_date:
            # 하루의 시작(00:00:00)부터
            start_dt = datetime.combine(from_date, time.min).replace(tzinfo=py_timezone.utc)
            qs = qs.filter(start_at__gte=start_dt)

        if to_date:
            # 하루의 끝(23:59:59)까지
            end_dt = datetime.combine(to_date, time.max).replace(tzinfo=py_timezone.utc)
            qs = qs.filter(start_at__lte=end_dt)

        # 3) 정렬: createdAt desc (공통 스펙)
        qs = qs.order_by('-created_at')

        # 4) 총 개수/페이지 계산 후 슬라이스
        total = qs.count()
        page = self._coerce_positive_int(page, default=1)
        limit = self._coerce_positive_int(limit, default=20, minimum=1, maximum=100)
        offset = (page - 1) * limit
        qs = qs[offset : offset + limit]

        # 5) 아이템 변환
        items: List[Dict] = [self._to_list_item_dict(r) for r in qs]

        return {
            'items': items,
            'pageInfo': {
                'page': page,
                'limit': limit,
                'total': total,
            },
        }

    # -------------------------------
    # 상세 조회
    # -------------------------------
    def get_user_reservation_detail(
        self,
        user,
        reservation_id,
        include: Optional[str] = None,
    ) -> Dict:
        """
        내 예약 상세를 가져옵니다.

        - 권한(소유권) 체크: 내 예약만 조회 가능
        - 기본 포함: reservation + flightDetail
        - include(쉼표분리): segments, passengers, seats 중 골라서 추가

        반환 형태(딕셔너리):
        {
          'reservation': {...},
          'flightDetail': {...},
          'segments': [...],        # include에 있을 때만
          'passengers': [...],      # include에 있을 때만
          'seats': [...],           # include에 있을 때만
        }
        """
        # 1) 내 예약 하나 가져오기(없으면 예외)
        try:
            reservation: Reservation = Reservation.objects.get(id=reservation_id, user=user)
        except Reservation.DoesNotExist:
            # 마이페이지 뷰에서 404를 리턴하도록, 표준 예외를 던져요.
            raise Reservation.DoesNotExist("Reservation not found or not owned by user")

        # 2) 기본 응답(공통)
        data: Dict = {
            'reservation': self._to_reservation_dict(reservation),
            'flightDetail': self._to_flight_detail_dict(reservation),
        }

        # 3) include 파싱: 'segments,passengers,seats'
        include_set = self._parse_include(include)

        if 'segments' in include_set:
            segments = ReservationFlightSegment.objects.filter(reservation=reservation).order_by('direction', 'segment_no')
            data['segments'] = [self._to_segment_dict(s) for s in segments]

        if 'passengers' in include_set:
            passengers = ReservationPassenger.objects.filter(reservation=reservation)
            data['passengers'] = [self._to_passenger_dict(p) for p in passengers]

        if 'seats' in include_set:
            seats = ReservationSeatSelection.objects.filter(reservation=reservation)
            data['seats'] = [self._to_seat_dict(s) for s in seats]

        return data

    # -------------------------------
    # 내부: 변환 함수들(모델 → 딕셔너리)
    # -------------------------------
    def _to_list_item_dict(self, r: Reservation) -> Dict:
        return {
            'reservationId': str(r.id),
            'title': r.title,
            'type': r.type,
            'status': r.status,
            'startAt': r.start_at,
            'endAt': r.end_at,
            'totalAmount': r.total_amount,
            'currency': r.currency,
            'testOrderNo': r.test_order_no,
            'createdAt': r.created_at,
        }

    def _to_reservation_dict(self, r: Reservation) -> Dict:
        return {
            'reservationId': str(r.id),
            'title': r.title,
            'type': r.type,
            'status': r.status,
            'startAt': r.start_at,
            'endAt': r.end_at,
            'totalAmount': r.total_amount,
            'currency': r.currency,
            'testOrderNo': r.test_order_no,
            'createdAt': r.created_at,
        }

    def _to_flight_detail_dict(self, r: Reservation) -> Optional[Dict]:
        # 항공 상세는 1:1 관계. 없을 수도 있어 None 처리
        fd: Optional[ReservationFlight]
        try:
            fd = r.flight_detail
        except ReservationFlight.DoesNotExist:  # type: ignore[attr-defined]
            fd = None

        if not fd:
            return None

        return {
            'tripType': fd.trip_type,
            'cabinClass': fd.cabin_class,
            'adults': fd.adults,
            'children': fd.children,
            'infants': fd.infants,
            'baggageInfo': fd.baggage_info,
            'refundRule': fd.refund_rule,
            'specialRequest': fd.special_request,
            'contactEmail': fd.contact_email,
            'contactPhone': fd.contact_phone,
        }

    def _to_segment_dict(self, s: ReservationFlightSegment) -> Dict:
        return {
            'id': str(s.id),
            'direction': s.direction,
            'segmentNo': s.segment_no,
            'airlineCode': s.airline_code,
            'flightNo': s.flight_no,
            'depAirport': s.dep_airport,
            'arrAirport': s.arr_airport,
            'depAt': s.dep_at,
            'arrAt': s.arr_at,
            'durationMin': s.duration_min,
            'farePerPerson': s.fare_per_person,
            'seatAvailabilityNote': s.seat_availability_note,
        }

    def _to_passenger_dict(self, p: ReservationPassenger) -> Dict:
        return {
            'id': str(p.id),
            'passengerType': p.passenger_type,
            'fullName': p.full_name,
            'birthDate': p.birth_date,
            'passportNo': p.passport_no,
        }

    def _to_seat_dict(self, s: ReservationSeatSelection) -> Dict:
        return {
            'id': str(s.id),
            'passengerId': str(s.passenger_id) if s.passenger_id else None,
            'direction': s.direction,
            'segmentNo': s.segment_no,
            'seatNo': s.seat_no,
            'seatNote': s.seat_note,
        }

    # -------------------------------
    # 내부: 유틸리티(입력 파싱)
    # -------------------------------
    def _get_str(self, m: Dict, key: str) -> Optional[str]:
        v = m.get(key)
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    def _parse_date_safe(self, s: Optional[str]) -> Optional[date]:
        if not s:
            return None
        try:
            return date.fromisoformat(s)
        except Exception:
            return None

    def _coerce_positive_int(self, v, *, default: int, minimum: int = 1, maximum: int = 10_000) -> int:
        try:
            i = int(v)
        except Exception:
            return default
        if i < minimum:
            return minimum
        if i > maximum:
            return maximum
        return i

    def _parse_include(self, include: Optional[str]) -> set:
        if not include:
            return set()
        parts = [p.strip().lower() for p in str(include).split(',') if p.strip()]
        # 허용된 키만 남겨요
        allowed = {'segments', 'passengers', 'seats'}
        return {p for p in parts if p in allowed}

