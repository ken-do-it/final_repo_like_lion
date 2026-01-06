# django_app/search_signals.py
from django.db.models.signals import post_save, post_delete # ★ post_delete 추가
from django.dispatch import receiver
import requests
import logging

from places.models import Place, LocalColumn, PlaceReview
from plans.models import TravelPlan, TravelPost
from contents.models import Shortform

logger = logging.getLogger(__name__)

# FastAPI 주소
FASTAPI_INDEX_URL = "http://fastapi:8000/index-data"
FASTAPI_DELETE_URL = "http://fastapi:8000/delete-data" # ★ 삭제용 주소 추가

# [1] 데이터 추가/수정 요청
def send_to_fastapi(payload):
    try:
        requests.post(FASTAPI_INDEX_URL, json=payload, timeout=2)
    except Exception as e:
        logger.error(f"❌ 검색엔진 등록 실패: {e}")

# [2] ★ 데이터 삭제 요청 (새로 추가된 함수)
def delete_from_fastapi(payload):
    try:
        requests.post(FASTAPI_DELETE_URL, json=payload, timeout=2)
        print(f"🗑️ [FastAPI] 삭제 요청 전송 완료: {payload['category']} - {payload['id']}")
    except Exception as e:
        logger.error(f"❌ 검색엔진 삭제 실패: {e}")


# =========================================================
# A. 저장(Save) 신호 처리 (기존과 동일)
# =========================================================

@receiver(post_save, sender=Place)
def handle_place_save(sender, instance, **kwargs):
    content = f"{instance.name} {instance.category_main} {instance.address}"
    send_to_fastapi({"id": instance.id, "category": "place", "content": content})

@receiver(post_save, sender=TravelPlan)
def handle_plan_save(sender, instance, **kwargs):
    desc = instance.description if instance.description else ""
    send_to_fastapi({"id": instance.id, "category": "plan", "content": f"{instance.title} {desc}"})

@receiver(post_save, sender=Shortform)
def handle_shortform_save(sender, instance, **kwargs):
    desc = instance.content if instance.content else ""
    send_to_fastapi({"id": instance.id, "category": "shortform", "content": f"{instance.title} {desc}"})

@receiver(post_save, sender=LocalColumn)
def handle_column_save(sender, instance, **kwargs):
    content = instance.content[:300] if instance.content else ""
    send_to_fastapi({"id": instance.id, "category": "localcolumn", "content": f"{instance.title} {content}"})

@receiver(post_save, sender=PlaceReview)
def handle_review_save(sender, instance, **kwargs):
    send_to_fastapi({"id": instance.id, "category": "review", "content": instance.content})

@receiver(post_save, sender=TravelPost)
def handle_post_save(sender, instance, **kwargs):
    dest = instance.destination if instance.destination else ""
    content = f"{instance.title} {dest} {instance.content[:300]}"
    send_to_fastapi({"id": instance.id, "category": "post", "content": content})


# =========================================================
# B. ★ 삭제(Delete) 신호 처리 (새로 추가된 부분!)
# =========================================================

# 공통 삭제 처리 함수
def handle_delete_signal(instance, category):
    payload = {
        "id": instance.id,
        "category": category
    }
    delete_from_fastapi(payload)

@receiver(post_delete, sender=Place)
def delete_place(sender, instance, **kwargs):
    handle_delete_signal(instance, "place")

@receiver(post_delete, sender=TravelPlan)
def delete_plan(sender, instance, **kwargs):
    handle_delete_signal(instance, "plan")

@receiver(post_delete, sender=Shortform)
def delete_shortform(sender, instance, **kwargs):
    handle_delete_signal(instance, "shortform")

@receiver(post_delete, sender=LocalColumn)
def delete_column(sender, instance, **kwargs):
    handle_delete_signal(instance, "localcolumn")

@receiver(post_delete, sender=PlaceReview)
def delete_review(sender, instance, **kwargs):
    handle_delete_signal(instance, "review")

@receiver(post_delete, sender=TravelPost)
def delete_post(sender, instance, **kwargs):
    handle_delete_signal(instance, "post")