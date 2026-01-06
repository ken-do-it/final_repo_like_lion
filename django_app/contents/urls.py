from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShortformViewSet

router = DefaultRouter()
router.register(r'shortforms', ShortformViewSet, basename='shortform')

urlpatterns = [
    path('', include(router.urls)),
]
