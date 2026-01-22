from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from schemas import LocalBadgeAuthRequest, LocalBadgeAuthResponse, LocalBadgeStatusResponse
from services.badges import authenticate_local_badge


router = APIRouter()


@router.post("/local-badge/authenticate", response_model=LocalBadgeAuthResponse)
async def authenticate_badge(
    auth_data: LocalBadgeAuthRequest,
    user_id: int = Depends(require_auth),
    db: Session = Depends(get_db),
):
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
    # [TEMPORARY TEST MODE]
    return LocalBadgeStatusResponse(
        level=5,
        city="강남/서초",
        is_active=True,
        first_authenticated_at=date.today(),
        last_authenticated_at=date.today(),
        next_authentication_due=date.today() + timedelta(days=365),
        maintenance_months=12,
        authentication_count=999,
    )

    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

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
    """
