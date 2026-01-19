import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { API_LANG_CODES } from '../constants/translations';
import plansService from '../api/plansApi';
import { useAuth } from '../context/AuthContext';



const MainPage = () => {
  const navigate = useNavigate();

  // Helper to safely get thumbnail URL
  const getThumbnailUrl = React.useCallback((thumb) => {
    if (!thumb) return 'https://via.placeholder.com/300x500?text=No+Image';
    if (thumb.startsWith('http')) return thumb;

    // Handle relative path (ensure it starts with /)
    const path = thumb.startsWith('/') ? thumb : `/${thumb}`;
    // Handle base URL (remove trailing slash and /api if present)
    let base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000');
    if (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }

    return `${base}${path}`;
  }, []);
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [shortforms, setShortforms] = useState([]);
  const [loadingShorts, setLoadingShorts] = useState(true);

  // New States for Plan Features
  const [upcomingPlan, setUpcomingPlan] = useState(null);
  const [completedPlan, setCompletedPlan] = useState(null); // [NEW] For review banner
  const [heroMode, setHeroMode] = useState('search'); // 'search' | 'plan'
  const [planTitle, setPlanTitle] = useState('');
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);

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

  // Fetch Upcoming Plan
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchPlans = async () => {
        try {
          const res = await plansService.plans.getPlans();
          const allPlans = Array.isArray(res.data) ? res.data : (res.data.results || []);

          // Filter for current user's plans
          const userPlans = allPlans.filter(p => p.user === user.id);

          // Filter for future plans (end_date >= today)
          const today = new Date().toISOString().split('T')[0];
          const futurePlans = userPlans.filter(p => p.end_date >= today);
          // Sort by start_date asc
          futurePlans.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

          if (futurePlans.length > 0) {
            setUpcomingPlan(futurePlans[0]);
          } else {
            setUpcomingPlan(null);
          }

          // [NEW] Logic for Completed Plans (Recent)
          const pastPlans = userPlans.filter(p => p.end_date < today);
          pastPlans.sort((a, b) => new Date(b.end_date) - new Date(a.end_date)); // Descending (most recent first)

          if (pastPlans.length > 0) {
            // Logic: If user has a recent completed plan and (Review not done - assumed for now or check API if available)
            setCompletedPlan(pastPlans[0]);
          } else {
            setCompletedPlan(null);
          }
        } catch (err) {
          console.error("Failed to fetch plans", err);
        }
      };
      fetchPlans();
    } else {
      setUpcomingPlan(null);
      setCompletedPlan(null);
    }
  }, [isAuthenticated, user]);

  const handleCreatePlan = async () => {
    if (!isAuthenticated) {
      if (confirm(t('req_login') || 'Login required')) {
        navigate('/login-page');
      }
      return;
    }
    if (!planTitle || !planStartDate || !planEndDate) {
      alert(t('label_required') || 'Please fill all fields');
      return;
    }
    if (planStartDate > planEndDate) {
      alert('End date must be after start date');
      return;
    }

    try {
      setCreatingPlan(true);
      const res = await plansService.plans.createPlan({
        title: planTitle,
        start_date: planStartDate,
        end_date: planEndDate,
        is_public: false,
        plan_type: 'personal' // Default
      });
      // Navigate/Refresh? Navigate to detail is best
      navigate(`/plans/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert(t('submit_fail') || 'Failed to create plan');
    } finally {
      setCreatingPlan(false);
    }
  };

  const renderShortformsGrid = () => {
    if (loadingShorts) {
      return [1, 2, 3, 4].map(n => (
        <div key={n} className="h-[400px] w-full rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
      ));
    }

    if (shortforms.length === 0) {
      return (
        <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <span className="material-symbols-outlined text-6xl mb-4 text-slate-300 dark:text-slate-600">videocam_off</span>
          <p className="text-lg font-medium">{t('no_shorts')}</p>
        </div>
      );
    }

    return shortforms.map((item) => (
      <div key={item.id}
        onClick={() => navigate(`/shorts/${item.id}`)}
        className="group relative h-[400px] w-full rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Image */}
        <img
          src={getThumbnailUrl(item.thumbnail_url)}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://placehold.co/600x400?text=No+Thumbnail';
          }}
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
            {item.location_translated || item.location || 'Korea'}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 ml-1">
              <div className="flex items-center gap-1 text-white/90 text-xs font-medium">
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                {item.total_views || 0}
              </div>
              <div className="flex items-center gap-1 text-white/90 text-xs font-medium">
                <span className="material-symbols-outlined text-[16px] text-red-500">favorite</span>
                {item.total_likes || 0}
              </div>
            </div>
            <span className="text-white font-bold text-sm bg-white/20 px-2 py-1 rounded backdrop-blur-sm">View</span>
          </div>

          {/* Play Icon (Optional Hover) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="w-14 h-14 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50">
              <span className="text-white text-2xl ml-1">▶</span>
            </div>
          </div>
        </div>
      </div>
    ));
  };

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


          {/* Hero Tabs (Search vs Plan) */}
          <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 w-full max-w-3xl px-2">
            <button
              onClick={() => setHeroMode('search')}
              className={`pb-2 px-4 text-lg font-bold transition-all ${heroMode === 'search' ? 'text-[#1392ec] border-b-2 border-[#1392ec]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              {t('hero_tab_search')}
            </button>
            <button
              onClick={() => setHeroMode('plan')}
              className={`pb-2 px-4 text-lg font-bold transition-all ${heroMode === 'plan' ? 'text-[#1392ec] border-b-2 border-[#1392ec]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              {t('hero_tab_plan')}
            </button>
          </div>

          {/* Search Bar or Plan Creator */}
          <div className="w-full max-w-3xl relative group min-h-[80px]"> {/* min-h to prevent layout shift */}
            {heroMode === 'search' ? (
              <>
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
                  <button className="mr-2 px-6 py-2.5 bg-[#1392ec] hover:bg-blue-600 text-white font-semibold rounded-xl whitespace-nowrap flex-shrink-0 transition-colors">
                    {t('search_btn')}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-[#1e2b36] p-4 rounded-2xl shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 animate-fadeIn flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    className="flex-1 bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#1392ec]"
                    placeholder={t('plan_title_ph')}
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 flex gap-2 items-center bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-2">
                    <span className="text-slate-400 text-sm w-16">{t('plan_start')}</span>
                    <input
                      type="date"
                      className="bg-transparent border-none text-slate-900 dark:text-white flex-1 focus:ring-0 px-0"
                      value={planStartDate}
                      onChange={(e) => setPlanStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 flex gap-2 items-center bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-2">
                    <span className="text-slate-400 text-sm w-16">{t('plan_end')}</span>
                    <input
                      type="date"
                      className="bg-transparent border-none text-slate-900 dark:text-white flex-1 focus:ring-0 px-0"
                      value={planEndDate}
                      onChange={(e) => setPlanEndDate(e.target.value)}
                      min={planStartDate}
                    />
                  </div>
                  <button
                    onClick={handleCreatePlan}
                    disabled={creatingPlan}
                    className="md:w-auto w-full px-6 py-2 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-xl whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-50"
                  >
                    {creatingPlan ? t('loading') : t('plan_create_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>


        </section>

        {/* 2. Quick Actions Grid (Static for visuals, wired slightly) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div onClick={() => navigate('/reservations/flights')} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              ✈️
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_flight')}</span>
          </div>

          <div onClick={() => navigate('/accommodations')} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              🏨
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_stays')}</span>
          </div>
          <div onClick={() => navigate('/places/search')} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              📍
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_places')}</span>
          </div>
          <div onClick={() => navigate('/game')} className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform text-2xl">
              📸
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('action_geoquiz')}</span>
          </div>
        </section>

        {/* 3. Upcoming Adventure Section (Linked to Real Data) */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('sec_upcoming')}</h2>
            <button
              onClick={() => navigate('/plans')}
              className="text-[#1392ec] text-sm font-bold hover:underline"
            >
              {t('btn_view_all')}
            </button>
          </div>

          {upcomingPlan ? (
            <div
              onClick={() => navigate(`/plans/${upcomingPlan.id}`)}
              className="bg-white dark:bg-[#1e2b36] rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row group cursor-pointer hover:shadow-xl transition-shadow relative"
            >
              <div className="relative w-full md:w-2/5 h-48 md:h-64 overflow-hidden">
                <img
                  alt={upcomingPlan.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={getThumbnailUrl(upcomingPlan.thumbnail_url)} // Use helper
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=600'; // Fallback travel image
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="font-bold text-lg">{upcomingPlan.area || 'Travel'}</p>
                </div>
              </div>
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white line-clamp-2">{upcomingPlan.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                    <span>📅</span>
                    {new Date(upcomingPlan.start_date).toLocaleDateString()} - {new Date(upcomingPlan.end_date).toLocaleDateString()}
                  </p>
                  {upcomingPlan.description && (
                    <p className="text-slate-600 dark:text-slate-300 mt-4 line-clamp-2 text-sm">
                      {upcomingPlan.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                    {upcomingPlan.plan_type === 'personal' ? 'Personal Trip' : 'Group Trip'}
                  </span>
                  <span className="text-[#1392ec] font-bold text-sm group-hover:translate-x-1 transition-transform">
                    View Itinerary →
                  </span>
                </div>
              </div>
            </div>
          ) : completedPlan ? (
            /* [NEW] Review Request Banner */
            <div
              onClick={() => navigate(`/plans/${completedPlan.id}`)}
              className="bg-white dark:bg-[#1e2b36] rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row group cursor-pointer hover:shadow-xl transition-shadow relative"
            >
              <div className="relative w-full md:w-2/5 h-48 md:h-64 overflow-hidden bg-indigo-900">
                <img
                  alt={completedPlan.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                  src={getThumbnailUrl(completedPlan.thumbnail_url)}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1526772662000-3f88f107f500?auto=format&fit=crop&q=80&w=600'; // Memory/Review vibe
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl drop-shadow-lg">✨</span>
                </div>
              </div>
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-center items-center text-center space-y-4">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {(t('banner_review_title') || 'How was your trip to {dest}?').replace('{dest}', completedPlan.area || completedPlan.title)}
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {(t('banner_review_desc') || 'Share your memories and help others!')}
                </p>
                <button
                  className="px-6 py-3 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-full transition-colors shadow-md mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/plans/${completedPlan.id}`);
                  }}
                >
                  {t('banner_review_btn') || 'Write Review'}
                </button>
              </div>
            </div>
          ) : (
            /* Fallback / CTA when no plan */
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl shadow-lg p-8 text-center text-white flex flex-col items-center justify-center space-y-4">
              <h3 className="text-3xl font-bold">Start your next journey!</h3>
              <p className="text-white/90">You have no upcoming trips. Why not plan one now?</p>
              <button
                onClick={() => navigate('/plans/create')}
                className="mt-4 px-8 py-3 bg-white text-blue-600 font-bold rounded-full hover:bg-blue-50 transition-colors shadow-lg"
              >
                Create a Trip
              </button>
            </div>
          )}
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
            {renderShortformsGrid()}
          </div>
        </section>
      </main>
    </div >
  );
};

export default MainPage;