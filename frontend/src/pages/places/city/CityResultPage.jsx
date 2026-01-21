import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCityContent } from '../../../api/destinations';
import { useLanguage } from '../../../context/LanguageContext';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./CityResultPage.css"; // Custom overrides

// Icons for section headers
const Icons = {
    plan: "🗓️",
    place: "📍",
    shortform: "📱",
    column: "✍️"
};

const CityResultPage = () => {
    const { cityName } = useParams();
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!cityName) return;
        fetchContent();
    }, [cityName, language]);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const data = await getCityContent(cityName, language);
            setContent(data);
        } catch (err) {
            console.error(err);
            setError(t('city_load_error'));
        } finally {
            setLoading(false);
        }
    };

    // Slider settings
    const sliderSettings = {
        dots: false,
        infinite: false,
        speed: 500,
        slidesToShow: 4.5,
        slidesToScroll: 1,
        swipeToSlide: true, // Allow user to drag freely
        initialSlide: 0,
        responsive: [
            { breakpoint: 1280, settings: { slidesToShow: 3.5 } },
            { breakpoint: 1024, settings: { slidesToShow: 3.2 } },
            { breakpoint: 768, settings: { slidesToShow: 2.2 } },
            { breakpoint: 480, settings: { slidesToShow: 1.2 } }
        ]
    };

    const SectionHeader = ({ title, icon }) => (
        <div className="flex items-center space-x-2 mb-4 px-2">
            <span className="text-2xl">{icon}</span>
            <h2 className="text-xl md:text-2xl font-bold dark:text-white text-slate-900">{title}</h2>
        </div>
    );

    // Helper to prevent click when dragging
    const handleMouseDown = (e) => {
        e.currentTarget.dataset.startX = e.clientX;
        e.currentTarget.dataset.startY = e.clientY;
    };

    const handleMouseUp = (e, path) => {
        const startX = parseFloat(e.currentTarget.dataset.startX || 0);
        const startY = parseFloat(e.currentTarget.dataset.startY || 0);
        const diffX = Math.abs(e.clientX - startX);
        const diffY = Math.abs(e.clientY - startY);

        // Only navigate if movement is less than 6px (click, not drag)
        if (diffX < 6 && diffY < 6) {
            navigate(path);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-[#101a22]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1392ec]"></div>
            </div>
        );
    }

    if (error || !content) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f8] dark:bg-[#101a22] text-center p-4">
                <span className="text-4xl mb-4">😢</span>
                <h2 className="text-xl font-bold mb-2 dark:text-white">{t('city_error_title')}</h2>
                <p className="text-gray-500 mb-6">{error || t('city_load_error')}</p>
                <button
                    onClick={() => navigate('/places/city')}
                    className="px-6 py-2 bg-[#1392ec] text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    {t('city_btn_retry_search')}
                </button>
            </div>
        );
    }

    // 데이터 존재 여부 확인
    const hasPlans = content.travel_plans && content.travel_plans.length > 0;
    const hasPlaces = content.places && content.places.length > 0;
    const hasShortforms = content.shortforms && content.shortforms.length > 0;
    const hasColumns = content.local_columns && content.local_columns.length > 0;

    // const isEmpty = !hasPlans && !hasPlaces && !hasShortforms && !hasColumns; // Removed global check

    const EmptySection = ({ text }) => (
        <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-[#1e2b36] rounded-xl border border-gray-100 dark:border-gray-800">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{text}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] pb-20">
            {/* Header */}
            <div className="relative h-64 md:h-80 bg-slate-900 overflow-hidden mb-8">
                <img
                    src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=2000" // Fallback header image
                    alt={cityName}
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101a22] to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full p-8 container mx-auto max-w-screen-xl">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{content ? (content.display_name || cityName) : cityName}</h1>
                    <p className="text-gray-300 text-lg">{t('city_header_desc')}</p>
                </div>
            </div>

            <div className="container mx-auto px-4 max-w-screen-xl space-y-12">

                {/* REMOVED GLOBAL EMPTY CHECK */}

                {/* 1. Travel Plans */}
                <section>
                    <SectionHeader title={t('city_sec_plan', { city: content ? (content.display_name || cityName) : cityName })} icon={Icons.plan} />
                    {hasPlans ? (
                        <Slider {...sliderSettings} className="px-2 -mx-2">
                            {content.travel_plans.map(plan => (
                                <div key={plan.id} className="px-2">
                                    <div className="bg-white dark:bg-[#1e2b36] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative aspect-[3/4] group cursor-pointer"
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={(e) => handleMouseUp(e, `/plans/${plan.id}`)}
                                    >
                                        {/* Placeholder for plan thumbnail if API doesn't provide one directly, use a gradient or pattern */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 opacity-20"></div>
                                        <div className="absolute inset-0 p-5 flex flex-col justify-end">
                                            <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1 leading-tight line-clamp-2">{plan.title}</h3>
                                            <p className="text-slate-600 dark:text-gray-400 text-sm line-clamp-2 mb-2">{plan.description}</p>
                                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                                                <span>{plan.user_nickname}</span>
                                                <span className="mx-1">•</span>
                                                <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Slider>
                    ) : (
                        <EmptySection text={t('city_empty_plan', { city: content ? (content.display_name || cityName) : cityName })} />
                    )}
                </section>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* 2. Recommended Places */}
                <section>
                    <SectionHeader title={t('city_sec_place', { city: content ? (content.display_name || cityName) : cityName })} icon={Icons.place} />
                    {hasPlaces ? (
                        <Slider {...sliderSettings} className="px-2 -mx-2">
                            {content.places.map(place => (
                                <div key={place.id} className="px-2">
                                    <div className="bg-white dark:bg-[#1e2b36] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={(e) => handleMouseUp(e, `/places/${place.id}`)}
                                    >
                                        <div className="relative aspect-video overflow-hidden">
                                            <img
                                                src={place.thumbnail_urls?.[0] || 'https://placehold.co/400x300?text=No+Image'}
                                                alt={place.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate mb-1">{place.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">{place.address}</p>
                                            <div className="flex items-center text-xs text-[#1392ec] font-medium">
                                                <span>⭐️ {place.average_rating ? Number(place.average_rating).toFixed(1) : '0.0'}</span>
                                                <span className="text-gray-400 mx-1">({place.review_count})</span>
                                                <span className="ml-auto bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                                                    {place.category_main}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Slider>
                    ) : (
                        <EmptySection text={t('city_empty_place', { city: content ? (content.display_name || cityName) : cityName })} />
                    )}
                </section>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* 3. Shortforms */}
                <section>
                    <SectionHeader title={t('nav_shorts')} icon={Icons.shortform} />
                    {hasShortforms ? (
                        <Slider {...{ ...sliderSettings, slidesToShow: 5.5, responsive: [{ breakpoint: 1024, settings: { slidesToShow: 4.5 } }, { breakpoint: 768, settings: { slidesToShow: 3.5 } }] }} className="px-2 -mx-2">
                            {content.shortforms.map(short => (
                                <div key={short.id} className="px-2">
                                    <div className="relative rounded-xl overflow-hidden aspect-[9/16] cursor-pointer group shadow-sm bg-black"
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={(e) => handleMouseUp(e, `/shorts/${short.id}`)}
                                    >
                                        <img
                                            src={short.thumbnail_url}
                                            alt={short.title}
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
                                            <h3 className="text-white text-sm font-bold line-clamp-2 mb-1">{short.title}</h3>
                                            <div className="flex items-center space-x-1 text-white/80 text-xs">
                                                <span>❤️ {short.total_likes}</span>
                                            </div>
                                        </div>
                                        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                                            <span className="text-white text-xs">▶</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Slider>
                    ) : (
                        <EmptySection text={t('city_empty_shorts')} />
                    )}
                </section>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* 4. Local Columns */}
                <section>
                    <SectionHeader title={t('nav_column')} icon={Icons.column} />
                    {hasColumns ? (
                        <Slider {...sliderSettings} className="px-2 -mx-2">
                            {content.local_columns.map(column => (
                                <div key={column.id} className="px-2">
                                    <div className="bg-white dark:bg-[#1e2b36] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group h-full"
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={(e) => handleMouseUp(e, `/places/columns/${column.id}`)}
                                    >
                                        <div className="relative aspect-[4/3] overflow-hidden">
                                            <img
                                                src={column.thumbnail_url || 'https://placehold.co/400x300?text=No+Image'}
                                                alt={column.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            {/* Badge display if needed */}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1 mb-2">{column.title}</h3>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center space-x-2">
                                                    {/* User Avatar Placeholder */}
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs overflow-hidden">
                                                        {column.user_nickname?.[0] || '?'}
                                                    </div>
                                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80px]">
                                                        {column.user_nickname}
                                                        {column.user_level >= 3 && <span className="ml-1 text-[#FFD700]">🏅</span>}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-400">👀 {column.view_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Slider>
                    ) : (
                        <EmptySection text={t('city_empty_column', { city: content ? (content.display_name || cityName) : cityName })} />
                    )}
                </section>
            </div>
        </div>
    );
};

export default CityResultPage;
