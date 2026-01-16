import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
// import Navbar from '../../components/Navbar'
import './shortspage.css'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import axiosInstance from '../../api/axios'

// Language & Glossary Data
const langToCode = {
    English: 'eng_Latn',
    한국어: 'kor_Hang',
    日本語: 'jpn_Jpan',
    中文: 'zho_Hans',
}



function ShortsPage({ onShortClick, embed = false }) {
    const navigate = useNavigate()
    const { language, t } = useLanguage()
    const { isAuthenticated } = useAuth()

    const [shortforms, setShortforms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [useBatch, setUseBatch] = useState(true)

    const langCode = langToCode[language] || 'eng_Latn'





    // Data Fetching
    const fetchShortforms = useCallback(async () => {
        try {
            setLoading(true)
            setError('')

            // Use axiosInstance for GET request (Automatic token attachment + 401 handling)
            const res = await axiosInstance.get(`/shortforms/`, {
                params: {
                    lang: langCode,
                    batch: useBatch
                }
            })

            const data = res.data
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
        } catch (err) {
            console.error(err)
            setError('Failed to load shorts. Please check the server/connection.')
            setShortforms([])
        } finally {
            setLoading(false)
        }
    }, [langCode, useBatch])

    useEffect(() => {
        fetchShortforms()
    }, [fetchShortforms])



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
                            <h1 className="text-3xl font-bold mb-2">{t('shorts_title')}</h1>
                            <p className="text-muted">{t('shorts_sub')}</p>
                        </div>

                        {isAuthenticated && (
                            <button className="btn-primary" onClick={() => navigate('/shorts/upload')}>
                                <span className="material-symbols-outlined mr-2">upload</span>
                                {t('btn_upload')}
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
                            {t('btn_batch')}
                        </label>
                    </div>
                </div>

                {/* Grid Content */}
                <div className="shorts-grid">
                    {loading && (
                        <div className="state-message">
                            <span className="state-icon material-symbols-outlined spin">sync</span>
                            <p>{t('loading')}</p>
                        </div>
                    )}

                    {!loading && !error && shortforms.length === 0 && (
                        <div className="state-message">
                            <span className="state-icon material-symbols-outlined">videocam_off</span>
                            <p>{t('no_shorts')}</p>
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
                            <div className="shorts-thumb">
                                <img
                                    src={s.thumb}
                                    alt={s.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://placehold.co/600x400?text=No+Thumbnail';
                                    }}
                                />
                                <span className="duration-badge">{s.duration || t('duration_missing')}</span>
                            </div>
                            <div className="shorts-body">
                                <span className="shorts-lang-tag">{s.lang}</span>
                                <h3 className="shorts-title">{s.title}</h3>
                                <p className="shorts-desc">{s.desc}</p>
                            </div>

                            <div className="shorts-actions">
                                <button className="btn-ghost">
                                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                                    {t('play')}
                                </button>
                            </div>
                        </div>
                    ))}

                    {error && <p className="text-red-500 text-center col-span-full">{error}</p>}
                </div>
            </main>


        </div>
    )
}

export default ShortsPage
