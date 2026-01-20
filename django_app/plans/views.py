import requests
from django.shortcuts import render
from users.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated , AllowAny
from rest_framework.response import Response
from .models import TravelPlan , PlanDetail, PlanDetailImage
from drf_spectacular.utils import extend_schema, OpenApiExample
from .services import get_or_create_place_from_search
from .serializers import (
    TravelPlanCreateSerializer,
    TravelPlanDetailSerializer,
    TravelPlanListSerializer,
    TravelPlanUpdateSerializer,
    PlanDetailCreateSerializer,
    PlanDetailUpdateSerializer,
    PlanDetailImageCreateSerializer,
    PlanDetailImageSerializer,
    AITravelRequestSerializer,
    AITravelRequestDetailSerializer,
)
from .models import AITravelRequest
from .ai_service import generate_travel_recommendation
import logging

logger = logging.getLogger(__name__)

# Create your views here.
@extend_schema(
    tags=['여행 일정'],
    summary="여행 일정 목록 조회 및 생성",
    request=TravelPlanCreateSerializer,  # ← POST용
    responses={
        200: TravelPlanListSerializer(many=True),  # ← GET용
        201: TravelPlanDetailSerializer,  # ← POST 응답
    }
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def plan_list_create(request):
    """
    여행 일정 목록 조회 / 생성

    GET /api/plans/
    - 모든 여행 일정 목록 조회
    - 쿼리 파라미터: is_public=true/false, user=<user_id>

    POST /api/plans/
    - 새 여행 일정 생성
    - 예시:
    {
        "title": "서울 여행",
        "description": "2박 3일 서울 여행",
        "plan_type": "personal",
        "start_date": "2026-02-01",
        "end_date": "2026-02-03",
        "is_public": true
    }
    """
    if request.method == 'GET':
        # 목록 조회
        plans = TravelPlan.objects.all().order_by('-created_at')
        
        # 필터링 (옵션)
        is_public = request.query_params.get('is_public')
        if is_public is not None:
            plans = plans.filter(is_public=is_public.lower() == 'true')
        
        user_id = request.query_params.get('user')
        if user_id:
            plans = plans.filter(user_id=user_id)
        
        serializer = TravelPlanListSerializer(plans, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # 생성
        if request.user.is_authenticated : 
            serializer = TravelPlanCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                
                serializer.save(user=request.user)
                
                plan = serializer.instance
                detail_serializer = TravelPlanDetailSerializer(plan)
                
                return Response(
                    detail_serializer.data,
                    status=status.HTTP_201_CREATED
                )
            
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

@extend_schema(
    tags=['여행 일정'],
    summary="여행 일정 상세 조회/수정/삭제",
    request=TravelPlanUpdateSerializer,  # ← PUT/PATCH용
    responses={
        200: TravelPlanDetailSerializer,
        204: None,  # ← DELETE
    }
)
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def plan_retrieve_update_delete(request, plan_id):
    """
    여행 일정 조회 / 수정 / 삭제

    GET /api/plans/<plan_id>/
    - 특정 일정 상세 조회 (포함된 모든 장소 정보 포함)

    PATCH /api/plans/<plan_id>/
    - 일정 부분 수정
    - 예시: {"title": "수정된 제목", "is_public": false}

    PUT /api/plans/<plan_id>/
    - 일정 전체 수정

    DELETE /api/plans/<plan_id>/
    - 일정 삭제 (포함된 모든 장소도 함께 삭제됨)
    """
    try:
        plan = TravelPlan.objects.get(id=plan_id)
    except TravelPlan.DoesNotExist:
        return Response(
            {'error': '일정을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    
    if request.method == 'GET':
        # 상세 조회
        if not request.user.is_authenticated:
            if not plan.is_public:
                return Response({'error': '공개되지 않은 일정입니다.'}, status=403)
        
        else : 
            if plan.user != request.user and not plan.is_public:
                return Response({'error': '공개되지 않은 일정입니다.'}, status=403)
            
        serializer = TravelPlanDetailSerializer(plan)
        return Response(serializer.data)
    
    elif request.method in ['PUT', 'PATCH']:
        # 수정
        if request.user.is_authenticated :
            partial = request.method == 'PATCH'  # PATCH는 부분 수정
            if plan.user != request.user :
                return Response(
                    {'error': '본인만 수정할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            
            serializer = TravelPlanUpdateSerializer(
                plan, 
                data=request.data, 
                partial=partial
            )
            
            if serializer.is_valid():
                serializer.save()
                
                # 수정된 전체 정보 반환
                detail_serializer = TravelPlanDetailSerializer(plan)
                return Response(detail_serializer.data)
            
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            ) 
    
    elif request.method == 'DELETE':
        # 삭제

        if request.user.is_authenticated :
            if plan.user != request.user :
                return Response(
                    {'error': '본인만 삭제할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            plan.delete()
            return Response(
                {'message': '일정이 삭제되었습니다.'},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            ) 


# ==================== 날짜별 장소 CRUD ====================
@extend_schema(
    tags=['일정별 장소'],
    summary="특정 일정의 장소 목록 조회 및 추가",
    request=PlanDetailCreateSerializer,
    responses={
        200: PlanDetailUpdateSerializer(many=True),
        201: PlanDetailUpdateSerializer,
    },
    examples=[
        OpenApiExample(
            '장소 이름으로 검색 (권장)',
            value={
                'place_name': '경복궁',
                'date': '2026-02-01',
                'description': '오전 10시 방문',
                'order_index': 1
            },
            request_only=True,
        ),
        OpenApiExample(
            '기존 장소 ID 사용',
            value={
                'place': 5,
                'date': '2026-02-01',
                'description': '오후 3시 방문',
                'order_index': 2
            },
            request_only=True,
        ),
    ]
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def detail_list_create(request, plan_id):
    """
    날짜별 장소 목록 조회 / 추가

    GET /api/plans/<plan_id>/details/
    - 특정 일정의 모든 장소 목록 조회

    POST /api/plans/<plan_id>/details/
    - 일정에 새 장소 추가
    - place_name으로 검색: FastAPI를 통해 자동으로 장소 정보 가져옴
    - place로 직접 지정: 기존 Place ID 사용 (선택사항)

    ⚠️ place와 place_name 중 하나만 제공해야 합니다!

    예시 1 (장소 이름으로 검색 - 권장):
    {
        "place_name": "경복궁",
        "date": "2026-02-01",
        "description": "오전 10시 방문",
        "order_index": 1
    }

    예시 2 (기존 장소 ID 사용):
    {
        "place": 5,
        "date": "2026-02-01",
        "description": "오전 10시 방문",
        "order_index": 1
    }

    ⚠️ 잘못된 예시 (둘 다 제공 - 에러 발생):
    {
        "place": 5,
        "place_name": "경복궁",
        ...
    }
    """
    try:
        plan = TravelPlan.objects.get(id=plan_id)
    except TravelPlan.DoesNotExist:
        return Response(
            {'error': '일정을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        # 목록 조회
        details = PlanDetail.objects.filter(plan=plan).order_by('date', 'order_index')
        serializer = PlanDetailUpdateSerializer(details, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        if request.user.is_authenticated :
            if plan.user != request.user :
                return Response(
                    {'error': '본인만 이용할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            serializer = PlanDetailCreateSerializer(data=request.data)

            if serializer.is_valid():
                # 1. place_name이 있는지 확인
                place_name = request.data.get('place_name')

                if place_name:
                    # 2. services.py의 함수 호출 (import 필요)
                    try:
                        place, created = get_or_create_place_from_search(place_name)
                        # 3. serializer.save()에 place 전달
                        serializer.save(plan=plan, place=place)
                    except ValueError as e:
                        # 장소를 찾지 못한 경우 에러 반환
                        return Response({'error': str(e)}, status=404)
                    except requests.RequestException as e:
                        # FastAPI 연결 실패
                        return Response({'error': '장소 검색 서버에 연결할 수 없습니다'}, status=503)
                else:
                    # place_name이 없으면 기존 로직 (place_id 사용)
                    serializer.save(plan=plan)

                detail = serializer.instance
                response_serializer = PlanDetailUpdateSerializer(detail)

                return Response(
                    response_serializer.data,
                    status=status.HTTP_201_CREATED
                )

            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )


@extend_schema(
    tags=['장소 관리'],
    summary="장소 상세 조회/수정/삭제",
    request=PlanDetailCreateSerializer,
    responses={
        200: PlanDetailUpdateSerializer,
        204: None,
    },
    examples=[
        OpenApiExample(
            '장소 변경 (place_name 사용)',
            value={
                'place_name': '남산타워',
                'description': '석양 감상',
                'order_index': 2
            },
            request_only=True,
        ),
        OpenApiExample(
            '메모와 날짜만 수정 (PATCH)',
            value={
                'date': '2026-02-02',
                'description': '일정 변경됨'
            },
            request_only=True,
        ),
    ]
)
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def detail_retrieve_update_delete(request, detail_id):
    """
    장소 조회 / 수정 / 삭제

    GET /api/plans/details/<detail_id>/
    - 특정 장소 상세 정보 조회

    PATCH /api/plans/details/<detail_id>/
    - 장소 부분 수정 (일부 필드만 변경 가능)
    - place_name 제공 시: 새로운 장소로 검색 및 변경
    - 예시: {"place_name": "남산타워", "description": "석양 감상"}

    PUT /api/plans/details/<detail_id>/
    - 장소 전체 수정 (모든 필드 필요)

    DELETE /api/plans/details/<detail_id>/
    - 장소 삭제
    """
    try:
        detail = PlanDetail.objects.get(id=detail_id)
    except PlanDetail.DoesNotExist:
        return Response(
            {'error': '장소를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        serializer = PlanDetailUpdateSerializer(detail)
        return Response(serializer.data)
    
    elif request.method in ['PUT', 'PATCH']:
        if request.user.is_authenticated :
            if detail.plan.user != request.user :
                return Response(
                    {'error': '본인만 수정할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            partial = request.method == 'PATCH'
            serializer = PlanDetailCreateSerializer(
                detail,
                data=request.data,
                partial=partial
            )

            if serializer.is_valid():
                # place_name이 있으면 장소 검색 후 업데이트
                place_name = request.data.get('place_name')

                if place_name:
                    try:
                        place, created = get_or_create_place_from_search(place_name)
                        serializer.save(plan=detail.plan, place=place)
                    except ValueError as e:
                        return Response({'error': str(e)}, status=404)
                    except requests.RequestException as e:
                        return Response({'error': '장소 검색 서버에 연결할 수 없습니다'}, status=503)
                else:
                    # plan은 변경 불가, 기존 plan 유지
                    serializer.save(plan=detail.plan)

                response_serializer = PlanDetailUpdateSerializer(detail)
                return Response(response_serializer.data)

            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    elif request.method == 'DELETE':
        if request.user.is_authenticated :
            if detail.plan.user != request.user :
                return Response(
                    {'error': '본인만 수정할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            detail.delete()
            return Response(
                {'message': '장소가 삭제되었습니다.'},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )


# ==================== 장소 이미지 CRUD ====================
@extend_schema(
    tags=['장소 관리'],
    summary="특정 장소의 이미지 목록 조회 및 추가",
    request=PlanDetailImageCreateSerializer,
    responses={
        200: PlanDetailImageSerializer(many=True),
        201: PlanDetailImageSerializer,
    }
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def image_list_create(request, detail_id):
    """
    장소 이미지 목록 조회 / 추가
    GET /api/plans/details/<detail_id>/images/
    POST /api/plans/details/<detail_id>/images/
    """
    try:
        detail = PlanDetail.objects.get(id=detail_id)
    except PlanDetail.DoesNotExist:
        return Response(
            {'error': '장소를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        images = PlanDetailImage.objects.filter(detail=detail).order_by('order_index')
        serializer = PlanDetailImageSerializer(images, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        if request.user.is_authenticated :
            if detail.plan.user != request.user :
                return Response(
                    {'error': '본인만 이용할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
                )
            serializer = PlanDetailImageCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                serializer.save(detail=detail)
                
                return Response(
                    serializer.data,
                    status=status.HTTP_201_CREATED
                )
            
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

@extend_schema(
    tags=['장소 관리'],
    summary="이미지 조회/수정/삭제",
    request=PlanDetailImageCreateSerializer,
    responses={
        200: PlanDetailImageSerializer,
        204: None,
    }
)
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def image_retrieve_update_delete(request, image_id):
    """
    이미지 조회 / 수정 / 삭제
    GET /api/plans/images/<image_id>/
    PUT /api/plans/images/<image_id>/
    PATCH /api/plans/images/<image_id>/
    DELETE /api/plans/images/<image_id>/
    """
    try:
        image = PlanDetailImage.objects.get(id=image_id)
    except PlanDetailImage.DoesNotExist:
        return Response(
            {'error': '이미지를 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        serializer = PlanDetailImageSerializer(image)
        return Response(serializer.data)
    
    elif request.method in ['PUT', 'PATCH']:
        partial = request.method == 'PATCH'
        serializer = PlanDetailImageCreateSerializer(
            image,
            data=request.data,
            partial=partial
        )
        
        if serializer.is_valid():
            serializer.save(detail=image.detail)
            return Response(serializer.data)
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    elif request.method == 'DELETE':
        image.delete()
        return Response(
            {'message': '이미지가 삭제되었습니다.'},
            status=status.HTTP_200_OK
        )


# ==================== AI 여행 추천 ====================
@extend_schema(
    tags=['AI 여행 추천'],
    summary="AI 여행 추천 요청",
    request=AITravelRequestSerializer,
    responses={
        201: AITravelRequestDetailSerializer,
        400: {'description': '잘못된 요청'},
        503: {'description': 'AI 서비스 연결 실패'}
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_request_create(request):
    """
    AI 여행 추천 요청

    POST /api/plans/ai/request/
    - AI가 여행 일정을 자동으로 생성합니다
    - 장소는 FastAPI를 통해 자동으로 검색됩니다

    요청 예시:
    {
        "destination": "jeju",
        "start_date": "2026-02-01",
        "end_date": "2026-02-03",
        "travel_style": "healing",
        "companions": 2,
        "additional_request": "맛집 위주로 추천해주세요"
    }
    """
    if request.user.is_authenticated :
        serializer = AITravelRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        # AITravelRequest 생성 (status='pending')
        ai_request = serializer.save(user=request.user, status='pending')

        try:
            # AI 추천 생성
            logger.info(f"AI 추천 요청 시작: {ai_request.id}")
            plan = generate_travel_recommendation(ai_request)
            logger.info(f"AI 추천 완료: Plan {plan.id}")

            # 성공 응답
            response_serializer = AITravelRequestDetailSerializer(ai_request)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )

        except ValueError as e:
            # JSON 파싱 실패 등
            ai_request.status = 'failed'
            ai_request.error_message = str(e)
            ai_request.save()

            logger.error(f"AI 추천 실패 (ValueError): {str(e)}")
            return Response(
                {'error': f'AI 응답 처리 실패: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:
            # API 호출 실패, 기타 오류
            ai_request.status = 'failed'
            ai_request.error_message = str(e)
            ai_request.save()

            logger.error(f"AI 추천 실패: {str(e)}")
            return Response(
                {'error': f'AI 서비스 오류: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
    else:
        return Response(
            {'error': '로그인 후 이용해주세요.'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@extend_schema(
    tags=['AI 여행 추천'],
    summary="AI 추천 요청 상세 조회",
    responses={200: AITravelRequestDetailSerializer}
)
@api_view(['GET'])
@permission_classes([AllowAny])
def ai_request_retrieve(request, request_id):
    """
    AI 추천 요청 상세 조회

    GET /api/plans/ai/request/<request_id>/
    - 요청 상태, AI 응답, 생성된 일정 정보 포함
    """
    try:
        ai_request = AITravelRequest.objects.get(id=request_id)
    except AITravelRequest.DoesNotExist:
        return Response(
            {'error': 'AI 추천 요청을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 권한 체크: 본인이 아니고 비공개면 접근 불가
    if request.user.is_authenticated:
    # 로그인 유저: 본인 요청이거나 공개된 일정만 조회 가능
        if ai_request.user != request.user and (not ai_request.created_plan or not ai_request.created_plan.is_public):
            return Response(
                {'error': '공개되지 않은 일정입니다.'},
                status=status.HTTP_403_FORBIDDEN
        )
    else:
        # 비로그인 유저: 공개된 일정만 조회 가능
        if not ai_request.created_plan or not ai_request.created_plan.is_public:
            return Response(
                {'error': '공개되지 않은 일정입니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

    serializer = AITravelRequestDetailSerializer(ai_request)
    return Response(serializer.data)


@extend_schema(
    tags=['AI 여행 추천'],
    summary="AI 추천 요청 목록 조회",
    responses={200: AITravelRequestDetailSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_requests_list(request):
    """
    AI 추천 요청 목록 조회

    GET /api/plans/ai/requests/
    - 상태별 필터링: ?status=success
    """
    ai_requests = AITravelRequest.objects.filter(user=request.user).order_by('-created_at')

    status_filter = request.query_params.get('status')
    if status_filter:
        ai_requests = ai_requests.filter(status=status_filter)

    serializer = AITravelRequestDetailSerializer(ai_requests, many=True)
    return Response(serializer.data)


# ==================== 좋아요 ====================
@extend_schema(
    tags=['일정 좋아요'],
    summary="좋아요 조회 및 토글",
    responses={
        200: {'description': '좋아요 정보 또는 좋아요 취소됨'},
        201: {'description': '좋아요 추가됨'},
    }
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def plan_like_toggle(request, plan_id):
    """
    좋아요 조회 / 토글

    GET /api/plans/<plan_id>/like/
    - 좋아요 수 및 현재 사용자 좋아요 여부 조회

    POST /api/plans/<plan_id>/like/
    - 좋아요 토글 (로그인 필요)
    - 이미 좋아요한 경우: 좋아요 취소
    - 좋아요하지 않은 경우: 좋아요 추가
    """
    from .models import PlanLike

    try:
        plan = TravelPlan.objects.get(id=plan_id)
    except TravelPlan.DoesNotExist:
        return Response(
            {'error': '일정을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # 좋아요 조회는 모든 유저 가능
        is_liked = False
        if request.user.is_authenticated:
            is_liked = PlanLike.objects.filter(plan=plan, user=request.user).exists()

        return Response({
            'liked': is_liked,
            'like_count': plan.likes.count()
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        # 좋아요 토글은 로그인 필요
        if not request.user.is_authenticated:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 공개된 일정만 좋아요 가능
        if not plan.is_public:
            return Response(
                {'error': '공개된 일정만 좋아요할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        like, created = PlanLike.objects.get_or_create(
            plan=plan,
            user=request.user
        )

        if not created:
            # 이미 좋아요한 경우 취소
            like.delete()
            return Response({
                'liked': False,
                'like_count': plan.likes.count()
            }, status=status.HTTP_200_OK)

        return Response({
            'liked': True,
            'like_count': plan.likes.count()
        }, status=status.HTTP_201_CREATED)


# ==================== 댓글 ====================
@extend_schema(
    tags=['일정 댓글'],
    summary="댓글 목록 조회 및 작성",
    responses={200: 'PlanCommentSerializer(many=True)', 201: 'PlanCommentSerializer'}
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def plan_comment_list_create(request, plan_id):
    """
    댓글 목록 조회 / 작성

    GET /api/plans/<plan_id>/comments/
    - 해당 일정의 모든 댓글 조회

    POST /api/plans/<plan_id>/comments/
    - 댓글 작성 (로그인 필요)
    """
    from .models import PlanComment
    from .serializers import PlanCommentSerializer, PlanCommentCreateSerializer

    try:
        plan = TravelPlan.objects.get(id=plan_id)
    except TravelPlan.DoesNotExist:
        return Response(
            {'error': '일정을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # 공개된 일정 또는 본인 일정만 댓글 조회 가능
        if not plan.is_public and (not request.user.is_authenticated or plan.user != request.user):
            return Response(
                {'error': '공개되지 않은 일정입니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        comments = PlanComment.objects.filter(plan=plan)
        serializer = PlanCommentSerializer(comments, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return Response(
                {'error': '로그인 후 이용해주세요.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 공개된 일정만 댓글 작성 가능
        if not plan.is_public:
            return Response(
                {'error': '공개된 일정만 댓글을 작성할 수 있습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = PlanCommentCreateSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(plan=plan, user=request.user)
            response_serializer = PlanCommentSerializer(comment)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=['일정 댓글'],
    summary="댓글 수정/삭제",
    responses={200: 'PlanCommentSerializer', 204: None}
)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def plan_comment_update_delete(request, comment_id):
    """
    댓글 수정 / 삭제

    PUT /api/plans/comments/<comment_id>/
    - 본인 댓글 수정

    DELETE /api/plans/comments/<comment_id>/
    - 본인 댓글 삭제
    """
    from .models import PlanComment
    from .serializers import PlanCommentSerializer, PlanCommentCreateSerializer

    try:
        comment = PlanComment.objects.get(id=comment_id)
    except PlanComment.DoesNotExist:
        return Response(
            {'error': '댓글을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 본인 댓글만 수정/삭제 가능
    if comment.user != request.user:
        return Response(
            {'error': '본인의 댓글만 수정/삭제할 수 있습니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'PUT':
        serializer = PlanCommentCreateSerializer(comment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            response_serializer = PlanCommentSerializer(comment)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        comment.delete()
        return Response(
            {'message': '댓글이 삭제되었습니다.'},
            status=status.HTTP_200_OK
        )