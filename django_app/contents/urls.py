from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import ShortformViewSet, TranslationProxyView, TranslationBatchView

router = DefaultRouter()
router.register(r'shortforms', ShortformViewSet, basename='shortform')

urlpatterns = [
    path('', include(router.urls)),
    path('translations/', TranslationProxyView.as_view(), name='translations'),
    path('translations/batch/', views.TranslationBatchView.as_view(), name='translation-batch'),
]
