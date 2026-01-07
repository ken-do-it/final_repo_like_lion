from django.shortcuts import render
from users.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated , AllowAny
from rest_framework.response import Response
from .models import TravelPlan , PlanDetail, PlanDetailImage
from drf_spectacular.utils import extend_schema
from .serializers import (
    TravelPlanCreateSerializer,
    TravelPlanDetailSerializer,
    TravelPlanListSerializer,
    TravelPlanUpdateSerializer,
    PlanDetailCreateSerializer,
    PlanDetailUpdateSerializer,
    PlanDetailImageCreateSerializer,
    PlanDetailImageSerializer,
    PlanDetailEditSerializer,
)

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
    POST /api/plans/
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
        serializer = TravelPlanCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            # 임시: 첫 번째 유저 사용 (나중에 request.user로 변경)
            user = User.objects.first()
            
            if not user:
                user = User.objects.create_user(
                    username='testuser',
                    password='test1234'
                )
            
            serializer.save(user=user)
            
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
    PUT /api/plans/<plan_id>/
    PATCH /api/plans/<plan_id>/
    DELETE /api/plans/<plan_id>/
    """
    try:
        plan = TravelPlan.objects.get(id=plan_id)
    except TravelPlan.DoesNotExist:
        return Response(
            {'error': '일정을 찾을 수 없습니다.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # 권한 체크 (임시로 주석 처리, 나중에 활성화)
    # if plan.user != request.user and not plan.is_public:
    #     return Response(
    #         {'error': '권한이 없습니다.'},
    #         status=status.HTTP_403_FORBIDDEN
    #     )
    
    if request.method == 'GET':
        # 상세 조회
        serializer = TravelPlanDetailSerializer(plan)
        return Response(serializer.data)
    
    elif request.method in ['PUT', 'PATCH']:
        # 수정
        partial = request.method == 'PATCH'  # PATCH는 부분 수정
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
    
    elif request.method == 'DELETE':
        # 삭제
        plan.delete()
        return Response(
            {'message': '일정이 삭제되었습니다.'},
            status=status.HTTP_200_OK
        )


# ==================== 날짜별 장소 CRUD ====================
@extend_schema(
    tags=['일정별 장소'],
    summary="특정 일정의 장소 목록 조회 및 추가",
    request=PlanDetailCreateSerializer,
    responses={
        200: PlanDetailUpdateSerializer(many=True),
        201: PlanDetailUpdateSerializer,
    }
)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def detail_list_create(request, plan_id):
    """
    날짜별 장소 목록 조회 / 추가
    GET /api/plans/<plan_id>/details/
    POST /api/plans/<plan_id>/details/
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
        # 장소 추가
        serializer = PlanDetailCreateSerializer(data=request.data)
        
        if serializer.is_valid():
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

@extend_schema(
    tags=['장소 관리'],
    summary="장소 상세 조회/수정/삭제",
    request=PlanDetailEditSerializer,
    responses={
        200: PlanDetailUpdateSerializer,
        204: None,
    }
)
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
def detail_retrieve_update_delete(request, detail_id):
    """
    장소 조회 / 수정 / 삭제
    GET /api/plans/details/<detail_id>/
    PUT /api/plans/details/<detail_id>/
    PATCH /api/plans/details/<detail_id>/
    DELETE /api/plans/details/<detail_id>/
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
        partial = request.method == 'PATCH'
        serializer = PlanDetailCreateSerializer(
            detail,
            data=request.data,
            partial=partial
        )
        
        if serializer.is_valid():
            # plan은 변경 불가, 기존 plan 유지
            serializer.save(plan=detail.plan)
            
            response_serializer = PlanDetailUpdateSerializer(detail)
            return Response(response_serializer.data)
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    elif request.method == 'DELETE':
        detail.delete()
        return Response(
            {'message': '장소가 삭제되었습니다.'},
            status=status.HTTP_200_OK
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