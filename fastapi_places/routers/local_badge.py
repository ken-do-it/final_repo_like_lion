from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models import LocalBadge
from schemas import LocalBadgeAuthRequest, LocalBadgeAuthResponse, LocalBadgeStatusResponse
from services.badges import authenticate_local_badge


router = APIRouter()


# ==================== 현지인 인증 ====================

@router.post("/local-badge/authenticate", response_model=LocalBadgeAuthResponse)
async def authenticate_badge(
    auth_data: LocalBadgeAuthRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    현지인 인증 (위치 기반)
    """
    badge, message = await authenticate_local_badge(
        db, user_id, auth_data.latitude, auth_data.longitude
    )

    return LocalBadgeAuthResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        next_authentication_due=badge.next_authentication_due,
        message=message,
    )


@router.get("/local-badge/status", response_model=LocalBadgeStatusResponse)
def get_badge_status(
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """
    현지인 뱃지 상태 조회
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    # [Superuser Bypass] 관리자는 Level 5로 반환
    try:
        from sqlalchemy import text
        result = db.execute(text("SELECT is_superuser FROM users WHERE id = :uid"), {"uid": user_id}).first()
        if result and result[0]:  # is_superuser == True
            return LocalBadgeStatusResponse(
                level=5,
                city=badge.city if badge else "관리자",
                is_active=True,
                first_authenticated_at=badge.first_authenticated_at if badge else date.today(),
                last_authenticated_at=badge.last_authenticated_at if badge else date.today(),
                next_authentication_due=badge.next_authentication_due if badge else date.today() + timedelta(days=365),
                maintenance_months=badge.maintenance_months if badge else 0,
                authentication_count=0
            )
    except Exception as e:
        print(f"[Warning] Superuser check failed: {e}")

    if not badge:
        return LocalBadgeStatusResponse(
            level=0,
            city=None,
            is_active=False,
            first_authenticated_at=None,
            last_authenticated_at=None,
            next_authentication_due=None,
            maintenance_months=0,
            authentication_count=0
        )

    return LocalBadgeStatusResponse(
        level=badge.level,
        city=badge.city,
        is_active=badge.is_active,
        first_authenticated_at=badge.first_authenticated_at,
        last_authenticated_at=badge.last_authenticated_at,
        next_authentication_due=badge.next_authentication_due,
        maintenance_months=badge.maintenance_months,
        authentication_count=0
    )
