import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './TestFrontAI.css'

const langToCode = {
    English: 'eng_Latn',
    한국어: 'kor_Hang',
    日本語: 'jpn_Jpan',
    中文: 'zho_Hans',
}

function ShortsDetailPage({ videoId: propVideoId, onBack }) {
    const { id: paramId } = useParams()
    const navigate = useNavigate()
    const id = propVideoId || paramId

    const [shortform, setShortform] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [language, setLanguage] = useState('English')

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                setLoading(true)
                setError('')
                const target = langToCode[language] || 'eng_Latn'
                const res = await fetch(`/api/shortforms/${id}/?lang=${target}`)

                if (!res.ok) {
                    if (res.status === 404) throw new Error('Shortform not found')
                    throw new Error('Failed to load shortform')
                }

                const item = await res.json()
                const mapped = {
                    id: item.id,
                    title: item.title_translated || item.title || 'Untitled',
                    desc: item.content_translated || item.content || '',
                    thumb: item.thumbnail_url,
                    video: item.video_url,
                    lang: item.source_lang || 'N/A',
                }
                setShortform(mapped)
            } catch (e) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }

        if (id) {
            fetchDetail()
        }
    }, [id, language])

    const handleBack = () => {
        if (onBack) {
            onBack()
        } else {
            navigate('/shorts')
        }
    }

    if (loading) return <div className="tfai" style={{ paddingTop: '100px', textAlign: 'center' }}>Loading...</div>
    if (error) return <div className="tfai" style={{ paddingTop: '100px', textAlign: 'center', color: 'red' }}>Error: {error}</div>
    if (!shortform) return null

    return (
        <div className="tfai" style={{ paddingTop: '80px', minHeight: '100vh', paddingBottom: '40px' }}>
            <section className="tfai-section">
                <button
                    className="tfai-cta"
                    onClick={handleBack}
                    style={{ marginBottom: '20px' }}
                >
                    &larr; Back to Shorts
                </button>

                <div className="tfai-section-heading">
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

                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="tfai-player">
                        <video controls autoPlay poster={shortform.thumb} style={{ width: '100%', borderRadius: '12px' }}>
                            <source src={shortform.video} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <span className="badge" style={{ background: '#13a4ec', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            {shortform.lang}
                        </span>
                        <h1 style={{ marginTop: '8px', fontSize: '28px' }}>{shortform.title}</h1>
                        <p style={{ marginTop: '16px', lineHeight: '1.6', color: '#555', fontSize: '16px' }}>
                            {shortform.desc}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default ShortsDetailPage
