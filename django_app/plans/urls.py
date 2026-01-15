from django.urls import path
from . import views

app_name = 'plans'

urlpatterns = [
    # 여행 일정 CRUD
    path('', views.plan_list_create, name='plan-list-create'),
    path('<int:plan_id>/', views.plan_retrieve_update_delete, name='plan-detail'),  
    
    # 날짜별 장소 CRUD
    path('<int:plan_id>/details/', views.detail_list_create, name='detail-list-create'),  
    path('details/<int:detail_id>/', views.detail_retrieve_update_delete, name='detail-detail'),  
    
    # 장소 이미지 CRUD
    path('details/<int:detail_id>/images/', views.image_list_create, name='image-list-create'),
    path('images/<int:image_id>/', views.image_retrieve_update_delete, name='image-detail'),

    # AI 여행 추천
    path('ai/request/', views.ai_request_create, name='ai-request-create'),
    path('ai/request/<int:request_id>/', views.ai_request_retrieve, name='ai-request-detail'),
    path('ai/requests/', views.ai_requests_list, name='ai-requests-list'),

    # 카카오맵 이미지 프록시
    path('kakao-map/', views.kakao_static_map, name='kakao-static-map'),

]