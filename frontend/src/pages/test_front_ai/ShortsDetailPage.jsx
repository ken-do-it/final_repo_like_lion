import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './TestFrontAI.css'

const langToCode = {
  English: 'eng_Latn',
  한국어: 'kor_Hang',
  日本語: 'jpn_Jpan',
  中文: 'zho_Hans',
}

const uiGlossary = {
  home: { kor_Hang: '홈', jpn_Jpan: 'ホーム', zho_Hans: '首页' },
  shorts: { kor_Hang: '쇼츠', jpn_Jpan: 'ショート', zho_Hans: '短视频' },
  close: { kor_Hang: '닫기', jpn_Jpan: '閉じる', zho_Hans: '关闭' },
  follow: { kor_Hang: '팔로우', jpn_Jpan: 'フォロー', zho_Hans: '关注' },
  share: { kor_Hang: '공유', jpn_Jpan: '共有', zho_Hans: '分享' },
  save: { kor_Hang: '저장', jpn_Jpan: '保存', zho_Hans: '收藏' },
  aiInsight: { kor_Hang: 'AI 인사이트', jpn_Jpan: 'AIインサイト', zho_Hans: 'AI洞察' },
  wantToVisit: { kor_Hang: '여기 가고 싶나요?', jpn_Jpan: 'ここに行きたいですか？', zho_Hans: '想去这里吗？' },
  aiSuggest: {
    kor_Hang: 'AI가 오후 7:30 방문을 추천합니다.',
    jpn_Jpan: 'AIは19:30の訪問をおすすめします。',
    zho_Hans: 'AI建议在19:30前往。',
  },
  addToTrip: { kor_Hang: '여행에 추가', jpn_Jpan: '旅程に追加', zho_Hans: '加入行程' },
  comments: { kor_Hang: '댓글', jpn_Jpan: 'コメント', zho_Hans: '评论' },
  addComment: { kor_Hang: '댓글을 입력하세요...', jpn_Jpan: 'コメントを入力...', zho_Hans: '输入评论...' },
  moreLikeThis: { kor_Hang: '이런 영상 더보기', jpn_Jpan: '似た動画', zho_Hans: '更多类似内容' },
  recVideo: { kor_Hang: '추천 영상', jpn_Jpan: 'おすすめ動画', zho_Hans: '推荐视频' },
  loading: { kor_Hang: '로딩 중...', jpn_Jpan: '読み込み中...', zho_Hans: '加载中...' },
}

const baseTexts = {
  home: 'Home',
  shorts: 'Shorts',
  close: 'Close',
  follow: 'Follow',
  share: 'Share',
  save: 'Save',
  aiInsight: 'AI Insight',
  wantToVisit: 'Want to visit here?',
  aiSuggest: 'AI suggests visiting at 7:30 PM.',
  addToTrip: 'Add to Trip',
  comments: 'Comments',
  addComment: 'Add a comment...',
  moreLikeThis: 'More like this',
  recVideo: 'Recommended Video',
  loading: 'Loading...',
}

const mockDataMap = {
  eng_Latn: {
    creator: {
      name: 'SeoulExplorer',
      location: 'Banpo Bridge, Seoul',
      time: '2 hours ago',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    comments: [
      { user: 'Jessica M.', time: '20 min ago', text: 'Is it crowded on weekends? Looking to go this Saturday!' },
      { user: 'David Chen', time: '1 hour ago', text: 'Best way to get there is from Express Bus Terminal exit 8-1.' },
    ],
    hashtags: '#SeoulNight #HanRiver #BanpoBridge',
  },
  kor_Hang: {
    creator: {
      name: '서울탐험가',
      location: '반포대교, 서울',
      time: '2시간 전',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDIgUeQYhKi6UCCncqvYgC-Slh3Xh8U0ImxRSNAbQX0dHta7JcEFY-vnqUzP4m7i5lNVOhUNTH0xC8zwVAgrZXf7tWBw5iea7J2PFmEy0zOBvi8LLTrsmFWHRl-DX_BQadAJRVnjKB8Hl-FBjW-VrX0IJHL8XGsNPBPM6jKJobtWQPtck8AsgPfwsFWntNpDSqCUBd7OkJC_BlnMOOyu6uSshCdTjz8544LUktInWoQkxtMBXXn06XAT9FVebr3ot2L2zISL2Un4HKO',
    },
    comments: [
      { user: '지민', time: '20분 전', text: '주말에 많이 붐비나요? 이번 토요일에 가려고 해요!' },
      { user: '민수', time: '1시간 전', text: '고속터미널 8-1번 출구에서 가는 게 가장 편해요.' },
    ],
    hashtags: '#서울야경 #한강 #반포대교',
  },
}

function ShortsDetailPage({ videoId: propVideoId, onBack, language: propLanguage }) {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const id = propVideoId || paramId
  const language = propLanguage || 'English'

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
  }, [langCode])

  const mockData = useMemo(() => mockDataMap[langCode] || mockDataMap.eng_Latn, [langCode])

  const [shortform, setShortform] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`/api/shortforms/${id}/?lang=${langCode}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error('Shortform not found')
          throw new Error('Failed to load shortform')
        }
        const item = await res.json()
        setShortform({
          id: item.id,
          title: item.title_translated || item.title || 'Untitled',
          desc: item.content_translated || item.content || '',
          thumb: item.thumbnail_url,
          video: item.video_url,
          lang: item.source_lang || 'N/A',
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDetail()
    }
  }, [id, langCode])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate('/shorts')
    }
  }

  if (loading) {
    return (
      <div className="tfai-detail-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {t.loading}
      </div>
    )
  }
  if (error) {
    return (
      <div className="tfai-detail-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#c2410c' }}>
        Error: {error}
      </div>
    )
  }
  if (!shortform) return null

  return (
    <div className="tfai-detail-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '14px', color: '#64748b' }}>
          {t.home} / {t.shorts} /
        </span>
        <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{shortform.title}</span>
        <button onClick={handleBack} className="tfai-close" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>
          {t.close}
        </button>
      </div>

      <div className="tfai-detail-content">
        <div className="tfai-player-wrapper">
          <video controls autoPlay poster={shortform.thumb}>
            <source src={shortform.video} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="tfai-detail-sidebar">
          <div className="tfai-creator-card">
            <img src={mockData.creator.avatar} alt="Creator" className="tfai-creator-avatar" />
            <div className="tfai-creator-info">
              <h3>{mockData.creator.name}</h3>
              <p>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>
                  location_on
                </span>
                {mockData.creator.location} · {mockData.creator.time}
              </p>
            </div>
            <button className="tfai-follow-btn">{t.follow}</button>
          </div>

          <div className="tfai-video-meta">
            {shortform.desc}
            <div className="tfai-hashtags">{mockData.hashtags}</div>
          </div>

          <div className="tfai-stats-row">
            <div className="tfai-stat-item">
              <span className="material-symbols-outlined tfai-stat-icon">favorite</span> 1.2k
            </div>
            <div className="tfai-stat-item">
              <span className="material-symbols-outlined tfai-stat-icon">chat_bubble</span> 45
            </div>
            <div className="tfai-stat-item">
              <span className="material-symbols-outlined tfai-stat-icon">share</span> {t.share}
            </div>
            <div className="tfai-stat-item">
              <span className="material-symbols-outlined tfai-stat-icon">bookmark</span> {t.save}
            </div>
          </div>

          <div className="tfai-ai-card">
            <div className="tfai-ai-header">
              <span className="material-symbols-outlined">auto_awesome</span>
              {t.aiInsight}
            </div>
            <div className="tfai-ai-title">{t.wantToVisit}</div>
            <div className="tfai-ai-desc">{t.aiSuggest}</div>
            <button className="tfai-ai-btn">
              {t.addToTrip} <span className="material-symbols-outlined">add_circle</span>
            </button>
          </div>

          <div>
            <div className="tfai-comments-header">
              {t.comments} ({mockData.comments.length})
            </div>
            {mockData.comments.map((comment, idx) => (
              <div className="tfai-comment-item" key={idx}>
                <div className="tfai-comment-avatar"></div>
                <div className="tfai-comment-content">
                  <div>
                    <span className="tfai-comment-user">{comment.user}</span>{' '}
                    <span className="tfai-comment-time">{comment.time}</span>
                  </div>
                  <div className="tfai-comment-text">{comment.text}</div>
                </div>
              </div>
            ))}

            <div className="tfai-comment-input-area">
              <input type="text" className="tfai-comment-input" placeholder={t.addComment} />
              <button className="tfai-comment-send">
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="tfai-more-section">
        <div className="tfai-more-title">{t.moreLikeThis}</div>
        <div className="tfai-more-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="tfai-more-card"
              style={{ backgroundImage: `url(https://source.unsplash.com/random/200x300?korea,travel&sig=${i})` }}
            >
              <div className="tfai-more-overlay">
                <div className="tfai-more-title-text">
                  {t.recVideo} {i}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShortsDetailPage
