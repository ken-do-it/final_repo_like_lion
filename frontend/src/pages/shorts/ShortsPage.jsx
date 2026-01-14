import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import './shortspage.css'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

// Language & Glossary Data
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
    loading: { kor_Hang: '로딩 중...', jpn_Jpan: '読み込み中...', zho_Hans: '加载中...' },
    noShorts: {
        kor_Hang: '불러올 쇼츠가 없습니다. 로그인해서 업로드 해보세요.',
        jpn_Jpan: '動画がありません。ログインしてアップロードしてください。',
        zho_Hans: '没有视频。请登录并上传。',
    },
    batchLabel: { kor_Hang: '배치 최적화', jpn_Jpan: 'バッチ最適化', zho_Hans: '批量优化' },
}

function ShortsPage({ onShortClick, embed = false }) {
    const navigate = useNavigate()
    const { language } = useLanguage()
    const { isAuthenticated } = useAuth()

    const [shortforms, setShortforms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showUpload, setShowUpload] = useState(false)

    // Upload Form State
    const [uploadFile, setUploadFile] = useState(null)
    const [uploadTitle, setUploadTitle] = useState('')
    const [uploadDesc, setUploadDesc] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [useBatch, setUseBatch] = useState(true)

    // Translations
    const baseTexts = useMemo(() => ({
        shortsTitle: 'Shorts',
        shortsSub: 'Watch the latest uploads with AI captions/translation.',
        play: 'Play',
        upload: 'Upload',
        durationMissing: '00:00',
        langLabel: 'Lang',
        nowPlaying: 'Now Playing',
        loading: 'Loading...',
        noShorts: 'No shorts available. Log in to upload.',
        batchLabel: 'Batch Optimization'
    }), [])

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

    // Data Fetching
    const fetchShortforms = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const res = await fetch(`/api/shortforms/?lang=${langCode}&batch=${useBatch}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const data = await res.json()
            const listData = Array.isArray(data) ? data : data.results || []

            const mapped = listData.map((item) => ({
                id: item.id,
                title: item.title_translated || item.title || 'Untitled',
                desc: item.content_translated || item.content || '',
                thumb: item.thumbnail_url,
                video: item.video_url,
                duration: typeof item.duration === 'number'
                    ? `${String(Math.floor(item.duration / 60)).padStart(2, '0')}:${String(item.duration % 60).padStart(2, '0')}`
                    : '',
                lang: item.source_lang || 'N/A',
            }))
            setShortforms(mapped)
        } catch {
            setError('Failed to load shorts. Please check the server/connection.')
            setShortforms([])
        } finally {
            setLoading(false)
        }
    }, [langCode, useBatch])

    useEffect(() => {
        fetchShortforms()
    }, [fetchShortforms])

    // Upload Logic
    const handleUpload = async (event) => {
        event.preventDefault()
        if (!uploadFile) return

        if (!isAuthenticated) {
            alert("Login required for uploading!")
            return
        }

        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            alert("Auth error. Please login again.")
            return
        }

        setIsUploading(true)
        const formData = new FormData()
        formData.append('video_file', uploadFile)
        formData.append('title', uploadTitle)
        formData.append('content', uploadDesc)

        try {
            const res = await fetch('/api/shortforms/', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: formData,
            })
            if (!res.ok) throw new Error('Upload failed')

            setShowUpload(false)
            setUploadFile(null)
            setUploadTitle('')
            setUploadDesc('')
            fetchShortforms()
        } catch (err) {
            alert(`Upload failed: ${err.message}`)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className={`shorts-page ${embed ? 'embed-view' : 'page-view'}`}>
            {/* Show Navbar only if not embedded (Standalone Page) */}
            {/* Navbar Removed - Handled by Global Layout (App.jsx) */}
            {/* {!embed && <Navbar toggleSidebar={() => { }} />} */}

            <main className={`${embed ? 'w-full' : 'container mx-auto px-4 max-w-screen-xl'} ${!embed ? 'py-8' : ''}`}>

                {/* Header Section */}
                <div className="shorts-header">
                    <div className="shorts-header-row">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{t.shortsTitle}</h1>
                            <p className="text-muted">{t.shortsSub}</p>
                        </div>

                        {isAuthenticated && (
                            <button className="btn-primary" onClick={() => setShowUpload(true)}>
                                <span className="material-symbols-outlined mr-2">upload</span>
                                {t.upload}
                            </button>
                        )}
                    </div>

                    {/* Filters & Controls */}
                    <div className="filter-bar">
                        {/* Language Selector Removed - Moved to Navbar */}

                        <label className="toggle-label ml-auto">
                            <input
                                type="checkbox"
                                checked={useBatch}
                                onChange={(e) => setUseBatch(e.target.checked)}
                                className="accent-blue-500"
                            />
                            {t.batchLabel}
                        </label>
                    </div>
                </div>

                {/* Grid Content */}
                <div className="shorts-grid">
                    {loading && (
                        <div className="state-message">
                            <span className="state-icon material-symbols-outlined spin">sync</span>
                            <p>{t.loading}</p>
                        </div>
                    )}

                    {!loading && !error && shortforms.length === 0 && (
                        <div className="state-message">
                            <span className="state-icon material-symbols-outlined">videocam_off</span>
                            <p>{t.noShorts}</p>
                        </div>
                    )}

                    {shortforms.map((s, idx) => (
                        <div
                            className="card shorts-card"
                            key={`${s.title}-${idx}`}
                            onClick={() => {
                                if (!s.id) return
                                if (onShortClick) {
                                    onShortClick(s.id)
                                } else {
                                    navigate(`/shorts/${s.id}`)
                                }
                            }}
                        >
                            <div className="shorts-thumb" style={{ backgroundImage: `url(${s.thumb})` }}>
                                <span className="duration-badge">{s.duration || t.durationMissing}</span>
                            </div>
                            <div className="shorts-body">
                                <span className="shorts-lang-tag">{s.lang}</span>
                                <h3 className="shorts-title">{s.title}</h3>
                                <p className="shorts-desc">{s.desc}</p>
                            </div>

                            <div className="shorts-actions">
                                <button className="btn-ghost">
                                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                                    {t.play}
                                </button>
                            </div>
                        </div>
                    ))}

                    {error && <p className="text-red-500 text-center col-span-full">{error}</p>}
                </div>
            </main>

            {/* Upload Modal */}
            {showUpload && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUpload(false)}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Upload Short</h2>
                        </div>
                        <form onSubmit={handleUpload} className="flex flex-col gap-6">
                            <div className="form-group">
                                <label className="form-label">Video File</label>
                                <div className="file-dropzone relative">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        required
                                    />
                                    <span className="material-symbols-outlined text-4xl mb-2">cloud_upload</span>
                                    <p>{uploadFile ? uploadFile.name : "Click or Drag video here"}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input
                                    className="form-input"
                                    value={uploadTitle}
                                    onChange={(e) => setUploadTitle(e.target.value)}
                                    placeholder="Enter title..."
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    value={uploadDesc}
                                    onChange={(e) => setUploadDesc(e.target.value)}
                                    placeholder="What is this video about?"
                                    rows="3"
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 font-bold"
                                    onClick={() => setShowUpload(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={isUploading}
                                >
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
