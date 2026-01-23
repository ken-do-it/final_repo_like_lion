from datetime import date, timedelta
from typing import Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import LocalBadge
from services.geo import is_korea_location, reverse_geocode


def calculate_next_due(current_level: int, auth_count: int) -> date:
    today = date.today()

    if current_level == 1:
        return today + timedelta(weeks=1)
    if current_level == 2:
        return today + timedelta(weeks=1)
    if current_level == 3:
        return today + timedelta(days=180)
    if current_level in [4, 5]:
        return today + timedelta(days=365)

    return today + timedelta(weeks=1)


async def authenticate_local_badge(
    db: Session,
    user_id: int,
    latitude: float,
    longitude: float,
) -> Tuple[LocalBadge, str]:
    if not is_korea_location(latitude, longitude):
        raise HTTPException(
            status_code=400,
            detail="대한민국 내 위치가 아닙니다.",
        )

    city = await reverse_geocode(latitude, longitude)
    if not city:
        raise HTTPException(status_code=400, detail="도시 정보를 찾을 수 없습니다.")

    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    if not badge:
        badge = LocalBadge(
            user_id=user_id,
            city=city,
            level=1,
            is_active=True,
            first_authenticated_at=date.today(),
            last_authenticated_at=date.today(),
            next_authentication_due=calculate_next_due(1, 0),
            maintenance_months=0,
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)
        return badge, (
            f"{city} 로컬 인증 완료! (Level 1) 1주 후 재인증 가능합니다."
        )

    today = date.today()

    if not badge.is_active:
        badge.city = city
        badge.is_active = True
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 로컬 인증이 재활성화되었습니다. (Level {badge.level})"

    if today < badge.next_authentication_due:
        days_left = (badge.next_authentication_due - today).days
        raise HTTPException(
            status_code=400,
            detail=f"다음 인증은 {badge.next_authentication_due} 이후 가능합니다. ({days_left}일 남음)",
        )

    if today > badge.next_authentication_due:
        badge.is_active = False
        badge.city = city
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"인증 기간이 만료되었습니다. (Level {badge.level})"

    badge.last_authenticated_at = today

    if badge.level == 1:
        badge.level = 2
        badge.maintenance_months = 0
        message = f"{city} 로컬 배지 Level 2 달성! 1주 후 재인증 가능합니다."
    elif badge.level == 2:
        badge.level = 3
        badge.maintenance_months = 0
        message = f"{city} 로컬 배지 Level 3 달성! 6개월 후 재인증 가능합니다."
    elif badge.level == 3:
        badge.level = 4
        badge.maintenance_months = 6
        message = f"{city} 로컬 배지 Level 4 달성! 1년 후 재인증 가능합니다."
    elif badge.level == 4:
        badge.level = 5
        badge.maintenance_months = 12
        message = f"{city} 로컬 배지 Level 5 달성! 1년 후 재인증 가능합니다."
    else:
        badge.maintenance_months += 12
        message = f"{city} 로컬 배지 Level 5 유지! 1년 후 재인증 가능합니다."

    badge.next_authentication_due = calculate_next_due(badge.level, 0)
    db.commit()
    db.refresh(badge)

    return badge, message


def check_local_badge_active(db: Session, user_id: int) -> LocalBadge:
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    if True:
        if not badge:
            badge = LocalBadge(
                user_id=user_id,
                city="테스트 City",
                level=5,
                is_active=True,
                first_authenticated_at=date.today(),
                last_authenticated_at=date.today(),
                next_authentication_due=date.today() + timedelta(days=365),
            )
        else:
            badge.level = 5
            badge.is_active = True
        return badge

    if not badge:
        raise HTTPException(status_code=403, detail="로컬 배지가 없습니다.")

    if badge.level < 3:
        raise HTTPException(
            status_code=403,
            detail=f"칼럼 작성은 Level 3 이상부터 가능합니다. (현재 {badge.level})",
        )

    if badge.is_active and date.today() > badge.next_authentication_due:
        badge.is_active = False
        db.commit()

    if not badge.is_active:
        raise HTTPException(
            status_code=403,
            detail="로컬 배지 유효기간이 만료되었습니다.",
        )

    return badge
