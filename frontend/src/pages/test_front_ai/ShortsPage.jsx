import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TestFrontAI.css'

const sampleShorts = [
    {
        id: 901,
        title: 'Seoul Night Highlights',
        desc: '3-minute recap: Hangang parks, Namsan Tower, and Gwangjang street food.',
        thumb: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=800&q=80',
        video: '',
        duration: '03:12',
        lang: 'ko',
    },
    {
        id: 902,
        title: 'Busan Gamcheon Vlog',
        desc: 'Local guide to view points and 5 cozy cafes you should not miss.',
        thumb: 'https://images.unsplash.com/photo-1587606600804-4921c7f01d9f?auto=format&fit=crop&w=800&q=80',
        video: '',
        duration: '02:41',
        lang: 'en',
    },
    {
        id: 903,
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

const uiGlossary = {
    play: { kor_Hang: '재생', jpn_Jpan: '再生', zho_Hans: '播放' },
    close: { kor_Hang: '닫기', jpn_Jpan: '閉じる', zho_Hans: '关闭' },
    loading: { kor_Hang: '로딩 중...', jpn_Jpan: '読み込み中...', zho_Hans: '载入中...' },
    langLabel: { kor_Hang: '언어', jpn_Jpan: '言語', zho_Hans: '语言' },
    upload: { kor_Hang: '업로드', jpn_Jpan: 'アップロード', zho_Hans: '上传' },
    shortsTitle: { kor_Hang: '숏폼', jpn_Jpan: 'ショート動画', zho_Hans: '短视频' },
    shortsSub: { kor_Hang: 'AI 자막/번역이 적용된 최신 영상을 시청하세요.', jpn_Jpan: 'AI字幕/翻訳付きの最新動画をご覧ください。', zho_Hans: '观看带有AI字幕/翻译的最新视频。' },
    nowPlaying: { kor_Hang: '재생 중', jpn_Jpan: '再生中', zho_Hans: '正在播放' },
    durationMissing: { kor_Hang: '00:00', jpn_Jpan: '00:00', zho_Hans: '00:00' },
}

function ShortsPage({ onShortClick, embed = false }) { // Accept embed prop
    const navigate = useNavigate()
    const [language, setLanguage] = useState('English')
    const [shortforms, setShortforms] = useState(sampleShorts)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
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
        formData.append('source_lang', 'ko')

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
            alert('Upload Successful!')
            setLanguage(prev => prev === 'English' ? 'English ' : 'English')
        } catch (err) {
            alert('Upload failed: ' + err.message)
        } finally {
            setIsUploading(false)
        }
    }

    const baseTexts = useMemo(
        () => ({
            shortsTitle: 'Shorts',
            shortsSub: 'Watch the latest uploads with AI captions/translation.',
            play: 'Play',
            upload: 'Upload',
            durationMissing: '00:00',
            langLabel: 'Lang',
            nowPlaying: 'Now Playing',
            close: 'Close',
            loading: 'Loading...',
        }),
        []
    )

    useEffect(() => {
        const target = langToCode[language]
        if (!target || target === 'eng_Latn') {
            setUiTranslations({})
            return
        }

        const uiMap = {}
        Object.entries(baseTexts).forEach(([k, v]) => {
            const glossaryValue = uiGlossary[k]?.[target]
            if (glossaryValue) {
                uiMap[k] = glossaryValue
            }
        })
        setUiTranslations(uiMap)

    }, [language, baseTexts])

    const t = useMemo(() => ({ ...baseTexts, ...uiTranslations }), [baseTexts, uiTranslations])

    useEffect(() => {
        const fetchShortforms = async () => {
            try {
                setLoading(true)
                setError('')
                const target = langToCode[language] || 'eng_Latn'
                const res = await fetch(`/api/shortforms/?lang=${target}`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                console.log('Shorts API Response:', data) // Debug Log
                const mapped = (data || []).map((item) => ({
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
                setShortforms(mapped.length ? mapped : sampleShorts)
            } catch (e) {
                console.error(e)
                setError('숏폼을 불러오지 못했습니다. (샘플 데이터를 표시합니다)')
                setShortforms(sampleShorts)
            } finally {
                setLoading(false)
            }
        }
        fetchShortforms()
    }, [language])

    return (
        <div className="tfai" style={embed ? { paddingBottom: '40px' } : { paddingTop: '80px', minHeight: '100vh', paddingBottom: '40px' }}>
            <section className="tfai-section">
                {!embed && ( // Hide lang selector if embedded
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
                                <button className="ghost" onClick={() => {
                                    console.log('Clicked video item:', s) // Debug Log
                                    if (!s.id) {
                                        alert("Error: Video ID is missing.")
                                        return
                                    }
                                    if (onShortClick) {
                                        onShortClick(s.id);
                                    } else {
                                        navigate(`/shorts/${s.id}`);
                                    }
                                }}>
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    {t.play}
                                </button>
                            </div>
                        </div>
                    ))}
                    {error && <p className="tfai-error" style={{ color: 'red' }}>{error}</p>}
                    {loading && <p className="tfai-loading">{t.loading}</p>}
                </div>
            </section>

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
        </div>
    )
}

export default ShortsPage
