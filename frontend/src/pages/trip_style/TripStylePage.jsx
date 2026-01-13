import React, { useState } from 'react';
import './TripStylePage.css';

const TripStylePage = () => {
    const [lang, setLang] = useState('en'); // 'en' or 'ko'
    const [activeCat, setActiveCat] = useState('All');

    const texts = {
        en: {
            auth: "Sign In",
            heroTitle: <>Discover <br /><span>Real Korea</span></>,
            heroSubtitle: "From hidden cafes to ancient palaces, find the trip that fits your style.",
            placeholder: "Where do you want to go? (e.g. Bukchon Hanok Village)",
            categories: ['All', 'Must-Visit', 'Hidden Gem', 'K-Food', 'Healing'],
            cards: [
                { id: 1, title: "Gyeongbokgung at Night", loc: "Seoul", tag: "Must-Visit", img: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?q=80&w=800&auto=format&fit=crop" },
                { id: 2, title: "Jeju Blue Ocean", loc: "Jeju Island", tag: "Healing", img: "https://images.unsplash.com/photo-1578491857958-36c53c61394a?q=80&w=800&auto=format&fit=crop" },
                { id: 3, title: "Street Food Heaven", loc: "Myeongdong", tag: "K-Food", img: "https://images.unsplash.com/photo-1580651315530-69c8e0026377?q=80&w=800&auto=format&fit=crop" },
                { id: 4, title: "Sunset at Han River", loc: "Seoul", tag: "Healing", img: "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=800&auto=format&fit=crop" },
                { id: 5, title: "Traditional Tea House", loc: "Insadong", tag: "Hidden Gem", img: "https://images.unsplash.com/photo-1595186008892-06b232679234?q=80&w=800&auto=format&fit=crop" },
                { id: 6, title: "Modern City Vibe", loc: "Gangnam", tag: "Must-Visit", img: "https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=800&auto=format&fit=crop" },
            ]
        },
        ko: {
            auth: "로그인",
            heroTitle: <>나만의 <br /><span>한국 여행</span></>,
            heroSubtitle: "숨겨진 카페부터 고궁 산책까지, 당신만의 여행 스타일을 찾아보세요.",
            placeholder: "어디로 떠나고 싶으신가요? (예: 북촌한옥마을)",
            categories: ['전체', '필수코스', '숨은명소', 'K-푸드', '힐링'],
            cards: [
                { id: 1, title: "경복궁 야간개장", loc: "서울", tag: "필수코스", img: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?q=80&w=800&auto=format&fit=crop" },
                { id: 2, title: "제주 푸른 바다", loc: "제주도", tag: "힐링", img: "https://images.unsplash.com/photo-1578491857958-36c53c61394a?q=80&w=800&auto=format&fit=crop" },
                { id: 3, title: "명동 길거리 음식", loc: "명동", tag: "K-푸드", img: "https://images.unsplash.com/photo-1580651315530-69c8e0026377?q=80&w=800&auto=format&fit=crop" },
                { id: 4, title: "한강의 노을", loc: "서울", tag: "힐링", img: "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=800&auto=format&fit=crop" },
                { id: 5, title: "인사동 전통 찻집", loc: "인사동", tag: "숨은명소", img: "https://images.unsplash.com/photo-1595186008892-06b232679234?q=80&w=800&auto=format&fit=crop" },
                { id: 6, title: "강남의 도시 야경", loc: "강남", tag: "필수코스", img: "https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=800&auto=format&fit=crop" },
            ]
        }
    };

    const t = texts[lang];

    return (
        <div className="trip-container">
            {/* Navbar */}
            <nav className="trip-navbar">
                <div className="trip-logo" onClick={() => window.location.href = '/'}>TRIPLE KOREA</div>
                <div className="trip-nav-right">
                    <button
                        className="lang-selector"
                        onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
                    >
                        {lang === 'en' ? '🇰🇷 KO' : '🇺🇸 EN'}
                    </button>
                    <button className="auth-btn">{t.auth}</button>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="trip-hero">
                <h1>{t.heroTitle}</h1>
                <p>{t.heroSubtitle}</p>

                <div className="ai-search-box">
                    <input type="text" placeholder={t.placeholder} />
                    <button className="ai-magic-btn">✨</button>
                </div>

                {/* Categories */}
                <div className="category-scroll">
                    {t.categories.map((cat, idx) => (
                        <div
                            key={idx}
                            className={`cat-pill ${activeCat === cat ? 'active' : ''}`}
                            onClick={() => setActiveCat(cat)}
                        >
                            {cat}
                        </div>
                    ))}
                </div>
            </header>

            {/* Main Feed */}
            <section className="trip-feed">
                {t.cards.map((card) => (
                    <div key={card.id} className="trip-card">
                        <div className="card-image-wrapper">
                            <img src={card.img} alt={card.title} />
                            <div className="card-overlay">
                                <span className="card-tag">{card.tag}</span>
                                <div className="card-title">{card.title}</div>
                                <div className="card-location">📍 {card.loc}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
};

export default TripStylePage;
