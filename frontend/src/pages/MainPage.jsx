import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { API_LANG_CODES } from '../constants/translations';



const MainPage = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [shortforms, setShortforms] = useState([]);
  const [loadingShorts, setLoadingShorts] = useState(true);

  // Fetch Shortforms (re-fetch when language changes)
  useEffect(() => {
    const fetchShortforms = async () => {
      try {
        setLoadingShorts(true);
        const targetLang = API_LANG_CODES[language] || 'eng_Latn';
        let response;
        try {
          response = await axiosInstance.get('/shortforms/', {
            params: { lang: targetLang }
          });
        } catch (err) {
          console.warn("Translation API failed, falling back to original:", err);
          response = await axiosInstance.get('/shortforms/');
        }
        const data = response.data;
        const list = Array.isArray(data) ? data : (data.results || []);

        // Map translated titles/content to main fields for display
        const translatedList = list.map(item => ({
          ...item,
          title: item.title_translated || item.title,
          content: item.content_translated || item.content
        }));

        setShortforms(translatedList);
      } catch (error) {
        console.error("Shortform fetch error:", error);
      } finally {
        setLoadingShorts(false);
      }
    };

    fetchShortforms();
  }, [language]);

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen text-slate-900 dark:text-white font-sans transition-colors duration-300">
      {/* Main Content Container (matches max-w-7xl form reference HTML) */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* 1. Hero Section: Heading + Search + Quick Filters */}
        <section className="flex flex-col items-center justify-center pt-8 pb-4 space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center text-slate-900 dark:text-white tracking-tight leading-tight">
            {t('hero_title_1')} <br />
            <span className="text-[#1392ec]">{t('hero_title_2')}</span>
          </h1>

          {/* Search Bar */}
          <div className="w-full max-w-2xl relative group">
            <div className="absolute inset-0 bg-[#1392ec]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center w-full h-16 rounded-2xl bg-white dark:bg-[#1e2b36] shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-[#1392ec] transition-all overflow-hidden">
              <div className="pl-6 pr-4 text-slate-400">
                <span className="text-2xl">🔍</span>
              </div>
              <input
                className="w-full h-full bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg"
                placeholder={t('search_placeholder')}
                type="text"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/search?query=${encodeURIComponent(e.target.value)}`);
                  }
                }}
              />
              <button className="mr-2 px-6 py-2.5 bg-[#1392ec] hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors">
                {t('search_btn')}
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-3 overflow-x-auto w-full justify-center py-2 no-scrollbar">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1392ec] text-white shadow-md shadow-blue-500/20 transition-transform hover:-translate-y-0.5">
              <span className="text-[20px]">▦</span>
              <span className="text-sm font-bold">{t('filter_all')}</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-light dark:bg-surface-dark text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-[#1392ec]/50 hover:text-[#1392ec] transition-all hover:-translate-y-0.5" onClick={() => navigate('/game')}>
              <span className="text-[20px]">📸</span>
              <span className="text-sm font-medium">{t('filter_geoquiz')}</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-[#1e2b36] text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-[#1392ec]/50 hover:text-[#1392ec] transition-all hover:-translate-y-0.5" onClick={() => navigate('/accommodations')}>
              <span className="text-[20px]">🏨</span>
              <span className="text-sm font-medium">{t('filter_stays')}</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-[#1e2b36] text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-[#1392ec]/50 hover:text-[#1392ec] transition-all hover:-translate-y-0.5">
              <span className="text-[20px]">✈️</span>
              <span className="text-sm font-medium">{t('filter_flights')}</span>
            </button>
          </div>
        </section>

        {/* 2. Quick Actions Grid (Static for visuals, wired slightly) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              ✈️
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_flight')}</span>
          </div>
          <div onClick={() => navigate('/accommodations')} className="bg-white dark:bg-[#1e2b36] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              🏨
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_stays')}</span>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              🚗
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_rentals')}</span>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              🎉
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_activities')}</span>
          </div>
        </section>

        {/* 3. Upcoming Adventure Section (Mock/Static Premium Visual) */}
        <section className="max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('sec_upcoming')}</h2>
            <button className="text-[#1392ec] text-sm font-bold hover:underline">{t('btn_view_all')}</button>
          </div>
          {/* ... (Rest of Upcoming Adventure Card remains static mock for now) ... */}
          <div className="bg-white dark:bg-[#1e2b36] rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row group cursor-pointer hover:shadow-xl transition-shadow relative">
            <div className="relative w-full md:w-2/5 h-48 md:h-auto overflow-hidden">
              {/* ... Image ... */}
              <img
                alt="Seoul Street"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                src="https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&q=80&w=600"
              />
              {/* ... Overlays ... */}
            </div>
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
              {/* ... existing static content for Seoul, Korea ... */}
              {/* For full i18n, these mock data should also be replaced, but skipping for brevity of visible parts first */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white hidden md:block">Seoul, Korea</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span>📅</span>
                    Oct 15 - Oct 22, 2026
                  </p>
                </div>
                {/* ... */}
              </div>
              {/* ... */}
            </div>
          </div>
        </section>

        {/* 4. Recommended Cities / Trending Shorts (Merged) */}
        <section className="max-w-7xl mx-auto w-full pb-12">
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('sec_trending')}</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                ←
              </button>
              <button className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                →
              </button>
            </div>
          </div>

          {/* Grid of Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {loadingShorts ? (
              [1, 2, 3, 4].map(n => (
                <div key={n} className="h-[400px] w-full rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
              ))
            ) : shortforms.length > 0 ? (
              shortforms.map((item) => (
                <div key={item.id} className="group relative h-[400px] w-full rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300">
                  {/* Image */}
                  <img
                    src={item.thumbnail_url ? (item.thumbnail_url.startsWith('http') ? item.thumbnail_url : `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}${item.thumbnail_url}`) : 'https://via.placeholder.com/300x500?text=No+Image'}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />

                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

                  {/* Top Right Heart */}
                  <div className="absolute top-4 right-4">
                    <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-red-500 transition-colors">
                      ♥
                    </button>
                  </div>

                  {/* Bottom Content */}
                  <div className="absolute bottom-0 left-0 p-6 w-full">
                    <h3 className="text-xl font-bold text-white mb-2 leading-tight line-clamp-2">{item.title}</h3>
                    <div className="flex items-center gap-1 text-white/80 text-sm mb-3">
                      <span>📍</span>
                      Korea
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-white font-bold text-sm">{(4 + Math.random()).toFixed(1)}</span>
                      </div>
                      <span className="text-white font-bold text-sm bg-white/20 px-2 py-1 rounded backdrop-blur-sm">View</span>
                    </div>
                  </div>

                  {/* Play Icon (Optional Hover) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="w-14 h-14 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50">
                      <span className="text-white text-2xl ml-1">▶</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Fallback if no shorts - Static Mock Data matching reference to look good
              <>
                <div className="group relative h-[400px] w-full rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all">
                  <img src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=600&auto=format&fit=crop" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Mock 1" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-6 left-6 text-white">
                    <h3 className="text-2xl font-bold">Busan</h3>
                    <p className="opacity-80">Sea & City</p>
                  </div>
                </div>
                <div className="group relative h-[400px] w-full rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all">
                  <img src="https://images.unsplash.com/photo-1492571350019-22de08371fd3?q=80&w=600&auto=format&fit=crop" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Mock 2" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-6 left-6 text-white">
                    <h3 className="text-2xl font-bold">Jeju Island</h3>
                    <p className="opacity-80">Nature Paradise</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default MainPage;