import { useEffect, useMemo, useState } from 'react'
import './TestFrontAI.css'

const initialDestinations = [
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
]

const sampleShorts = [
  {
    title: 'Seoul Night Highlights',
    desc: '3-minute recap: Hangang parks, Namsan Tower, and Gwangjang street food.',
    thumb: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=800&q=80',
    video: '',
    duration: '03:12',
    lang: 'ko',
  },
  {
    title: 'Busan Gamcheon Vlog',
    desc: 'Local guide to view points and 5 cozy cafes you should not miss.',
    thumb: 'https://images.unsplash.com/photo-1587606600804-4921c7f01d9f?auto=format&fit=crop&w=800&q=80',
    video: '',
    duration: '02:41',
    lang: 'en',
  },
  {
    title: 'Jeju Olle Best 3',
    desc: 'Easy courses for beginners plus food recommendations with subtitles.',
    thumb: 'https://images.unsplash.com/photo-1587453206275-454e4360d72f?auto=format&fit=crop&w=800&q=80',
    video: '',
    duration: '04:05',
    lang: 'ja',
  },
]

const langToCode = {
  English: 'eng_Latn',
  한국어: 'kor_Hang',
  日本語: 'jpn_Jpan',
  中文: 'zho_Hans',
}

// UI Glossary: Override AI translations for specific terms
// 재생, 닫기, 로그인, 회원가입, 계획 시작하기, 모두 보기 고정된 텍스트를 AI가 번역하지 않고 정의된 텍스트로 출력
// UI Glossary: Override AI translations for specific terms
const uiGlossary = {
  play: { kor_Hang: '재생', jpn_Jpan: '再生', zho_Hans: '播放' },
  close: { kor_Hang: '닫기', jpn_Jpan: '閉じる', zho_Hans: '关闭' },
  navLogin: { kor_Hang: '로그인', jpn_Jpan: 'ログイン', zho_Hans: '登录' },
  navSignup: { kor_Hang: '회원가입', jpn_Jpan: 'サインアップ', zho_Hans: '注册' },
  navStart: { kor_Hang: '계획 시작하기', jpn_Jpan: '計画を始める', zho_Hans: '开始计划' },
  viewAll: { kor_Hang: '모두 보기', jpn_Jpan: 'すべて見る', zho_Hans: '查看全部' },
  loading: { kor_Hang: '로딩 중...', jpn_Jpan: '読み込み中...', zho_Hans: '载入中...' },
  langLabel: { kor_Hang: '언어', jpn_Jpan: '言語', zho_Hans: '语言' },
  upload: { kor_Hang: '업로드', jpn_Jpan: 'アップロード', zho_Hans: '上传' }, // Added
}

function TestFrontAI() {
  const [language, setLanguage] = useState('English')
  const [shortforms, setShortforms] = useState(sampleShorts)
  const [destinations, setDestinations] = useState(initialDestinations)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [uiTranslations, setUiTranslations] = useState({})

  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('video_file', uploadFile)
    formData.append('title', uploadTitle)
    formData.append('content', uploadDesc)
    formData.append('source_lang', 'ko') // Default to Korean for now

    try {
      const res = await fetch('/api/shortforms/', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')

      // Reset and reload
      setShowUpload(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDesc('')
      alert('Upload Successful!')
      // Trigger reload (simple toggle)
      setLanguage(prev => prev === 'English' ? 'English ' : 'English') // Hack to re-trigger useEffect or extract fetch function
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const baseTexts = useMemo(
    () => ({
      navLogin: 'Log In',
      navSignup: 'Sign Up',
      navStart: 'Start Planning',
      heroBadge: 'Discover Korea, Your Way',
      heroTitle1: 'Hidden local gems to iconic landmarks.',
      heroTitle2: 'Let AI craft your perfect itinerary.',
      heroSub: 'AI builds the best route for you. Start now or create your own.',
      ctaAI: 'Generate with AI',
      ctaSelf: 'Build It Yourself',
      shortsTitle: 'Shorts',
      shortsSub: 'Watch the latest uploads with AI captions/translation.',
      play: 'Play',
      upload: 'Upload', // New
      durationMissing: '00:00',
      langLabel: 'Lang',
      nowPlaying: 'Now Playing',
      close: 'Close',
      popularTitle: 'Popular Destinations',
      viewAll: 'View All',
      loading: 'Loading...',
    }),
    []
  )

  // UI 텍스트만 번역 (FastAPI/Django 캐시 활용)
  useEffect(() => {
    const target = langToCode[language]
    if (!target || target === 'eng_Latn') {
      setUiTranslations({})
      return
    }

    const translateUiBatch = async () => {
      // 1. Prepare items
      const uiMap = {}
      const itemsToTranslate = []

      // UI Texts: Check glossary first
      Object.entries(baseTexts).forEach(([k, v]) => {
        const glossaryValue = uiGlossary[k]?.[target]
        if (glossaryValue) {
          // Use glossary
          uiMap[k] = glossaryValue
        } else {
          // Queue for AI translation
          itemsToTranslate.push({
            key: k,
            text: v,
            type: 'ui',
            id: 0,
            field: k
          })
        }
      })

      // Destinations: Always dynamic, so queue them
      const destItems = initialDestinations.flatMap(d => [
        { key: `dest_${d.id}_name`, text: d.name, type: 'destination', id: d.id, field: 'name' },
        { key: `dest_${d.id}_desc`, text: d.desc, type: 'destination', id: d.id, field: 'desc' }
      ])

      const allItemsToRequest = [...itemsToTranslate, ...destItems]

      if (allItemsToRequest.length === 0) {
        setUiTranslations(uiMap)
        return
      }

      try {
        const resp = await fetch('/api/translations/batch/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: allItemsToRequest.map(i => ({
              text: i.text,
              entity_type: i.type,
              entity_id: i.id,
              field: i.field
            })),
            source_lang: 'eng_Latn',
            target_lang: target,
          }),
        })

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        const translations = data.translations || []

        // 2. Map results back
        // UI Texts (from AI)
        itemsToTranslate.forEach((item, idx) => {
          uiMap[item.key] = translations[idx] || item.text
        })
        setUiTranslations(uiMap)

        // Destinations
        const destStartIndex = itemsToTranslate.length
        const newDests = initialDestinations.map(d => ({ ...d }))

        let currentIdx = destStartIndex
        initialDestinations.forEach((d, i) => {
          newDests[i].name = translations[currentIdx] || d.name
          newDests[i].desc = translations[currentIdx + 1] || d.desc
          currentIdx += 2
        })

        setDestinations(newDests)

      } catch (e) {
        console.error("Batch translation failed", e)
      }
    }

    translateUiBatch()
  }, [language, baseTexts])

  const t = useMemo(() => ({ ...baseTexts, ...uiTranslations }), [baseTexts, uiTranslations])

  // 숏폼 데이터를 서버에서 번역 포함으로 가져오기
  useEffect(() => {
    const fetchShortforms = async () => {
      try {
        setLoading(true)
        setError('')
        const target = langToCode[language] || 'eng_Latn'
        const res = await fetch(`/api/shortforms/?lang=${target}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const mapped = (data || []).map((item) => ({
          title: item.title_translated || item.title || 'Untitled',
          desc: item.content_translated || item.content || '',
          thumb: item.thumbnail_url,
          video: item.video_url,
          duration:
            typeof item.duration === 'number'
              ? `${String(Math.floor(item.duration / 60)).padStart(2, '0')}:${String(item.duration % 60).padStart(2, '0')}`
              : '',
          lang: item.source_lang || 'N/A',
        }))
        setShortforms(mapped.length ? mapped : sampleShorts)
      } catch (e) {
        setError('숏폼을 불러오지 못했습니다. (샘플 데이터를 표시합니다)')
        setShortforms(sampleShorts)
      } finally {
        setLoading(false)
      }
    }
    fetchShortforms()
  }, [language])

  return (
    <div className="tfai">
      <div className="tfai-subnav">
        <div className="tfai-subnav-left">
          <div className="tfai-logo">
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
          <a href="#">{t.navLogin}</a>
          <a href="#">{t.navSignup}</a>
          <button className="tfai-cta">{t.navStart}</button>
        </div>
      </div>

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

      <section className="tfai-section">
        <div className="tfai-section-heading tfai-section-heading-row">
          <div>
            <h2>{t.shortsTitle}</h2>
            <p>{t.shortsSub}</p>
          </div>
          <button className="tfai-cta" onClick={() => setShowUpload(true)} style={{ fontSize: '14px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'bottom', marginRight: '4px' }}>upload</span>
            {t.upload}
          </button>
        </div>
        <div className="tfai-feature-grid">
          {shortforms.map((s, idx) => (
            <div className="tfai-feature-card shortform" key={`${s.title}-${idx}`}>
              <div className="shortform-thumb" style={{ backgroundImage: `url(${s.thumb})` }}>
                <span className="badge">{s.duration || t.durationMissing}</span>
              </div>
              <div className="shortform-body">
                <p className="shortform-lang">
                  {t.langLabel}: {s.lang || 'N/A'}
                </p>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
              <div className="shortform-actions">
                <button className="ghost" onClick={() => setSelectedVideo(s.video || s.thumb)}>
                  <span className="material-symbols-outlined">play_arrow</span>
                  {t.play}
                </button>
              </div>
            </div>
          ))}
          {error && <p className="tfai-error">{error}</p>}
          {loading && <p className="tfai-loading">{t.loading}</p>}
        </div>
      </section>

      {selectedVideo && (
        <section className="tfai-section">
          <div className="tfai-section-heading tfai-section-heading-row">
            <h2>{t.nowPlaying}</h2>
            <button className="tfai-close" onClick={() => setSelectedVideo(null)}>
              {t.close}
            </button>
          </div>
          <div className="tfai-player">
            <video controls autoPlay poster={shortforms.find((s) => (s.video || s.thumb) === selectedVideo)?.thumb || undefined}>
              <source src={selectedVideo} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </section>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="tfai-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div className="tfai-modal">
            <h2>Upload a Short</h2>
            <form onSubmit={handleUpload}>
              <div className="tfai-form-group">
                <label className="tfai-label">Video File</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={e => setUploadFile(e.target.files[0])}
                    className="tfai-file-input"
                    style={{ width: '100%' }}
                    required
                  />
                  {uploadFile && <p style={{ marginTop: '8px', fontSize: '13px', color: '#13a4ec' }}>{uploadFile.name}</p>}
                </div>
              </div>

              <div className="tfai-form-group">
                <label className="tfai-label">Title</label>
                <input
                  className="tfai-input"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Enter title..."
                  required
                />
              </div>

              <div className="tfai-form-group">
                <label className="tfai-label">Description</label>
                <textarea
                  className="tfai-textarea"
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="What is this video about?"
                />
              </div>

              <div className="tfai-modal-actions">
                <button type="button" className="tfai-btn-cancel" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="tfai-btn-submit" disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="tfai-section">
        <div className="tfai-section-heading tfai-section-heading-row">
          <h2>{t.popularTitle}</h2>
          <a href="#" className="tfai-link">
            {t.viewAll}
          </a>
        </div>
        <div className="tfai-destinations">
          {destinations.map((d) => (
            <div key={d.name} className="tfai-dest-card">
              <div className="image" style={{ backgroundImage: `url(${d.image})` }} aria-label={d.name} />
              <div>
                <p className="name">{d.name}</p>
                <p className="desc">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default TestFrontAI
