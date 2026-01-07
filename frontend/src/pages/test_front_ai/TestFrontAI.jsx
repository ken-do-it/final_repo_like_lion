import { useMemo, useState } from 'react'
import './TestFrontAI.css'
import ShortsPage from './ShortsPage'
import ShortsDetailPage from './ShortsDetailPage'

const destinationsMap = {
  eng_Latn: [
    {
      id: 1,
      name: 'Seoul',
      desc: 'The vibrant heart of culture & tech',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBPHuKBiO6H4F_aRO_p_I0QmtgymwrOknzT5pkxa2-KYcYNiLIlzIq2NnS2u19OMs8zHAXCCI3fHC46-YAMV01_pJJMAtUucnhZ-xNqA3372FYE2XIJsPqSa2FjghchNQGbA1AuEgTXsn0dgcpkG_FCLaiy-j4G7ALXo-pegyxU4OOcoUxrGTHc-0YZ968W4-ghlvz3ObgOD-iX1JpKV3P4W7dK1F215t3FVk_lqzDPnaXLi_7Bp7Z4KbNukR-CBJmpYMH8ySGRuGb9',
    },
    {
      id: 2,
      name: 'Busan',
      desc: 'Coastal adventures & fresh seafood',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    {
      id: 3,
      name: 'Jeju Island',
      desc: "Nature's paradise & volcanic wonders",
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA8rnKIyHbDKKhcvHTbDkn_QWg-SILVWbgsEzoq0aUOWDT-_eLChpnuii0JawRvz47NwfOm8K4VexZShJd-cCOEQ3op73UBCrAcrHdXwZHNcb1Zbecbc6H7UwydrEQbQylXTcNhc3BlIbPluqBPhKpJwr-iSHBhoAyOHkqeYp7QLdlqx-B2L-kGja_oVHG61WDv6ig3fh5Sof3bNV4khkKGW0ksE6JwOHVb6HPc88YoGrakSfJFeO7opLF1ZlJqnodcjbsPvaguKOsf',
    },
    {
      id: 4,
      name: 'Gyeongju',
      desc: 'A museum without walls',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDV1H7ddimHAV9U2uEpcwQQZiJxgI0HsAW_H5JIjkuN_vpDDU25AABP11-GTQaufLLtdyPehhzA0BcihGvXgfp7a-c57Go6U-sFf3u26yQWI9rDvMNjemO2IgmWpSf0I6fjmGUFbpUNKAmKbLRp5ac1GBiKUovNEUmG20aWhrfOWhq0UtBoPxbByo8b6BM3DW-TK8vrYEiz1UsP0jH_BDjXuQfeE6Wq5_GjeJdnwEoaUjo70f8uRg09ge7BqaWETIgDppeO93y4M9gY',
    },
  ],
  kor_Hang: [
    {
      id: 1,
      name: '서울',
      desc: '문화와 기술이 공존하는 중심지',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBPHuKBiO6H4F_aRO_p_I0QmtgymwrOknzT5pkxa2-KYcYNiLIlzIq2NnS2u19OMs8zHAXCCI3fHC46-YAMV01_pJJMAtUucnhZ-xNqA3372FYE2XIJsPqSa2FjghchNQGbA1AuEgTXsn0dgcpkG_FCLaiy-j4G7ALXo-pegyxU4OOcoUxrGTHc-0YZ968W4-ghlvz3ObgOD-iX1JpKV3P4W7dK1F215t3FVk_lqzDPnaXLi_7Bp7Z4KbNukR-CBJmpYMH8ySGRuGb9',
    },
    {
      id: 2,
      name: '부산',
      desc: '해변의 낭만과 신선한 해산물',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    {
      id: 3,
      name: '제주도',
      desc: '자연의 낙원과 화산의 신비',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA8rnKIyHbDKKhcvHTbDkn_QWg-SILVWbgsEzoq0aUOWDT-_eLChpnuii0JawRvz47NwfOm8K4VexZShJd-cCOEQ3op73UBCrAcrHdXwZHNcb1Zbecbc6H7UwydrEQbQylXTcNhc3BlIbPluqBPhKpJwr-iSHBhoAyOHkqeYp7QLdlqx-B2L-kGja_oVHG61WDv6ig3fh5Sof3bNV4khkKGW0ksE6JwOHVb6HPc88YoGrakSfJFeO7opLF1ZlJqnodcjbsPvaguKOsf',
    },
    {
      id: 4,
      name: '경주',
      desc: '지붕 없는 박물관',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDV1H7ddimHAV9U2uEpcwQQZiJxgI0HsAW_H5JIjkuN_vpDDU25AABP11-GTQaufLLtdyPehhzA0BcihGvXgfp7a-c57Go6U-sFf3u26yQWI9rDvMNjemO2IgmWpSf0I6fjmGUFbpUNKAmKbLRp5ac1GBiKUovNEUmG20aWhrfOWhq0UtBoPxbByo8b6BM3DW-TK8vrYEiz1UsP0jH_BDjXuQfeE6Wq5_GjeJdnwEoaUjo70f8uRg09ge7BqaWETIgDppeO93y4M9gY',
    },
  ],
  jpn_Jpan: [
    {
      id: 1,
      name: 'ソウル',
      desc: '文化と技術が融合する中心地',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBPHuKBiO6H4F_aRO_p_I0QmtgymwrOknzT5pkxa2-KYcYNiLIlzIq2NnS2u19OMs8zHAXCCI3fHC46-YAMV01_pJJMAtUucnhZ-xNqA3372FYE2XIJsPqSa2FjghchNQGbA1AuEgTXsn0dgcpkG_FCLaiy-j4G7ALXo-pegyxU4OOcoUxrGTHc-0YZ968W4-ghlvz3ObgOD-iX1JpKV3P4W7dK1F215t3FVk_lqzDPnaXLi_7Bp7Z4KbNukR-CBJmpYMH8ySGRuGb9',
    },
    {
      id: 2,
      name: '釜山',
      desc: '海辺の冒険と新鮮なシーフード',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    {
      id: 3,
      name: '済州島',
      desc: '自然の楽園と火山の驚異',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA8rnKIyHbDKKhcvHTbDkn_QWg-SILVWbgsEzoq0aUOWDT-_eLChpnuii0JawRvz47NwfOm8K4VexZShJd-cCOEQ3op73UBCrAcrHdXwZHNcb1Zbecbc6H7UwydrEQbQylXTcNhc3BlIbPluqBPhKpJwr-iSHBhoAyOHkqeYp7QLdlqx-B2L-kGja_oVHG61WDv6ig3fh5Sof3bNV4khkKGW0ksE6JwOHVb6HPc88YoGrakSfJFeO7opLF1ZlJqnodcjbsPvaguKOsf',
    },
    {
      id: 4,
      name: '慶州',
      desc: '屋根のない博物館',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDV1H7ddimHAV9U2uEpcwQQZiJxgI0HsAW_H5JIjkuN_vpDDU25AABP11-GTQaufLLtdyPehhzA0BcihGvXgfp7a-c57Go6U-sFf3u26yQWI9rDvMNjemO2IgmWpSf0I6fjmGUFbpUNKAmKbLRp5ac1GBiKUovNEUmG20aWhrfOWhq0UtBoPxbByo8b6BM3DW-TK8vrYEiz1UsP0jH_BDjXuQfeE6Wq5_GjeJdnwEoaUjo70f8uRg09ge7BqaWETIgDppeO93y4M9gY',
    },
  ],
  zho_Hans: [
    {
      id: 1,
      name: '首尔',
      desc: '文化与科技的活力中心',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBPHuKBiO6H4F_aRO_p_I0QmtgymwrOknzT5pkxa2-KYcYNiLIlzIq2NnS2u19OMs8zHAXCCI3fHC46-YAMV01_pJJMAtUucnhZ-xNqA3372FYE2XIJsPqSa2FjghchNQGbA1AuEgTXsn0dgcpkG_FCLaiy-j4G7ALXo-pegyxU4OOcoUxrGTHc-0YZ968W4-ghlvz3ObgOD-iX1JpKV3P4W7dK1F215t3FVk_lqzDPnaXLi_7Bp7Z4KbNukR-CBJmpYMH8ySGRuGb9',
    },
    {
      id: 2,
      name: '釜山',
      desc: '沿海探险与新鲜海鲜',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    {
      id: 3,
      name: '济州岛',
      desc: '自然天堂与火山奇观',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA8rnKIyHbDKKhcvHTbDkn_QWg-SILVWbgsEzoq0aUOWDT-_eLChpnuii0JawRvz47NwfOm8K4VexZShJd-cCOEQ3op73UBCrAcrHdXwZHNcb1Zbecbc6H7UwydrEQbQylXTcNhc3BlIbPluqBPhKpJwr-iSHBhoAyOHkqeYp7QLdlqx-B2L-kGja_oVHG61WDv6ig3fh5Sof3bNV4khkKGW0ksE6JwOHVb6HPc88YoGrakSfJFeO7opLF1ZlJqnodcjbsPvaguKOsf',
    },
    {
      id: 4,
      name: '庆州',
      desc: '没有屋顶的博物馆',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDV1H7ddimHAV9U2uEpcwQQZiJxgI0HsAW_H5JIjkuN_vpDDU25AABP11-GTQaufLLtdyPehhzA0BcihGvXgfp7a-c57Go6U-sFf3u26yQWI9rDvMNjemO2IgmWpSf0I6fjmGUFbpUNKAmKbLRp5ac1GBiKUovNEUmG20aWhrfOWhq0UtBoPxbByo8b6BM3DW-TK8vrYEiz1UsP0jH_BDjXuQfeE6Wq5_GjeJdnwEoaUjo70f8uRg09ge7BqaWETIgDppeO93y4M9gY',
    },
  ],
}

const langToCode = {
  English: 'eng_Latn',
  한국어: 'kor_Hang',
  日本語: 'jpn_Jpan',
  中文: 'zho_Hans',
}

const uiGlossary = {
  navLogin: { kor_Hang: '로그인', jpn_Jpan: 'ログイン', zho_Hans: '登录' },
  navSignup: { kor_Hang: '회원가입', jpn_Jpan: 'サインアップ', zho_Hans: '注册' },
  navStart: { kor_Hang: '계획 시작하기', jpn_Jpan: '計画を始める', zho_Hans: '开始计划' },
  navShorts: { kor_Hang: '쇼츠', jpn_Jpan: 'ショート', zho_Hans: '短视频' },
  viewAll: { kor_Hang: '모두 보기', jpn_Jpan: 'すべて見る', zho_Hans: '查看全部' },
  heroBadge: { kor_Hang: 'AI 여행 가이드', jpn_Jpan: 'AI旅行ガイド', zho_Hans: 'AI旅游指南' },
  heroTitle1: { kor_Hang: '당신의 완벽한', jpn_Jpan: 'あなたの完璧な', zho_Hans: '您的完美' },
  heroTitle2: { kor_Hang: '한국 여행을 디자인하세요', jpn_Jpan: '韓国旅行をデザイン', zho_Hans: '韩国旅行设计' },
  heroSub: {
    kor_Hang: 'AI가 추천하는 숨겨진 명소와 맛집을 탐험해보세요.',
    jpn_Jpan: 'AIが推奨する隠れた名所とグルメを探索しましょう。',
    zho_Hans: '探索AI推荐的隐藏景点和美食。',
  },
  ctaAI: { kor_Hang: 'AI로 일정 만들기', jpn_Jpan: 'AIで日程作成', zho_Hans: '用AI制定行程' },
  ctaSelf: { kor_Hang: '직접 계획하기', jpn_Jpan: '自分で計画', zho_Hans: '自行计划' },
  popularTitle: { kor_Hang: '인기 여행지', jpn_Jpan: '人気旅行先', zho_Hans: '热门目的地' },
}

function TestFrontAI() {
  const [language, setLanguage] = useState('English')
  const [currentView, setCurrentView] = useState('home')
  const [selectedShortId, setSelectedShortId] = useState(null)

  const baseTexts = useMemo(
    () => ({
      navLogin: 'Login',
      navSignup: 'Sign Up',
      navStart: 'Start Planning',
      navShorts: 'Shorts',
      heroBadge: 'AI Travel Guide',
      heroTitle1: 'Design Your Perfect',
      heroTitle2: 'Korea Trip',
      heroSub: 'Explore hidden gems and restaurants recommended by AI.',
      ctaAI: 'Create with AI',
      ctaSelf: 'Plan Yourself',
      popularTitle: 'Popular Destinations',
      viewAll: 'View All',
    }),
    []
  )

  const langCode = langToCode[language] || 'eng_Latn'
  const t = useMemo(() => {
    const map = { ...baseTexts }
    if (langCode !== 'eng_Latn') {
      Object.keys(baseTexts).forEach((key) => {
        const translated = uiGlossary[key]?.[langCode]
        if (translated) map[key] = translated
      })
    }
    return map
  }, [baseTexts, langCode])

  const destinations = useMemo(() => destinationsMap[langCode] || destinationsMap.eng_Latn, [langCode])

  const handleShortClick = (id) => {
    if (!id) return
    setSelectedShortId(id)
    setCurrentView('shorts_detail')
  }

  const handleBackToShorts = () => {
    setCurrentView('shorts')
    setSelectedShortId(null)
  }

  return (
    <div className="tfai">
      <div className="tfai-subnav">
        <div className="tfai-subnav-left">
          <div className="tfai-logo" onClick={() => setCurrentView('home')} style={{ cursor: 'pointer' }}>
            <span className="material-symbols-outlined">travel_explore</span>
            <span>Korea Travel AI</span>
          </div>
          <div className="tfai-lang">
            <span className="material-symbols-outlined">language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option>English</option>
              <option>한국어</option>
              <option>日本語</option>
              <option>中文</option>
            </select>
          </div>
        </div>
        <div className="tfai-subnav-right">
          <span
            onClick={() => setCurrentView('shorts')}
            style={{
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              marginRight: '20px',
              color: '#333',
            }}
          >
            {t.navShorts}
          </span>
          <a href="#">{t.navLogin}</a>
          <a href="#">{t.navSignup}</a>
          <button className="tfai-cta">{t.navStart}</button>
        </div>
      </div>

      {currentView === 'home' && (
        <>
          <section className="tfai-hero">
            <div className="tfai-hero-overlay" />
            <div className="tfai-hero-content">
              <p className="tfai-badge">{t.heroBadge}</p>
              <h1>
                {t.heroTitle1}
                <br />
                <span>{t.heroTitle2}</span>
              </h1>
              <p className="tfai-hero-sub">{t.heroSub}</p>
              <div className="tfai-hero-actions">
                <button className="primary">
                  <span className="material-symbols-outlined">auto_awesome</span>
                  {t.ctaAI}
                </button>
                <button className="ghost">
                  <span className="material-symbols-outlined">edit_location_alt</span>
                  {t.ctaSelf}
                </button>
              </div>
            </div>
          </section>

          <ShortsPage embed onShortClick={handleShortClick} language={language} />

          <section className="tfai-section">
            <div className="tfai-section-heading tfai-section-heading-row">
              <h2>{t.popularTitle}</h2>
              <a href="#" className="tfai-link">
                {t.viewAll}
              </a>
            </div>
            <div className="tfai-destinations">
              {destinations.map((d) => (
                <div key={d.id} className="tfai-dest-card">
                  <div className="image" style={{ backgroundImage: `url(${d.image})` }} aria-label={d.name} />
                  <div>
                    <p className="name">{d.name}</p>
                    <p className="desc">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {currentView === 'shorts' && (
        <div style={{ marginTop: '20px' }}>
          <ShortsPage onShortClick={handleShortClick} language={language} />
        </div>
      )}

      {currentView === 'shorts_detail' && selectedShortId && (
        <div style={{ marginTop: '20px' }}>
          <ShortsDetailPage videoId={selectedShortId} onBack={handleBackToShorts} language={language} />
        </div>
      )}
    </div>
  )
}

export default TestFrontAI
