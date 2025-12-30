# django_app/search_signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
import requests
import logging

# 형님이 정의하신 모델들 정확하게 import
from places.models import Place, LocalColumn
from plans.models import TravelPlan
from contents.models import Shortform

logger = logging.getLogger(__name__)

# FastAPI 주소 (내부 통신용)
FASTAPI_URL = "http://fastapi:8000/index-data"

def send_to_fastapi(payload):
    try:
        # 3초 안에 응답 없으면 무시 (서버 멈춤 방지)
        requests.post(FASTAPI_URL, json=payload, timeout=3)
    except Exception as e:
        logger.error(f"❌ 검색엔진 등록 실패: {e}")

# --- [1] 장소(Place) 저장 시 ---
@receiver(post_save, sender=Place)
def handle_place_save(sender, instance, **kwargs):
    # Place 모델엔 description이 없어서 주소와 카테고리를 넣습니다.
    content_text = f"{instance.name} {instance.category_main} {instance.address}"
    
    payload = {
        "id": instance.id,
        "category": "place",
        "content": content_text
    }
    send_to_fastapi(payload)

# --- [2] 여행 일정(TravelPlan) 저장 시 ---
@receiver(post_save, sender=TravelPlan)
def handle_travel_plan_save(sender, instance, **kwargs):
    # 모델 필드명: description (memo 아님)
    desc = instance.description if instance.description else ""
    content_text = f"{instance.title} {desc}"
    
    payload = {
        "id": instance.id,
        "category": "plan",
        "content": content_text
    }
    send_to_fastapi(payload)

# --- [3] 숏폼(Shortform) 저장 시 ---
@receiver(post_save, sender=Shortform)
def handle_shortform_save(sender, instance, **kwargs):
    # 모델 필드명: content (memo 아님)
    desc = instance.content if instance.content else ""
    content_text = f"{instance.title} {desc}"
    
    payload = {
        "id": instance.id,
        "category": "shortform",
        "content": content_text
    }
    send_to_fastapi(payload)

# --- [4] 현지인 칼럼(LocalColumn) 저장 시 ---
@receiver(post_save, sender=LocalColumn)
def handle_local_column_save(sender, instance, **kwargs):
    # 모델 필드명: content (memo 아님)
    content_part = instance.content[:500] # 내용은 너무 기니까 앞부분만
    content_text = f"{instance.title} {content_part}"
    
    payload = {
        "id": instance.id,
        "category": "localcolumn",
        "content": content_text
    }
    send_to_fastapi(payload)