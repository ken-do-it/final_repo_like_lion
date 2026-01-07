"""
예약 생성 서비스
- 항공편 예약을 DB에 저장하는 비즈니스 로직
"""
import uuid
from datetime import datetime
from django.db import transaction
from django.utils import timezone
from typing import Dict, List, Optional
import logging

from ..models import (
    Reservation,
    ReservationFlight,
    ReservationFlightSegment,
    ReservationPassenger,
    ReservationSeatSelection
)

logger = logging.getLogger(__name__)


class MSReservationService:
    """
    예약 생성 서비스

    역할:
    - 항공편 예약 정보를 DB에 저장
    - 여러 테이블에 걸쳐 있는 데이터를 한 번에 저장 (트랜잭션)
    """

    @transaction.atomic  # 🔹 트랜잭션: 모두 성공하거나 모두 실패
    def ms_create_flight_reservation(
        self,
        user,
        offer_id: str,
        trip_type: str,
        cabin_class: str,
        passengers: List[Dict],
        flight_data: Dict,  # 항공편 정보 (검색 결과에서 가져옴)
        contacts: Optional[Dict] = None,
        requests: Optional[Dict] = None,
        seat_selections: Optional[List[Dict]] = None
    ) -> Reservation:
        """
        항공편 예약 생성

        Args:
            user: 사용자 객체
            offer_id: 선택한 항공편 Offer ID
            trip_type: 편도(ONEWAY) 또는 왕복(ROUNDTRIP)
            cabin_class: 좌석 등급
            passengers: 승객 정보 리스트
            flight_data: 항공편 정보 (출발/도착 시간, 가격 등)
            contacts: 연락처 정보 (선택사항)
            requests: 특별 요청사항 (선택사항)
            seat_selections: 좌석 선택 (선택사항, 테스트용)

        Returns:
            생성된 Reservation 객체

        동작 순서:
        1. 테스트 주문번호 생성
        2. Reservation 생성 (공통 예약 정보)
        3. ReservationFlight 생성 (항공 상세 정보)
        4. ReservationFlightSegment 생성 (구간 정보)
        5. ReservationPassenger 생성 (승객 정보)
        6. ReservationSeatSelection 생성 (좌석 선택, 있으면)
        """
        # 1. 테스트 주문번호 생성
        # 예: FLT_1704441234567_ABCD1234
        test_order_no = self._ms_generate_test_order_no(prefix="FLT")

        # 2. 예약 제목 생성
        # 예: "GMP → CJU (테스트)"
        title = self._ms_generate_reservation_title(flight_data, trip_type)

        # 3. 시작/종료 시간 추출
        start_at, end_at = self._ms_extract_datetime_range(flight_data, trip_type)

        # 4. 총 금액 추출
        total_amount = flight_data.get('totalPrice', 0)

        # Step 1: Reservation 생성 (공통 예약 테이블)
        reservation = Reservation.objects.create(
            user=user,
            type=Reservation.ReservationType.FLIGHT,
            status=Reservation.ReservationStatus.CONFIRMED_TEST,  # 테스트 예약
            title=title,
            start_at=start_at,
            end_at=end_at,
            total_amount=total_amount,
            currency='KRW',
            provider='TAGO_API',  # 항공 데이터 제공사
            provider_ref=offer_id,  # Offer ID
            test_order_no=test_order_no
        )

        logger.info(f"[OK] Reservation 생성 완료: {reservation.id} ({test_order_no})")

        # Step 2: ReservationFlight 생성 (항공 상세 정보)
        # 인원 수 계산
        adults_count = sum(1 for p in passengers if p['passengerType'] == 'ADT')
        children_count = sum(1 for p in passengers if p['passengerType'] == 'CHD')
        infants_count = sum(1 for p in passengers if p['passengerType'] == 'INF')

        reservation_flight = ReservationFlight.objects.create(
            reservation=reservation,
            trip_type=trip_type,
            cabin_class=cabin_class,
            adults=adults_count,
            children=children_count,
            infants=infants_count,
            baggage_info="위탁 수하물 1개 (23kg), 기내 수하물 1개 (10kg)",  # Mock
            refund_rule="출발 24시간 전: 무료 취소, 그 이후: 수수료 부과",  # Mock
            special_request=requests.get('specialRequest') if requests else None,
            contact_email=contacts.get('contactEmail') if contacts else None,
            contact_phone=contacts.get('contactPhone') if contacts else None
        )

        logger.info(f"[OK] ReservationFlight 생성 완료: {reservation.id}")

        # Step 3: ReservationFlightSegment 생성 (구간 정보)
        self._ms_create_flight_segments(reservation, flight_data, trip_type)

        # Step 4: ReservationPassenger 생성 (승객 정보)
        passenger_objects = self._ms_create_passengers(reservation, passengers)

        # Step 5: ReservationSeatSelection 생성 (좌석 선택, 테스트용)
        if seat_selections:
            self._ms_create_seat_selections(
                reservation,
                passenger_objects,
                seat_selections
            )

        logger.info(f"[OK] 예약 생성 완료: {reservation.id} ({test_order_no})")

        return reservation

    def _ms_generate_test_order_no(self, prefix: str = "ORD") -> str:
        """
        테스트 주문번호 생성

        형식: PREFIX_타임스탬프_랜덤8자
        예: FLT_1704441234567_ABCD1234

        Args:
            prefix: 주문번호 접두사 (예: FLT, TRN 등)

        Returns:
            테스트 주문번호
        """
        import time

        # 현재 시간 (밀리초)
        timestamp = int(time.time() * 1000)

        # 랜덤 8자 (UUID에서 추출)
        random_id = str(uuid.uuid4()).replace('-', '').upper()[:8]

        return f"{prefix}_{timestamp}_{random_id}"

    def _ms_generate_reservation_title(self, flight_data: Dict, trip_type: str) -> str:
        """
        예약 제목 생성

        예시:
        - 편도: "GMP → CJU (테스트)"
        - 왕복: "GMP ⇄ CJU (테스트)"

        Args:
            flight_data: 항공편 정보
            trip_type: 편도/왕복

        Returns:
            예약 제목
        """
        # 편도인 경우
        if trip_type == 'ONEWAY':
            dep_airport = flight_data.get('depAirport', 'N/A')
            arr_airport = flight_data.get('arrAirport', 'N/A')
            return f"{dep_airport} → {arr_airport} (테스트)"

        # 왕복인 경우
        elif trip_type == 'ROUNDTRIP':
            outbound = flight_data.get('outbound', {})
            dep_airport = outbound.get('depAirport', 'N/A')
            arr_airport = outbound.get('arrAirport', 'N/A')
            return f"{dep_airport} ⇄ {arr_airport} (테스트)"

        return "항공편 예약 (테스트)"

    def _ms_extract_datetime_range(self, flight_data: Dict, trip_type: str) -> tuple:
        """
        항공편 정보에서 시작/종료 시간 추출

        Args:
            flight_data: 항공편 정보
            trip_type: 편도/왕복

        Returns:
            (start_at, end_at) 튜플
        """
        # 편도인 경우
        if trip_type == 'ONEWAY':
            dep_at_str = flight_data.get('depAt')
            arr_at_str = flight_data.get('arrAt')

            start_at = datetime.fromisoformat(dep_at_str.replace('Z', '+00:00')) if dep_at_str else timezone.now()
            end_at = datetime.fromisoformat(arr_at_str.replace('Z', '+00:00')) if arr_at_str else None

            return start_at, end_at

        # 왕복인 경우
        elif trip_type == 'ROUNDTRIP':
            outbound = flight_data.get('outbound', {})
            inbound = flight_data.get('inbound', {})

            dep_at_str = outbound.get('depAt')
            arr_at_str = inbound.get('arrAt')

            start_at = datetime.fromisoformat(dep_at_str.replace('Z', '+00:00')) if dep_at_str else timezone.now()
            end_at = datetime.fromisoformat(arr_at_str.replace('Z', '+00:00')) if arr_at_str else None

            return start_at, end_at

        # 기본값
        return timezone.now(), None

    def _ms_create_flight_segments(
        self,
        reservation: Reservation,
        flight_data: Dict,
        trip_type: str
    ):
        """
        항공 구간 정보 생성

        편도: 가는편 1개
        왕복: 가는편 1개 + 오는편 1개

        Args:
            reservation: Reservation 객체
            flight_data: 항공편 정보
            trip_type: 편도/왕복
        """
        # 편도인 경우
        if trip_type == 'ONEWAY':
            self._ms_create_segment(
                reservation=reservation,
                segment_data=flight_data,
                direction='OUTBOUND',
                segment_no=1
            )

        # 왕복인 경우
        elif trip_type == 'ROUNDTRIP':
            outbound = flight_data.get('outbound', {})
            inbound = flight_data.get('inbound', {})

            # 가는편
            self._ms_create_segment(
                reservation=reservation,
                segment_data=outbound,
                direction='OUTBOUND',
                segment_no=1
            )

            # 오는편
            self._ms_create_segment(
                reservation=reservation,
                segment_data=inbound,
                direction='INBOUND',
                segment_no=1
            )

        logger.info(f"[OK] Segments 생성 완료: {reservation.id}")

    def _ms_create_segment(
        self,
        reservation: Reservation,
        segment_data: Dict,
        direction: str,
        segment_no: int
    ):
        """
        단일 구간 생성

        Args:
            reservation: Reservation 객체
            segment_data: 구간 정보
            direction: OUTBOUND(가는편) 또는 INBOUND(오는편)
            segment_no: 구간 번호
        """
        # 시간 파싱
        dep_at_str = segment_data.get('depAt')
        arr_at_str = segment_data.get('arrAt')

        dep_at = datetime.fromisoformat(dep_at_str.replace('Z', '+00:00')) if dep_at_str else timezone.now()
        arr_at = datetime.fromisoformat(arr_at_str.replace('Z', '+00:00')) if arr_at_str else timezone.now()

        ReservationFlightSegment.objects.create(
            reservation=reservation,
            direction=direction,
            segment_no=segment_no,
            airline_code=segment_data.get('airline', 'N/A')[:3],  # 3자로 제한
            flight_no=segment_data.get('flightNo'),
            dep_airport=segment_data.get('depAirport', 'N/A'),
            arr_airport=segment_data.get('arrAirport', 'N/A'),
            dep_at=dep_at,
            arr_at=arr_at,
            duration_min=segment_data.get('durationMin'),
            fare_per_person=segment_data.get('pricePerPerson'),
            seat_availability_note=segment_data.get('seatAvailabilityNote')
        )

    def _ms_create_passengers(
        self,
        reservation: Reservation,
        passengers: List[Dict]
    ) -> List[ReservationPassenger]:
        """
        승객 정보 생성

        Args:
            reservation: Reservation 객체
            passengers: 승객 정보 리스트

        Returns:
            생성된 ReservationPassenger 객체 리스트
        """
        passenger_objects = []

        for passenger_data in passengers:
            # 생년월일 파싱
            birth_date = passenger_data.get('birthDate')

            passenger = ReservationPassenger.objects.create(
                reservation=reservation,
                passenger_type=passenger_data['passengerType'],
                full_name=passenger_data['fullName'],
                birth_date=birth_date,
                passport_no=passenger_data.get('passportNo')
            )

            passenger_objects.append(passenger)

        logger.info(f"[OK] Passengers 생성 완료: {len(passenger_objects)}명")

        return passenger_objects

    def _ms_create_seat_selections(
        self,
        reservation: Reservation,
        passenger_objects: List[ReservationPassenger],
        seat_selections: List[Dict]
    ):
        """
        좌석 선택 정보 생성 (테스트용)

        [주의] 실제 좌석 배정에는 반영되지 않습니다!

        Args:
            reservation: Reservation 객체
            passenger_objects: 승객 객체 리스트
            seat_selections: 좌석 선택 정보 리스트
        """
        for seat_data in seat_selections:
            # 승객 매칭 (간단하게 인덱스로 매칭)
            passenger = passenger_objects[0] if passenger_objects else None

            ReservationSeatSelection.objects.create(
                reservation=reservation,
                passenger=passenger,
                direction=seat_data['direction'],
                segment_no=seat_data['segmentNo'],
                seat_no=seat_data.get('seatNo'),
                seat_note=seat_data.get('seatNote')
            )

        logger.info(f"[OK] Seat Selections 생성 완료: {len(seat_selections)}개")
