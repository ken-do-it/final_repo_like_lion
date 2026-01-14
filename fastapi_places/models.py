"""
SQLAlchemy Models for Places API
Django 테이블을 SQLAlchemy로 매핑
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Numeric, Date, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

# 같은 디렉토리의 database.py에서 Base import
from database import Base


class User(Base):
    """사용자 모델 (Django User 테이블)"""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(150), unique=True, nullable=False)
    email = Column(String(254))
    nickname = Column(String(50))
    profile_image_url = Column(String(500))

    # Relationships
    local_badges = relationship("LocalBadge", back_populates="user")
    place_reviews = relationship("PlaceReview", back_populates="user")
    place_bookmarks = relationship("PlaceBookmark", back_populates="user")
    local_columns = relationship("LocalColumn", back_populates="user")


class Place(Base):
    """장소 모델"""
    __tablename__ = 'places'

    id = Column(Integer, primary_key=True)
    provider = Column(String(50), default='KAKAO')  # KAKAO, USER
    place_api_id = Column(String(50), unique=True, nullable=True)
    name = Column(Text, nullable=False)
    source_lang = Column(String(10), default='ko')

    # 카테고리
    category_main = Column(String(50))
    category_detail = Column(JSON, default=list)

    # 위치
    address = Column(Text, nullable=False)
    city = Column(String(50), index=True)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)

    # 이미지
    thumbnail_urls = Column(JSON, default=list)

    # 통계 (캐시)
    average_rating = Column(Numeric(3, 2), default=0.00)
    review_count = Column(Integer, default=0)

    # 등록자
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)

    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    reviews = relationship("PlaceReview", back_populates="place")
    bookmarks = relationship("PlaceBookmark", back_populates="place")
    local_columns = relationship("LocalColumn", back_populates="representative_place")

    __table_args__ = (
        Index('idx_places_city', 'city'),
        Index('idx_places_provider', 'provider'),
        Index('idx_places_place_api_id', 'place_api_id'),
    )


class PlaceReview(Base):
    """장소 리뷰 모델"""
    __tablename__ = 'place_reviews'

    id = Column(Integer, primary_key=True)
    place_id = Column(Integer, ForeignKey('places.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    content = Column(Text, nullable=False)
    source_lang = Column(String(10), default='ko')
    rating = Column(Integer, default=5)  # 1~5
    image_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    place = relationship("Place", back_populates="reviews")
    user = relationship("User", back_populates="place_reviews")

    __table_args__ = (
        UniqueConstraint('user_id', 'place_id', name='unique_user_place_review'),
    )


class PlaceBookmark(Base):
    """장소 찜하기 모델"""
    __tablename__ = 'place_bookmarks'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    place_id = Column(Integer, ForeignKey('places.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="place_bookmarks")
    place = relationship("Place", back_populates="bookmarks")

    __table_args__ = (
        UniqueConstraint('user_id', 'place_id', name='unique_user_place_bookmark'),
        Index('idx_place_bookmarks_user_id', 'user_id'),
    )


class LocalBadge(Base):
    """현지인 인증 뱃지 모델"""
    __tablename__ = 'local_badges'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    city = Column(String(100), nullable=False)

    # 레벨 시스템 (1~5)
    level = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    # 인증 날짜
    first_authenticated_at = Column(Date, nullable=False)
    last_authenticated_at = Column(Date, nullable=False)
    next_authentication_due = Column(Date, nullable=False)

    maintenance_months = Column(Integer, default=0)

    # Relationships
    user = relationship("User", back_populates="local_badges")


class LocalColumn(Base):
    """현지인 칼럼 모델"""
    __tablename__ = 'local_columns'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    title = Column(String(200), nullable=False)
    thumbnail_url = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    source_lang = Column(String(10), default='ko')
    intro_image_url = Column(Text, nullable=True)

    representative_place_id = Column(Integer, ForeignKey('places.id'), nullable=True)
    view_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="local_columns")
    representative_place = relationship("Place", back_populates="local_columns")
    sections = relationship("LocalColumnSection", back_populates="column", cascade="all, delete-orphan")


class LocalColumnSection(Base):
    """칼럼 섹션 모델"""
    __tablename__ = 'local_column_sections'

    id = Column(Integer, primary_key=True)
    column_id = Column(Integer, ForeignKey('local_columns.id'), nullable=False)
    place_id = Column(Integer, ForeignKey('places.id'), nullable=True)

    order = Column(Integer, default=0)
    title = Column(String(200))
    content = Column(Text, nullable=False)
    source_lang = Column(String(10), default='ko')

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    column = relationship("LocalColumn", back_populates="sections")
    images = relationship("LocalColumnSectionImage", back_populates="section", cascade="all, delete-orphan")


class LocalColumnSectionImage(Base):
    """칼럼 섹션 이미지 모델"""
    __tablename__ = 'local_column_section_images'

    id = Column(Integer, primary_key=True)
    section_id = Column(Integer, ForeignKey('local_column_sections.id'), nullable=False)

    image_url = Column(Text, nullable=False)
    order = Column(Integer, default=0)

    # Relationships
    section = relationship("LocalColumnSection", back_populates="images")


class RoadviewGameImage(Base):
    """로드뷰 게임 이미지 모델"""
    __tablename__ = 'roadview_game_images'

    id = Column(Integer, primary_key=True)
    image_url = Column(String(500), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    city = Column(String(50), nullable=True)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)