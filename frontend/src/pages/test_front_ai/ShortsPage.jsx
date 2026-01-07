import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TestFrontAI.css'



const langToCode = {
    English: 'eng_Latn',
    한국어: 'kor_Hang',
    日本語: 'jpn_Jpan',
    中文: 'zho_Hans',
}

const uiGlossary = {
    play: { kor_Hang: '재생', jpn_Jpan: '再生', zho_Hans: '播放' },
    upload: { kor_Hang: '업로드', jpn_Jpan: 'アップロード', zho_Hans: '上传' },
    shortsTitle: { kor_Hang: '쇼츠', jpn_Jpan: 'ショート', zho_Hans: '短视频' },
    shortsSub: {
        kor_Hang: '최신 업로드를 AI 캡션/번역으로 보세요.',
        jpn_Jpan: '最新アップロードをAI字幕/翻訳で見ましょう。',
        zho_Hans: '查看带AI字幕/翻译的最新上传。',
    },
    nowPlaying: { kor_Hang: '재생 중', jpn_Jpan: '再生中', zho_Hans: '正在播放' },
    langLabel: { kor_Hang: '언어', jpn_Jpan: '言語', zho_Hans: '语言' },
    noShorts: {
        kor_Hang: '준비된 쇼츠가 없습니다.',
        jpn_Jpan: '準備されたショート動画がありません。',
        zho_Hans: '没有准备好的短视频。',
    },
}

function ShortsPage({ onShortClick, embed = false, language: propLanguage }) {
    const navigate = useNavigate()
    const [language, setLanguage] = useState(propLanguage || 'English')
    const [shortforms, setShortforms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showUpload, setShowUpload] = useState(false)
    const [uploadFile, setUploadFile] = useState(null)
    const [uploadTitle, setUploadTitle] = useState('')
    const [uploadDesc, setUploadDesc] = useState('')
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        if (propLanguage) {
            setLanguage(propLanguage)
        }
    }, [propLanguage])

    const baseTexts = useMemo(
        () => ({
            shortsTitle: 'Shorts',
            shortsSub: 'Watch the latest uploads with AI captions/translation.',
            play: 'Play',
            upload: 'Upload',
            durationMissing: '00:00',
            langLabel: 'Lang',
            nowPlaying: 'Now Playing',
            loading: 'Loading...',
            noShorts: 'No shorts available.',
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

    useEffect(() => {
        const fetchShortforms = async () => {
            try {
                setLoading(true)
                setError('')
                const res = await fetch(`/api/shortforms/?lang=${langCode}`)
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`)
                }
                const data = await res.json()
                const listData = Array.isArray(data) ? data : data.results || []
                const mapped = listData.map((item) => ({
                    id: item.id,
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
                setShortforms(mapped)
            } catch (err) {
                setError('Failed to load shorts. Please check the server/connection.')
                setShortforms([])
            } finally {
                setLoading(false)
            }
        }
        fetchShortforms()
    }, [langCode])

    const handleUpload = async (event) => {
        event.preventDefault()
        if (!uploadFile) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append('video_file', uploadFile)
        formData.append('title', uploadTitle)
        formData.append('content', uploadDesc)
        formData.append('source_lang', 'kor_Hang')

        try {
            const res = await fetch('/api/shortforms/', {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) throw new Error('Upload failed')

            setShowUpload(false)
            setUploadFile(null)
            setUploadTitle('')
            setUploadDesc('')
        } catch (err) {
            setError(`Upload failed: ${err.message}`)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div
            className="tfai"
            style={embed ? { paddingBottom: '40px' } : { paddingTop: '80px', minHeight: '100vh', paddingBottom: '40px' }}
        >
            <section className="tfai-section">
                {!embed && (
                    <div className="tfai-section-heading tfai-section-heading-row">
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
                )}
                <div className="tfai-section-heading tfai-section-heading-row">
                    <div>
                        <h2>{t.shortsTitle}</h2>
                        <p>{t.shortsSub}</p>
                    </div>
                    <button className="tfai-cta" onClick={() => setShowUpload(true)} style={{ fontSize: '14px' }}>
                        <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '18px', verticalAlign: 'bottom', marginRight: '4px' }}
                        >
                            upload
                        </span>
                        {t.upload}
                    </button>
                </div>
                <div className="tfai-feature-grid">
                    {!loading && !error && shortforms.length === 0 && (
                        <div className="tfai-no-shorts" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '10px' }}>videocam_off</span>
                            <p>{t.noShorts}</p>
                        </div>
                    )}
                    {shortforms.map((s, idx) => (
                        <div
                            className="tfai-feature-card shortform"
                            key={`${s.title}-${idx}`}
                            onClick={() => {
                                if (!s.id) return
                                if (onShortClick) {
                                    onShortClick(s.id)
                                } else {
                                    navigate(`/shorts/${s.id}`)
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
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
                                <button className="ghost" type="button">
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

            {showUpload && (
                <div className="tfai-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUpload(false)}>
                    <div className="tfai-modal">
                        <h2>Upload a Short</h2>
                        <form onSubmit={handleUpload}>
                            <div className="tfai-form-group">
                                <label className="tfai-label">Video File</label>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => setUploadFile(e.target.files[0])}
                                    className="tfai-file-input"
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>

                            <div className="tfai-form-group">
                                <label className="tfai-label">Title</label>
                                <input
                                    className="tfai-input"
                                    value={uploadTitle}
                                    onChange={(e) => setUploadTitle(e.target.value)}
                                    placeholder="Enter title..."
                                    required
                                />
                            </div>

                            <div className="tfai-form-group">
                                <label className="tfai-label">Description</label>
                                <textarea
                                    className="tfai-textarea"
                                    value={uploadDesc}
                                    onChange={(e) => setUploadDesc(e.target.value)}
                                    placeholder="What is this video about?"
                                />
                            </div>

                            <div className="tfai-modal-actions">
                                <button type="button" className="tfai-btn-cancel" onClick={() => setShowUpload(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="tfai-btn-submit" disabled={isUploading}>
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ShortsPage
