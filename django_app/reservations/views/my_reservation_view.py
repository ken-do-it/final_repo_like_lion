"""
마이페이지 내 예약 조회 API 뷰

GET /api/v1/my/reservations/
- 로그인한 사용자의 예약 목록을 조회합니다
- 필터: type, status, fromDate, toDate
- 페이지네이션: page, limit
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from ..services.my_reservation_query_service import MSMyReservationQueryService
from ..serializers.my_reservation import MSMyReservationListResponseSerializer


class MSMyReservationListView(APIView):
    """
    내 예약 목록 조회 API
    
    GET /api/v1/my/reservations/
    
    Query Parameters:
    - type: 예약 타입 필터 (FLIGHT, TRAIN, SUBWAY)
    - status: 예약 상태 필터 (CONFIRMED_TEST, PENDING, CANCELLED, FAILED)
    - fromDate: 여행 시작일 필터 (YYYY-MM-DD)
    - toDate: 여행 종료일 필터 (YYYY-MM-DD)
    - page: 페이지 번호 (기본값: 1)
    - limit: 페이지당 아이템 수 (기본값: 20, 최대: 100)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # 서비스 인스턴스 생성
        service = MSMyReservationQueryService()
        
        # Query Parameters에서 필터 추출
        filters = {
            'type': request.query_params.get('type'),
            'status': request.query_params.get('status'),
            'fromDate': request.query_params.get('fromDate'),
            'toDate': request.query_params.get('toDate'),
        }
        
        # 페이지네이션 파라미터
        page = request.query_params.get('page', 1)
        limit = request.query_params.get('limit', 20)
        
        try:
            page = int(page)
            limit = int(limit)
        except (ValueError, TypeError):
            page = 1
            limit = 20
        
        # 서비스 호출하여 예약 목록 조회
        result = service.list_user_reservations(
            user=request.user,
            filters=filters,
            page=page,
            limit=limit,
        )
        
        # Serializer로 응답 직렬화
        serializer = MSMyReservationListResponseSerializer(data=result)
        serializer.is_valid(raise_exception=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
