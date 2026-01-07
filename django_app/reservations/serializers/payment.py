"""
결제 API 시리얼라이저
- 요청/응답 데이터 검증 및 변환
"""
from rest_framework import serializers
from ..models import PaymentTransaction


class MSPaymentCreateRequestSerializer(serializers.Serializer):
    """
    결제 생성 요청

    POST /api/v1/payments/

    [필드 설명]
    - reservationId: 예약 ID (선택)
    - amount: 결제 금액 (필수, 최소 100원)
    - orderName: 주문명 (필수, 예: "김포→제주 항공권")
    """
    reservationId = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="예약 ID (선택)"
    )
    amount = serializers.IntegerField(
        min_value=100,
        help_text="결제 금액 (원)"
    )
    orderName = serializers.CharField(
        max_length=100,
        help_text="주문명 (예: 김포→제주 항공권)"
    )


class MSPaymentConfirmRequestSerializer(serializers.Serializer):
    """
    결제 승인 요청

    POST /api/v1/payments/confirm/

    [필드 설명]
    - paymentKey: 토스페이먼츠 결제키 (토스에서 리다이렉트 시 제공)
    - orderId: 주문번호 (우리가 생성한 주문번호)
    - amount: 결제 금액 (검증용)
    """
    paymentKey = serializers.CharField(
        max_length=200,
        help_text="토스페이먼츠 결제키"
    )
    orderId = serializers.CharField(
        max_length=64,
        help_text="주문번호"
    )
    amount = serializers.IntegerField(
        min_value=100,
        help_text="결제 금액 (검증용)"
    )


class MSPaymentCancelRequestSerializer(serializers.Serializer):
    """
    결제 취소 요청

    POST /api/v1/payments/{payment_key}/cancel/

    [필드 설명]
    - cancelReason: 취소 사유 (필수)
    """
    cancelReason = serializers.CharField(
        max_length=200,
        help_text="취소 사유"
    )


class MSPaymentResponseSerializer(serializers.ModelSerializer):
    """
    결제 응답 (조회용)

    [응답 예시]
    {
        "id": "uuid",
        "orderId": "FLT_1704441234567_ABCD1234",
        "amount": 65000,
        "status": "SUCCESS",
        "createdAt": "2025-01-06T12:00:00Z"
    }
    """

    class Meta:
        model = PaymentTransaction
        fields = [
            "id",
            "orderId",
            "amount",
            "currency",
            "status",
            "paymentKey",
            "createdAt",
            "updatedAt",
        ]

    # camelCase 변환
    orderId = serializers.CharField(source="order_id", read_only=True)
    paymentKey = serializers.CharField(source="payment_key", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)


class MSPaymentReadyResponseSerializer(serializers.Serializer):
    """
    결제 준비 응답 (프론트엔드용)

    POST /api/v1/payments/ 응답

    [프론트엔드에서 사용]
    이 정보를 받아서 토스페이먼츠 결제 위젯을 호출합니다.

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
    orderId = serializers.CharField(help_text="주문번호")
    amount = serializers.IntegerField(help_text="결제 금액")
    orderName = serializers.CharField(help_text="주문명")
    clientKey = serializers.CharField(help_text="토스 클라이언트 키")
    successUrl = serializers.URLField(help_text="결제 성공 URL")
    failUrl = serializers.URLField(help_text="결제 실패 URL")
