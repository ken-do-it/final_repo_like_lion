import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalColumns, checkColumnPermission } from '../../../api/columns';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { API_LANG_CODES } from '../../../constants/translations';
import Button from '../../../components/ui/Button';

const LocalColumnList = () => {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const { isAuthenticated } = useAuth();
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState(''); // Search State
    const [debouncedQuery, setDebouncedQuery] = useState(''); // Debounced State

    // Debounce Logic
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        fetchColumns();
    }, [language, debouncedQuery]); // Re-fetch on query change

    const fetchColumns = async () => {
        try {
            setLoading(true);
            const data = await getLocalColumns({
                page: 1,
                limit: 20,
                lang: API_LANG_CODES[language] || 'eng_Latn',
                query: debouncedQuery // Pass query
            });
            setColumns(data);
        } catch (err) {
            console.error('Failed to fetch columns:', err);
            setError(t('col_fetch_error'));
        } finally {
            setLoading(false);
        }
    };

    const handleWriteClick = async () => {
        if (!isAuthenticated) {
            if (window.confirm(t('msg_login_required'))) {
                navigate('/login-page');
            }
            return;
        }

        const permission = await checkColumnPermission();
        if (!permission.allowed) {
            let msg = permission.message;
            if (permission.reason === 'badge_inactive') msg = t('msg_auth_inactive');
            else if (permission.reason === 'level_low') msg = t('msg_auth_level_low');
            else if (permission.reason === 'error') msg = t('msg_auth_error');

            alert(msg);
            return;
        }

        navigate('/local-columns/write');
    };

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] transition-colors">
            {/* Main Content */}
            <main className="container mx-auto px-4 max-w-screen-xl py-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-10">
                        {t('col_title')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                        {t('col_desc_1')}
                        <br />
                        {t('col_desc_2')}
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-md mx-auto mt-8 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('place_search_placeholder') || "검색어를 입력하세요..."}
                            className="w-full px-5 py-3 pr-12 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2b36] shadow-sm focus:ring-2 focus:ring-[#1392ec] outline-none transition-all dark:text-white"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                            🔍
                        </div>
                    </div>

                    {/* Write Button */}
                    <div className="flex justify-end mt-6">
                        <Button
                            onClick={handleWriteClick}
                            className="bg-[#1392ec] hover:bg-blue-600 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <span>✏️</span>
                            <span>{t('col_write_btn')}</span>
                        </Button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-8 text-center">
                        <p>{error}</p>
                        <button
                            onClick={fetchColumns}
                            className="mt-2 text-sm underline hover:text-red-700 dark:hover:text-red-300"
                        >
                            {t('col_retry')}
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white dark:bg-[#1e2b36] rounded-xl h-80 animate-pulse shadow-sm"></div>
                        ))}
                    </div>
                )}

                {/* Results Grid */}
                {!loading && !error && (
                    <>
                        {columns.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-4">📝</div>
                                <h3 className="text-xl font-bold mb-2">{t('col_no_cols')}</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {debouncedQuery ? (
                                        <>
                                            <p className="mb-2">"{debouncedQuery}" {t('no_results_desc')}</p>
                                            <button onClick={() => setSearchQuery('')} className="text-[#1392ec] underline text-sm">
                                                {t('btn_reset_filter') || "전체 목록 보기"}
                                            </button>
                                        </>
                                    ) : (
                                        t('col_be_first')
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {columns.map((column) => (
                                    <div
                                        key={column.id}
                                        onClick={() => navigate(`/local-columns/${column.id}`)}
                                        className="group bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-transparent hover:border-blue-500/30 overflow-hidden cursor-pointer flex flex-col h-full"
                                    >
                                        {/* Thumbnail Area */}
                                        <div className="relative h-48 overflow-hidden bg-gray-200 dark:bg-gray-700">
                                            <img
                                                src={column.thumbnail_url}
                                                alt={column.title}
                                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                            />
                                            {/* Overlay Gradient (Subtle) */}
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5 flex flex-col flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-lg line-clamp-2 group-hover:text-[#1392ec] transition-colors leading-snug">
                                                    {column.title}
                                                </h3>
                                            </div>

                                            <div className="mt-auto pt-4 flex items-center justify-between text-sm border-t border-gray-50 dark:border-gray-700/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] overflow-hidden text-gray-500 dark:text-gray-400">
                                                        {column.user_nickname ? column.user_nickname[0] : '?'}
                                                    </div>
                                                    <span className="font-medium text-gray-600 dark:text-gray-300 truncate max-w-[120px] flex items-center gap-1">
                                                        {column.user_nickname || t('col_anonymous')}
                                                        {column.user_level && (
                                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                                                🏅 Lv.{column.user_level}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                                    <span>👀 {column.view_count}</span>
                                                    <span>•</span>
                                                    <span>{new Date(column.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default LocalColumnList;
