from datetime import date, timedelta
from typing import Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import LocalBadge
from services.geo import is_korea_location, reverse_geocode


# ==================== 현지인 인증 시스템 ====================

def calculate_next_due(current_level: int, auth_count: int) -> date:
    """
    레벨별 다음 인증 예정일 계산

    Level 1→2: 1주일
    Level 2→3: 1주일
    Level 3→4: 6개월
    Level 4→5: 1년
    Level 5: 1년 (반복)
    """
    today = date.today()

    if current_level == 1:
        return today + timedelta(weeks=1)
    elif current_level == 2:
        return today + timedelta(weeks=1)
    elif current_level == 3:
        return today + timedelta(days=180)
    elif current_level in [4, 5]:
        return today + timedelta(days=365)

    return today + timedelta(weeks=1)  # 기본값


async def authenticate_local_badge(
    db: Session,
    user_id: int,
    latitude: float,
    longitude: float
) -> Tuple[LocalBadge, str]:
    """
    현지인 인증 처리

    로직:
    - Level 1: 첫 인증
    - Level 2: 1주일 후 재인증
    - Level 3: 또 1주일 후 재인증 (글 작성 가능)
    - Level 4: 6개월 후 재인증
    - Level 5: 1년 후 재인증, 이후 1년 주기
    - 인증일 지나면 비활성화, 재인증 시 이전 레벨 유지

    Returns:
        (LocalBadge, message)
    """
    # 1. 위치 확인
    if not is_korea_location(latitude, longitude):
        raise HTTPException(status_code=400, detail="한국 내 위치에서만 인증 가능합니다")

    city = await reverse_geocode(latitude, longitude)
    if not city:
        raise HTTPException(status_code=400, detail="도시를 확인할 수 없습니다")

    # 2. 기존 뱃지 조회
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    # 3. 첫 인증
    if not badge:
        badge = LocalBadge(
            user_id=user_id,
            city=city,
            level=1,
            is_active=True,
            first_authenticated_at=date.today(),
            last_authenticated_at=date.today(),
            next_authentication_due=calculate_next_due(1, 0),
            maintenance_months=0
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 시작했습니다! (Level 1) 1주일 후 재인증 가능합니다."

    # 4. 인증일 확인
    today = date.today()

    # 4-1. 인증일이 지나서 비활성화된 경우 → 재활성화 (레벨 유지)
    if not badge.is_active:
        badge.city = city
        badge.is_active = True
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"{city} 현지인 인증을 재개했습니다! (Level {badge.level} 유지)"

    # 4-2. 아직 인증일이 안 됨 → 에러
    if today < badge.next_authentication_due:
        days_left = (badge.next_authentication_due - today).days
        raise HTTPException(
            status_code=400,
            detail=f"다음 인증일은 {badge.next_authentication_due}입니다. ({days_left}일 남음)"
        )

    # 4-3. 인증일이 지났지만 아직 활성화 상태 → 비활성화 처리
    # (실제로는 배치 작업으로 해야 하지만, 여기서 처리)
    if today > badge.next_authentication_due:
        badge.is_active = False
        badge.city = city
        badge.last_authenticated_at = today
        badge.next_authentication_due = calculate_next_due(badge.level, 0)
        db.commit()
        db.refresh(badge)
        return badge, f"인증 기한이 지나 재인증했습니다. (Level {badge.level} 유지)"

    # 5. 정상 인증 (레벨 업그레이드)
    badge.last_authenticated_at = today
    old_level = badge.level

    # Level 1 → 2
    if badge.level == 1:
        badge.level = 2
        badge.maintenance_months = 0
        message = f"{city} 현지인 Level 2 달성! 1주일 후 재인증 가능합니다."

    # Level 2 → 3
    elif badge.level == 2:
        badge.level = 3
        badge.maintenance_months = 0
        message = f"{city} 현지인 Level 3 달성! 이제 칼럼을 작성할 수 있습니다. 6개월 후 재인증 가능합니다."

    # Level 3 → 4
    elif badge.level == 3:
        badge.level = 4
        badge.maintenance_months = 6
        message = f"{city} 현지인 Level 4 달성! 1년 후 재인증 가능합니다."

    # Level 4 → 5
    elif badge.level == 4:
        badge.level = 5
        badge.maintenance_months = 12
        message = f"{city} 현지인 Level 5 달성! 최고 레벨입니다. 1년 후 재인증 필요합니다."

    # Level 5 유지
    else:
        badge.maintenance_months += 12
        message = f"{city} 현지인 Level 5 유지! 1년 후 재인증 필요합니다."

    badge.next_authentication_due = calculate_next_due(badge.level, 0)
    db.commit()
    db.refresh(badge)

    return badge, message


def check_local_badge_active(db: Session, user_id: int) -> LocalBadge:
    """
    현지인 칼럼 작성 권한 확인
    Level 3 이상, 활성화 상태여야 가능
    """
    badge = db.query(LocalBadge).filter(LocalBadge.user_id == user_id).first()

    # [TEMPORARY TEST MODE] 모든 사용자에게 Level 5 권한 부여 (테스트용)
    # 번역 기능 테스트 종료 후 반드시 삭제/원복 필요
    # if True:
    #     # 가짜 뱃지 객체 반환 (레벨 5)
    #     # badge가 있으면 그것을 사용하지 않고, 무조건 레벨 5로 덮어쓰거나 새로 생성
    #     if not badge:
    #         badge = LocalBadge(
    #             user_id=user_id,
    #             city="테스트 City",
    #             level=5,
    #             is_active=True,
    #             first_authenticated_at=date.today(),
    #             last_authenticated_at=date.today(),
    #             next_authentication_due=date.today() + timedelta(days=365)
    #         )
    #     else:
    #         # 기존 뱃지가 있어도 레벨 5로 간주 (객체 속성 변경은 DB 저장 안함)
    #         badge.level = 5
    #         badge.is_active = True
    #     return badge

    # [Superuser Bypass] 관리자는 무조건 통과 (Raw SQL 사용 - Safe Check)
    try:
        from sqlalchemy import text
        # users 테이블에 is_superuser 컬럼이 있는지 확인하고 값 조회
        result = db.execute(text("SELECT is_superuser FROM users WHERE id = :uid"), {"uid": user_id}).first()
        if result and result[0]:  # is_superuser == True
            # 가짜 뱃지 객체 반환 (레벨 5)
            if not badge:
                badge = LocalBadge(
                    user_id=user_id,
                    city="Superuser City",
                    level=5,
                    is_active=True,
                    first_authenticated_at=date.today(),
                    last_authenticated_at=date.today(),
                    next_authentication_due=date.today() + timedelta(days=365)
                )
            return badge
    except Exception as e:
        # 컬럼이 없거나 에러 발생 시 무시하고 일반 로직 진행
        print(f"[Warning] Superuser check failed: {e}")

    if not badge:
        raise HTTPException(status_code=403, detail="현지인 인증이 필요합니다")

    if badge.level < 3:
        raise HTTPException(
            status_code=403,
            detail=f"칼럼 작성은 Level 3부터 가능합니다. (현재 Level {badge.level})"
        )

    # 만료 체크: 인증일이 지났으면 자동으로 비활성화
    if badge.is_active and date.today() > badge.next_authentication_due:
        badge.is_active = False
        db.commit()

    if not badge.is_active:
        raise HTTPException(
            status_code=403,
            detail="인증이 만료되었습니다. 재인증이 필요합니다."
        )

    return badge