"""
결제 API 뷰
- POST /api/v1/payments/ (결제 생성)
- POST /api/v1/payments/confirm/ (결제 승인)
- POST /api/v1/payments/{payment_key}/cancel/ (결제 취소)
- GET /api/v1/payments/{order_id}/ (결제 조회)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from drf_spectacular.utils import extend_schema, OpenApiExample
import logging

from ..services.payment_service import MSTossPaymentsService
from ..serializers.payment import (
    MSPaymentCreateRequestSerializer,
    MSPaymentConfirmRequestSerializer,
    MSPaymentCancelRequestSerializer,
    MSPaymentResponseSerializer,
    MSPaymentReadyResponseSerializer,
)
from ..models import PaymentTransaction, Reservation

logger = logging.getLogger(__name__)


class MSPaymentCreateView(APIView):
    """
    결제 생성 API

    POST /api/v1/payments/

    [인증] 필수 (로그인한 사용자만)

    [요청 예시]
    {
        "reservationId": "uuid-string",
        "amount": 65000,
        "orderName": "김포→제주 항공권"
    }

    [응답 예시]
    {
        "orderId": "FLT_1704441234567_ABCD1234",
        "amount": 65000,
        "orderName": "김포→제주 항공권",
        "clientKey": "test_ck_...",
        "successUrl": "http://localhost:3000/payment/success",
        "failUrl": "http://localhost:3000/payment/fail"
    }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['결제'],
        request=MSPaymentCreateRequestSerializer,
        responses={201: MSPaymentReadyResponseSerializer},
        summary="결제 생성",
        description=(
            "토스페이먼츠 결제를 위한 주문을 생성합니다.\n"
            "예약 ID(선택)와 결제 금액, 주문명을 입력하면 "
            "프론트엔드에서 토스페이먼츠 결제 위젯을 호출할 수 있는 정보를 반환합니다.\n\n"
            "**인증 필수**: 로그인한 사용자만 사용 가능합니다."
        ),
        examples=[
            OpenApiExample(
                name="예약 없이 결제 생성",
                value={
                    "amount": 65000,
                    "orderName": "테스트 항공권 결제"
                },
                request_only=True,
            ),
            OpenApiExample(
                name="예약과 연결해서 결제 생성",
                value={
                    "reservationId": "uuid-string",
                    "amount": 65000,
                    "orderName": "김포→제주 항공권"
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        """결제 생성"""
        # 1. 요청 데이터 검증
        serializer = MSPaymentCreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data

        # 2. 예약 객체 조회 (있으면)
        reservation = None
        reservation_id = validated_data.get('reservationId')
        if reservation_id:
            try:
                reservation = Reservation.objects.get(
                    id=reservation_id,
                    user=request.user
                )
            except Reservation.DoesNotExist:
                return Response(
                    {"error": "예약을 찾을 수 없습니다."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 3. 결제 생성
        try:
            service = MSTossPaymentsService()
            payment = service.ms_create_payment(
                user=request.user,
                amount=validated_data['amount'],
                order_name=validated_data['orderName'],
                reservation=reservation
            )

            # 4. 프론트엔드에 필요한 정보 반환
            response_data = {
                "orderId": payment.order_id,
                "amount": int(payment.amount),
                "orderName": validated_data['orderName'],
                "clientKey": settings.TOSS_PAYMENTS["CLIENT_KEY"],
                "successUrl": settings.TOSS_PAYMENTS["SUCCESS_URL"],
                "failUrl": settings.TOSS_PAYMENTS["FAIL_URL"],
            }

            # 5. 응답 검증
            response_serializer = MSPaymentReadyResponseSerializer(data=response_data)
            response_serializer.is_valid(raise_exception=True)

            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error(f"결제 생성 중 오류: {e}", exc_info=True)
            return Response(
                {"error": "결제 생성 중 오류가 발생했습니다."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MSPaymentConfirmView(APIView):
    """
    결제 승인 API

    POST /api/v1/payments/confirm/

    [인증] 필수

    [설명]
    토스페이먼츠 결제 위젯에서 결제 완료 후 리다이렉트되면,
    프론트엔드는 이 API를 호출해서 결제를 최종 승인합니다.

    [요청 예시]
    {
        "paymentKey": "토스에서_받은_결제키",
        "orderId": "FLT_1704441234567_ABCD1234",
        "amount": 65000
    }

    [응답 예시]
    {
        "success": true,
        "data": { 토스페이먼츠 승인 응답 }
    }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['결제'],
        request=MSPaymentConfirmRequestSerializer,
        responses={200: dict},
        summary="결제 승인",
        description=(
            "토스페이먼츠 결제를 최종 승인합니다.\n\n"
            "**동작 순서**:\n"
            "1. 프론트엔드가 토스페이먼츠 결제 위젯에서 결제 완료\n"
            "2. 토스가 프론트엔드로 리다이렉트 (paymentKey, orderId, amount 전달)\n"
            "3. 프론트엔드가 이 API를 호출해서 결제 승인 요청\n"
            "4. 백엔드가 토스페이먼츠 승인 API 호출\n"
            "5. 결제 완료!\n\n"
            "**인증 필수**: 로그인한 사용자만 사용 가능합니다."
        ),
        examples=[
            OpenApiExample(
                name="결제 승인 요청",
                value={
                    "paymentKey": "test_payment_key_12345",
                    "orderId": "FLT_1736145234567_ABCD1234",
                    "amount": 65000
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        """결제 승인"""
        # 1. 요청 데이터 검증
        serializer = MSPaymentConfirmRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data

        # 2. 결제 승인
        service = MSTossPaymentsService()

        try:
            result = service.ms_confirm_payment(
                payment_key=validated_data["paymentKey"],
                order_id=validated_data["orderId"],
                amount=validated_data["amount"],
            )

            return Response({
                "success": True,
                "data": result,
            })

        except ValueError as e:
            # 주문을 찾을 수 없거나 금액이 일치하지 않는 경우
            return Response({
                "success": False,
                "error": {"message": str(e)},
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            # 결제 실패
            logger.error(f"결제 승인 중 오류: {e}", exc_info=True)
            return Response({
                "success": False,
                "error": {"message": str(e)},
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MSPaymentCancelView(APIView):
    """
    결제 취소 API

    POST /api/v1/payments/{payment_key}/cancel/

    [인증] 필수

    [요청 예시]
    {
        "cancelReason": "고객 변심"
    }

    [응답 예시]
    {
        "success": true,
        "data": { 토스페이먼츠 취소 응답 }
    }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['결제'],
        request=MSPaymentCancelRequestSerializer,
        responses={200: dict},
        summary="결제 취소",
        description=(
            "승인된 결제를 취소합니다.\n\n"
            "**주의사항**:\n"
            "- 결제 승인이 완료된 건만 취소 가능합니다\n"
            "- 본인의 결제만 취소할 수 있습니다\n"
            "- 취소 사유는 필수입니다\n\n"
            "**인증 필수**: 로그인한 사용자만 사용 가능합니다."
        ),
        examples=[
            OpenApiExample(
                name="결제 취소 요청",
                value={
                    "cancelReason": "고객 변심"
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request, payment_key):
        """결제 취소"""
        # 1. 요청 데이터 검증
        serializer = MSPaymentCancelRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data

        # 2. 결제 취소
        service = MSTossPaymentsService()

        try:
            # 권한 확인: 본인의 결제인지
            payment = PaymentTransaction.objects.get(payment_key=payment_key)
            if payment.user != request.user:
                return Response({
                    "success": False,
                    "error": {"message": "권한이 없습니다."},
                }, status=status.HTTP_403_FORBIDDEN)

            # 취소 실행
            result = service.ms_cancel_payment(
                payment_key=payment_key,
                cancel_reason=validated_data["cancelReason"],
            )

            return Response({
                "success": True,
                "data": result,
            })

        except PaymentTransaction.DoesNotExist:
            return Response({
                "success": False,
                "error": {"message": "결제를 찾을 수 없습니다."},
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f"결제 취소 중 오류: {e}", exc_info=True)
            return Response({
                "success": False,
                "error": {"message": str(e)},
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MSPaymentDetailView(APIView):
    """
    결제 상세 조회 API

    GET /api/v1/payments/{order_id}/

    [인증] 필수

    [응답 예시]
    {
        "id": "uuid",
        "orderId": "FLT_1704441234567_ABCD1234",
        "amount": 65000,
        "status": "SUCCESS",
        "createdAt": "2025-01-06T12:00:00Z"
    }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['결제'],
        responses={200: MSPaymentResponseSerializer},
        summary="결제 상세 조회",
        description=(
            "주문번호로 결제 정보를 조회합니다.\n\n"
            "**응답 정보**:\n"
            "- 주문번호, 결제 금액, 결제 상태\n"
            "- 결제키 (승인 후), 생성/수정 시각\n\n"
            "**인증 필수**: 본인의 결제만 조회 가능합니다."
        ),
    )
    def get(self, request, order_id):
        """결제 상세 조회"""
        try:
            payment = PaymentTransaction.objects.get(
                order_id=order_id,
                user=request.user
            )

            serializer = MSPaymentResponseSerializer(payment)
            return Response(serializer.data)

        except PaymentTransaction.DoesNotExist:
            return Response({
                "error": {"message": "결제 정보를 찾을 수 없습니다."}
            }, status=status.HTTP_404_NOT_FOUND)
