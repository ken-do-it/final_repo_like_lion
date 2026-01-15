from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import ShortformViewSet, ShortformCommentViewSet, TranslationProxyView, TranslationBatchView

router = DefaultRouter()
router.register(r'shortforms', ShortformViewSet, basename='shortform')
router.register(r'comments', ShortformCommentViewSet, basename='comment')

urlpatterns = [
    path('', include(router.urls)),
    path('translations/', TranslationProxyView.as_view(), name='translations'),
    path('translations/batch/', views.TranslationBatchView.as_view(), name='translation-batch'),
]
