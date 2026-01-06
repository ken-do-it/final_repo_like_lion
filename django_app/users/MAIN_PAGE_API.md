# Triple 스타일 메인페이지 API

외국인 관광객을 위한 여행 플랫폼 메인페이지 API입니다.

## API 엔드포인트

```
GET /api/users/main/
```

### 인증
선택사항 (로그인 시 개인화된 데이터 제공)

```
Authorization: Bearer {access_token}  // 선택
```

---

## 응답 구조

### 비인증 사용자 응답 예시

```json
{
  "hero": {
    "title": "Discover Korea",
    "subtitle": "Travel smarter with local insights",
    "cta_text": "Start Planning",
    "background_image": "/static/images/hero-seoul.jpg"
  },
  "trending_destinations": [
    {
      "id": 1,
      "name": "Seoul",
      "name_ko": "서울",
      "country": "South Korea",
      "rating": 4.8,
      "review_count": 12453,
      "image_url": "https://images.unsplash.com/photo-1578193661644-dee2e18a5e6a",
      "tags": ["Culture", "Food", "Shopping", "Night Life"],
      "description": "Where ancient palaces meet modern skyscrapers",
      "average_cost": "₩80,000",
      "best_season": "Spring, Fall"
    },
    {
      "id": 2,
      "name": "Busan",
      "name_ko": "부산",
      "country": "South Korea",
      "rating": 4.7,
      "review_count": 8932,
      "image_url": "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22",
      "tags": ["Beach", "Seafood", "Temple", "Market"],
      "description": "Korea's coastal paradise with fresh seafood",
      "average_cost": "₩60,000",
      "best_season": "Summer, Fall"
    },
    {
      "id": 3,
      "name": "Jeju Island",
      "name_ko": "제주도",
      "country": "South Korea",
      "rating": 4.9,
      "review_count": 15678,
      "image_url": "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2",
      "tags": ["Nature", "Hiking", "Beach", "Volcano"],
      "description": "Island of natural wonders and volcanic beauty",
      "average_cost": "₩70,000",
      "best_season": "All Year"
    },
    {
      "id": 4,
      "name": "Gyeongju",
      "name_ko": "경주",
      "country": "South Korea",
      "rating": 4.6,
      "review_count": 5234,
      "image_url": "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22",
      "tags": ["History", "Temple", "UNESCO", "Culture"],
      "description": "Museum without walls, ancient Silla capital",
      "average_cost": "₩50,000",
      "best_season": "Spring, Fall"
    }
  ],
  "featured_experiences": [
    {
      "id": 1,
      "title": "Korean Temple Stay",
      "location": "Nationwide",
      "image_url": "https://images.unsplash.com/photo-1545569341-9eb8b30979d9",
      "duration": "1-2 days",
      "price": "₩50,000",
      "rating": 4.8,
      "category": "Culture"
    },
    {
      "id": 2,
      "title": "DMZ Tour",
      "location": "Paju",
      "image_url": "https://images.unsplash.com/photo-1578193661644-dee2e18a5e6a",
      "duration": "8 hours",
      "price": "₩120,000",
      "rating": 4.7,
      "category": "History"
    },
    {
      "id": 3,
      "title": "Hanbok Experience",
      "location": "Seoul",
      "image_url": "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22",
      "duration": "3 hours",
      "price": "₩30,000",
      "rating": 4.9,
      "category": "Culture"
    },
    {
      "id": 4,
      "title": "K-Food Cooking Class",
      "location": "Seoul",
      "image_url": "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2",
      "duration": "2 hours",
      "price": "₩60,000",
      "rating": 4.8,
      "category": "Food"
    }
  ],
  "local_recommendations": [
    {
      "id": 1,
      "title": "Hidden Hanok Cafe in Ikseon-dong",
      "location": "Seoul, Jongno-gu",
      "author": "Local Guide Kim",
      "author_badge": "Seoul Expert Lv.5",
      "image_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24",
      "saved_count": 2341,
      "tip": "Visit on weekday mornings to avoid crowds"
    },
    {
      "id": 2,
      "title": "Sunrise at Gamcheon Culture Village",
      "location": "Busan, Saha-gu",
      "author": "Local Guide Park",
      "author_badge": "Busan Expert Lv.4",
      "image_url": "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22",
      "saved_count": 1823,
      "tip": "Arrive before 6 AM for the best photos"
    },
    {
      "id": 3,
      "title": "Secret Beach in Udo Island",
      "location": "Jeju, Udo",
      "author": "Local Guide Lee",
      "author_badge": "Jeju Expert Lv.5",
      "image_url": "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2",
      "saved_count": 3156,
      "tip": "Rent an e-bike to explore the entire island"
    }
  ],
  "travel_tips": [
    {
      "icon": "wifi",
      "title": "Free WiFi Everywhere",
      "description": "Get a T-money card for subway and free WiFi at all stations"
    },
    {
      "icon": "translate",
      "title": "Translation Apps",
      "description": "Papago and Google Translate work great for Korean"
    },
    {
      "icon": "payment",
      "title": "Cashless Society",
      "description": "Credit cards accepted everywhere, but keep some cash for markets"
    },
    {
      "icon": "transport",
      "title": "T-money Card",
      "description": "One card for all public transportation across Korea"
    }
  ],
  "quick_stats": {
    "destinations": 247,
    "experiences": 1432,
    "local_guides": 892,
    "reviews": 156234
  }
}
```

---

### 인증된 사용자 응답 예시

로그인한 사용자에게는 추가로 다음 데이터가 포함됩니다:

```json
{
  "hero": { /* ... 위와 동일 ... */ },
  "trending_destinations": [ /* ... */ ],
  "featured_experiences": [ /* ... */ ],
  "local_recommendations": [ /* ... */ ],
  "travel_tips": [ /* ... */ ],
  "quick_stats": { /* ... */ },

  "user": {
    "id": 1,
    "username": "traveler123",
    "nickname": "여행자",
    "profile_image": "/static/images/default-avatar.png",
    "badges": [
      {
        "city": "Seoul",
        "level": 5,
        "icon": "/static/badges/seoul-lv5.png"
      },
      {
        "city": "Busan",
        "level": 3,
        "icon": "/static/badges/busan-lv3.png"
      }
    ],
    "saved_places_count": 0,
    "trips_count": 0
  },

  "personalized": {
    "language": "ko",
    "currency": "KRW",
    "recommended_for_you": [
      {
        "title": "Based on your interests",
        "items": [
          {
            "id": 1,
            "name": "Seoul",
            "name_ko": "서울",
            "rating": 4.8,
            /* ... */
          },
          {
            "id": 2,
            "name": "Busan",
            "name_ko": "부산",
            "rating": 4.7,
            /* ... */
          }
        ]
      }
    ]
  }
}
```

---

## Triple 스타일 UI 디자인 가이드

### 1. Hero Section
- **배경**: 대형 이미지 (1920x800px)
- **타이포그래피**:
  - Title: 48px, Bold, White
  - Subtitle: 20px, Regular, White with 80% opacity
- **CTA 버튼**: Primary color, Rounded corners, 16px padding

### 2. Trending Destinations (카드 그리드)
- **레이아웃**: 4 columns (Desktop), 2 columns (Tablet), 1 column (Mobile)
- **카드 디자인**:
  - 이미지 비율: 16:9
  - Border radius: 12px
  - Box shadow: subtle
  - Hover effect: Scale 1.02, shadow increase
- **태그**: Chip 스타일, 배경색 연한 회색, 8px padding
- **평점**: ⭐ 아이콘 + 숫자, 회색 텍스트로 리뷰 수

### 3. Featured Experiences (수평 스크롤)
- **레이아웃**: Horizontal scroll, 각 카드 300px width
- **카드 간격**: 16px
- **이미지**: 정사각형 (1:1 비율)
- **가격**: Bold, 강조색
- **카테고리 배지**: 오른쪽 상단, 반투명 배경

### 4. Local Recommendations
- **레이아웃**: 3 columns
- **저자 정보**:
  - 아바타: 원형, 40px
  - 뱃지: 작은 아이콘 + 레벨
- **저장 수**: 북마크 아이콘 + 숫자
- **팁**: 💡 아이콘, 이탤릭체

### 5. Travel Tips (아이콘 그리드)
- **레이아웃**: 4 columns, 동일한 높이
- **아이콘**: 48px, 원형 배경
- **색상**: 브랜드 컬러

### 6. Quick Stats
- **레이아웃**: 1 row, 4 columns
- **숫자**: 큰 글씨 (32px), Bold
- **라벨**: 작은 글씨 (14px), 회색

---

## 색상 팔레트 (Triple 스타일)

```css
/* Primary Colors */
--primary: #00C9A7;        /* Mint Green */
--primary-dark: #00B394;
--primary-light: #E6FAF6;

/* Secondary Colors */
--secondary: #845EC2;      /* Purple */
--accent: #FF6F91;         /* Pink */

/* Neutrals */
--text-primary: #2C3333;
--text-secondary: #6B7280;
--background: #FFFFFF;
--background-gray: #F9FAFB;
--border: #E5E7EB;

/* Status Colors */
--success: #10B981;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;
```

---

## 타이포그래피

```css
/* Font Family */
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Font Sizes */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
--text-5xl: 48px;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

---

## 반응형 브레이크포인트

```css
/* Mobile First */
--mobile: 0px;          /* 0 ~ 767px */
--tablet: 768px;        /* 768px ~ 1023px */
--desktop: 1024px;      /* 1024px ~ 1279px */
--wide: 1280px;         /* 1280px+ */
```

---

## 컴포넌트 예시 (React/Vue)

### DestinationCard

```jsx
<div className="destination-card">
  <img src={destination.image_url} alt={destination.name} />
  <div className="card-content">
    <div className="tags">
      {destination.tags.map(tag => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </div>
    <h3>{destination.name}</h3>
    <p className="description">{destination.description}</p>
    <div className="card-footer">
      <div className="rating">
        ⭐ {destination.rating} ({destination.review_count.toLocaleString()})
      </div>
      <div className="cost">{destination.average_cost}</div>
    </div>
  </div>
</div>
```

### ExperienceCard

```jsx
<div className="experience-card">
  <div className="category-badge">{experience.category}</div>
  <img src={experience.image_url} alt={experience.title} />
  <div className="card-content">
    <h4>{experience.title}</h4>
    <p className="location">📍 {experience.location}</p>
    <div className="details">
      <span className="duration">⏱ {experience.duration}</span>
      <span className="rating">⭐ {experience.rating}</span>
    </div>
    <div className="price">{experience.price}</div>
  </div>
</div>
```

---

## 애니메이션

```css
/* Smooth transitions */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Hover effects */
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

/* Loading skeleton */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

---

## 개발 팁

1. **이미지 최적화**: WebP 포맷 사용, lazy loading 적용
2. **성능**: Virtual scrolling for long lists
3. **접근성**: ARIA labels, keyboard navigation
4. **SEO**: Semantic HTML, meta tags
5. **국제화**: i18n 라이브러리 사용 (react-i18next, vue-i18n)

---

## 프론트엔드 구현 예시

### Next.js/React

```javascript
// pages/index.js
import { useEffect, useState } from 'react';

export default function Home() {
  const [mainData, setMainData] = useState(null);

  useEffect(() => {
    fetch('/api/users/main/', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    })
      .then(res => res.json())
      .then(data => setMainData(data));
  }, []);

  if (!mainData) return <Loading />;

  return (
    <div className="main-page">
      <HeroSection data={mainData.hero} />
      <TrendingDestinations items={mainData.trending_destinations} />
      <FeaturedExperiences items={mainData.featured_experiences} />
      <LocalRecommendations items={mainData.local_recommendations} />
      <TravelTips tips={mainData.travel_tips} />
      <QuickStats stats={mainData.quick_stats} />
    </div>
  );
}
```

이제 프론트엔드에서 이 API를 호출하면 Triple과 같은 멋진 메인페이지를 만들 수 있습니다!
