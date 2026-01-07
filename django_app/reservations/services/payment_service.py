"""
결제 서비스 - 토스페이먼츠 연동
- 결제 생성, 승인, 취소
"""
import requests
import logging
from django.conf import settings
from django.utils import timezone
from typing import Optional
from ..models import PaymentTransaction

logger = logging.getLogger(__name__)


class MSTossPaymentsService:
    """
    토스페이먼츠 결제 서비스

    [주요 기능]
    1. ms_create_payment: 결제 요청 생성
    2. ms_confirm_payment: 결제 승인
    3. ms_cancel_payment: 결제 취소
    4. ms_get_payment: 결제 정보 조회
    """

    BASE_URL = "https://api.tosspayments.com/v1"

    def __init__(self):
        """토스페이먼츠 API 키 설정"""
        self.secret_key = settings.TOSS_PAYMENTS["SECRET_KEY"]
        self.client_key = settings.TOSS_PAYMENTS["CLIENT_KEY"]

    def _get_headers(self) -> dict:
        """
        인증 헤더 생성

        [설명]
        토스페이먼츠는 시크릿 키를 Base64로 인코딩해서 보냅니다.
        "시크릿키:" 형태로 만들고 (콜론 포함!) Base64 인코딩합니다.

        Returns:
            인증 헤더 딕셔너리
        """
        import base64

        # "시크릿키:" 형태로 만들고 Base64 인코딩
        credentials = base64.b64encode(f"{self.secret_key}:".encode()).decode()

        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def ms_create_payment(
        self,
        user,
        amount: int,
        order_name: str,
        reservation=None
    ) -> PaymentTransaction:
        """
        결제 요청 생성

        [동작 순서]
        1. 주문번호(order_id) 생성
        2. PaymentTransaction 객체 생성
        3. DB에 저장 (상태: READY)

        Args:
            user: 사용자 객체
            amount: 결제 금액 (원)
            order_name: 주문명 (예: "김포→제주 항공권")
            reservation: 예약 객체 (선택)

        Returns:
            생성된 PaymentTransaction 객체
        """
        # 주문번호 생성 (예: FLT_1704441234567_ABCD1234)
        order_id = self._ms_generate_order_id("FLT")

        # PaymentTransaction 생성
        payment = PaymentTransaction.objects.create(
            order_id=order_id,
            user=user,
            amount=amount,
            reservation=reservation,
            status=PaymentTransaction.PaymentStatus.READY,
            provider="TOSS_PAYMENTS",
        )

        logger.info(f"[OK] 결제 생성: {order_id}, 금액: {amount}원")
        return payment

    def ms_confirm_payment(
        self,
        payment_key: str,
        order_id: str,
        amount: int
    ) -> dict:
        """
        결제 승인

        [동작 순서]
        1. DB에서 주문 조회
        2. 금액 검증 (요청 금액 == DB 금액)
        3. 토스페이먼츠 승인 API 호출
        4. 성공 시 PaymentTransaction 업데이트 (status=SUCCESS)
        5. 실패 시 PaymentTransaction 업데이트 (status=FAILED)

        Args:
            payment_key: 토스페이먼츠 결제키
            order_id: 주문번호
            amount: 결제 금액

        Returns:
            토스페이먼츠 API 응답 데이터

        Raises:
            ValueError: 주문을 찾을 수 없거나 금액이 일치하지 않는 경우
            Exception: 결제 실패
        """
        # 1. 주문 조회
        try:
            payment = PaymentTransaction.objects.get(order_id=order_id)
        except PaymentTransaction.DoesNotExist:
            logger.error(f"[ERROR] 주문을 찾을 수 없습니다: {order_id}")
            raise ValueError(f"주문을 찾을 수 없습니다: {order_id}")

        # 2. 금액 검증
        if int(payment.amount) != amount:
            logger.error(f"[ERROR] 결제 금액 불일치: DB={payment.amount}, 요청={amount}")
            raise ValueError("결제 금액이 일치하지 않습니다.")

        # 3. 토스페이먼츠 승인 API 호출
        url = f"{self.BASE_URL}/payments/confirm"
        payload = {
            "paymentKey": payment_key,
            "orderId": order_id,
            "amount": amount,
        }

        try:
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers(),
                timeout=30
            )

            result = response.json()

            # 4. 성공 처리
            if response.status_code == 200:
                payment.payment_key = payment_key
                payment.status = PaymentTransaction.PaymentStatus.SUCCESS
                payment.updated_at = timezone.now()
                payment.save()

                # 예약 상태 업데이트
                if payment.reservation:
                    payment.reservation.status = 'CONFIRMED_TEST'
                    payment.reservation.save()
                    logger.info(f"[OK] 예약 상태 업데이트: {payment.reservation.id}")

                logger.info(f"[OK] 결제 승인 완료: {order_id}")
                return result

            # 5. 실패 처리
            else:
                error_code = result.get("code", "UNKNOWN")
                error_message = result.get("message", "알 수 없는 오류")

                payment.status = PaymentTransaction.PaymentStatus.FAILED
                payment.fail_code = error_code
                payment.fail_message = error_message
                payment.save()

                logger.error(f"[ERROR] 결제 실패: {order_id}, {error_code}: {error_message}")
                raise Exception(f"결제 실패: {error_message}")

        except requests.exceptions.RequestException as e:
            logger.error(f"[ERROR] 토스페이먼츠 API 호출 실패: {e}")
            payment.status = PaymentTransaction.PaymentStatus.FAILED
            payment.fail_message = str(e)
            payment.save()
            raise Exception(f"결제 승인 중 오류가 발생했습니다: {e}")

    def ms_cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str
    ) -> dict:
        """
        결제 취소

        [동작 순서]
        1. 토스페이먼츠 취소 API 호출
        2. 성공 시 PaymentTransaction 업데이트 (status=FAILED, 취소 사유 기록)
        3. 예약 상태도 CANCELLED로 변경

        Args:
            payment_key: 토스페이먼츠 결제키
            cancel_reason: 취소 사유

        Returns:
            토스페이먼츠 API 응답 데이터

        Raises:
            Exception: 취소 실패
        """
        url = f"{self.BASE_URL}/payments/{payment_key}/cancel"

        payload = {"cancelReason": cancel_reason}

        try:
            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers(),
                timeout=30
            )

            result = response.json()

            if response.status_code == 200:
                # PaymentTransaction 업데이트
                payment = PaymentTransaction.objects.get(payment_key=payment_key)
                payment.status = PaymentTransaction.PaymentStatus.FAILED
                payment.fail_code = "CANCELED"
                payment.fail_message = cancel_reason
                payment.save()

                # 예약 상태 업데이트
                if payment.reservation:
                    payment.reservation.status = 'CANCELLED'
                    payment.reservation.save()

                logger.info(f"[OK] 결제 취소 완료: {payment_key}")
                return result

            else:
                error_message = result.get("message", "취소 실패")
                logger.error(f"[ERROR] 결제 취소 실패: {payment_key}, {error_message}")
                raise Exception(f"결제 취소 실패: {error_message}")

        except requests.exceptions.RequestException as e:
            logger.error(f"[ERROR] 토스페이먼츠 API 호출 실패: {e}")
            raise Exception(f"결제 취소 중 오류가 발생했습니다: {e}")

    def ms_get_payment(self, payment_key: str) -> dict:
        """
        결제 정보 조회

        Args:
            payment_key: 토스페이먼츠 결제키

        Returns:
            토스페이먼츠 API 응답 데이터

        Raises:
            Exception: 조회 실패
        """
        url = f"{self.BASE_URL}/payments/{payment_key}"

        try:
            response = requests.get(
                url,
                headers=self._get_headers(),
                timeout=10
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception("결제 정보 조회 실패")

        except requests.exceptions.RequestException as e:
            logger.error(f"[ERROR] 결제 조회 실패: {e}")
            raise Exception(f"결제 정보 조회 중 오류가 발생했습니다: {e}")

    def _ms_generate_order_id(self, prefix: str = "ORD") -> str:
        """
        주문번호 생성

        [형식]
        PREFIX_타임스탬프_랜덤8자
        예: FLT_1704441234567_ABCD1234

        Args:
            prefix: 주문번호 접두사 (FLT, TRN 등)

        Returns:
            생성된 주문번호
        """
        import time
        import uuid

        # 현재 시간 (밀리초)
        timestamp = int(time.time() * 1000)

        # 랜덤 8자 (UUID에서 추출)
        random_id = str(uuid.uuid4()).replace('-', '').upper()[:8]

        return f"{prefix}_{timestamp}_{random_id}"
