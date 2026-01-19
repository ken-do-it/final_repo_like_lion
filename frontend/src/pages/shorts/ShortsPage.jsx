import { useEffect, useState, useCallback, useRef } from 'react'
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
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const observer = useRef()

    const langCode = langToCode[language] || 'eng_Latn'

    // Intersection Observer callback
    const lastShortElementRef = useCallback(node => {
        if (loading) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1)
            }
        })
        if (node) observer.current.observe(node)
    }, [loading, hasMore])

    // Data Fetching
    const fetchShortforms = useCallback(async (pageNum) => {
        try {
            setLoading(true)
            setError('')

            const res = await axiosInstance.get(`/shortforms/`, {
                params: {
                    lang: langCode,
                    batch: useBatch,
                    page: pageNum
                }
            })

            const data = res.data
            // DRF PageNumberPagination response structure: { count, next, previous, results }
            // If pagination is not enabled, it might return array directly. Check structure.
            let listData = []
            let nextLink = null

            if (Array.isArray(data)) {
                listData = data
                setHasMore(false) // No pagination metadata, assume all loaded or try to implement offset check?
                // If backend forces pagination, it won't be array.
            } else {
                listData = data.results || []
                nextLink = data.next
                setHasMore(!!nextLink)
            }

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

            setShortforms(prev => pageNum === 1 ? mapped : [...prev, ...mapped])
        } catch (err) {
            console.error(err)
            // 404 means page out of range usually
            if (err.response && err.response.status === 404) {
                setHasMore(false)
                return
            }
            setError('Failed to load shorts.')
        } finally {
            setLoading(false)
        }
    }, [langCode, useBatch])

    useEffect(() => {
        // Reset list when language changes
        setShortforms([])
        setPage(1)
        setHasMore(true)
    }, [langCode, useBatch])

    useEffect(() => {
        fetchShortforms(page)
    }, [fetchShortforms, page])


    return (
        <div className={`shorts-page ${embed ? 'embed-view' : 'page-view'}`}>
            {/* ... header ... */}
            {/* Show Navbar only if not embedded (Standalone Page) */}
            {/* {!embed && <Navbar toggleSidebar={() => { }} />} */}

            <main className={`${embed ? 'w-full' : 'container mx-auto px-4 max-w-screen-xl'} ${!embed ? 'py-8' : ''}`}>

                {/* Header Section */}
                <div className="shorts-header">
                    <div className="shorts-header-row items-center">
                        <div className="text-center flex-1">
                            <h1 className="text-3xl font-bold mb-2">{t('shorts_title')}</h1>
                            <p className="text-muted">{t('shorts_sub')}</p>
                        </div>

                        {isAuthenticated && (
                            <button className="btn-primary ml-4" onClick={() => navigate('/shorts/upload')}>
                                <span className="material-symbols-outlined mr-2">upload</span>
                                {t('btn_upload')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid Content */}
                <div className="shorts-grid">
                    {!loading && !error && shortforms.length === 0 && (
                        <div className="state-message">
                            <span className="state-icon material-symbols-outlined">videocam_off</span>
                            <p>{t('no_shorts')}</p>
                        </div>
                    )}

                    {shortforms.map((s, idx) => {
                        if (shortforms.length === idx + 1) {
                            return (
                                <div ref={lastShortElementRef} className="card shorts-card" key={`${s.title}-${idx}-${s.id}`} onClick={() => onShortClick ? onShortClick(s.id) : navigate(`/shorts/${s.id}`)}>
                                    <div className="shorts-thumb">
                                        <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400?text=No+Thumbnail'; }} />
                                        <span className="duration-badge">{s.duration || t('duration_missing')}</span>
                                    </div>
                                    <div className="shorts-body">
                                        <span className="shorts-lang-tag">{s.lang}</span>
                                        <h3 className="shorts-title">{s.title}</h3>
                                        <p className="shorts-desc">{s.desc}</p>
                                        <div className="flex items-center text-xs text-rose-500 mt-2 font-medium">
                                            <span className="mr-1 align-middle">📍</span>
                                            {s.location_translated || s.location || 'Korea'}
                                        </div>
                                    </div>
                                </div>
                            )
                        } else {
                            return (
                                <div className="card shorts-card" key={`${s.title}-${idx}-${s.id}`} onClick={() => onShortClick ? onShortClick(s.id) : navigate(`/shorts/${s.id}`)}>
                                    <div className="shorts-thumb">
                                        <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400?text=No+Thumbnail'; }} />
                                        <span className="duration-badge">{s.duration || t('duration_missing')}</span>
                                    </div>
                                    <div className="shorts-body">
                                        <span className="shorts-lang-tag">{s.lang}</span>
                                        <h3 className="shorts-title">{s.title}</h3>
                                        <p className="shorts-desc">{s.desc}</p>
                                        <div className="flex items-center text-xs text-rose-500 mt-2 font-medium">
                                            <span className="mr-1 align-middle">📍</span>
                                            {s.location_translated || s.location || 'Korea'}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    })}

                    {loading && (
                        <div className="state-message col-span-full">
                            <span className="state-icon material-symbols-outlined spin">sync</span>
                            <p>{t('loading')}</p>
                        </div>
                    )}

                    {error && <p className="text-red-500 text-center col-span-full">{error}</p>}
                </div>
            </main>
        </div>
    )
}

export default ShortsPage
