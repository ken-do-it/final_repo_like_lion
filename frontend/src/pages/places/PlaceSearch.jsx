import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { placesAxios as api } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const PlaceSearch = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { language, t } = useLanguage();
    const queryFromUrl = searchParams.get('query') || '';

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchMeta, setSearchMeta] = useState({ total: 0, query: '' });

    const [searchInput, setSearchInput] = useState(queryFromUrl || '');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Ref to control if we should fetch/show suggestions
    const shouldFetchSuggestions = React.useRef(true);

    // Initial search when URL query changes
    useEffect(() => {
        if (queryFromUrl) {
            setSearchInput(queryFromUrl);
            fetchPlaces(queryFromUrl);
        }
    }, [queryFromUrl, language]); // Refetch when language changes

    // Debounced Autocomplete
    useEffect(() => {
        const timer = setTimeout(() => {
            if (shouldFetchSuggestions.current && searchInput.length >= 2) {
                fetchSuggestions(searchInput);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchSuggestions = async (query) => {
        try {
            const response = await api.get('/places/autocomplete', {
                params: {
                    q: query,
                    limit: 5,
                    lang: API_LANG_CODES[language] || 'eng_Latn'
                }
            });
            // Double check ref before showing
            if (shouldFetchSuggestions.current && response.data.suggestions && response.data.suggestions.length > 0) {
                setSuggestions(response.data.suggestions);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        } catch (err) {
            console.error("Autocomplete failed:", err);
            setSuggestions([]);
        }
    };

    const handleInputChange = (e) => {
        shouldFetchSuggestions.current = true;
        setSearchInput(e.target.value);
    };

    const handleSuggestionClick = (suggestion) => {
        shouldFetchSuggestions.current = false; // Prevent re-fetch
        setSearchInput(suggestion.name);
        setShowSuggestions(false);
        setSuggestions([]);
        // fetchPlaces(suggestion.name); // [Deleted] Direct fetch
        navigate(`?query=${encodeURIComponent(suggestion.name)}`); // [Added] Update URL to trigger useEffect
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        shouldFetchSuggestions.current = false; // Prevent late arrivals
        setShowSuggestions(false);
        setSuggestions([]);
        // fetchPlaces(searchInput); // [Deleted] Direct fetch
        navigate(`?query=${encodeURIComponent(searchInput)}`); // [Added] Update URL to trigger useEffect
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const fetchPlaces = async (query) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/places/search', {
                params: {
                    query: query,
                    lang: API_LANG_CODES[language] || 'eng_Latn'
                }
            });

            setResults(response.data.results || []);
            setSearchMeta({
                total: response.data.total || 0,
                query: response.data.query || query
            });
        } catch (err) {
            console.error("Search failed:", err);
            setError("장소를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceClick = (place) => {
        if (place.id) {
            navigate(`/places/${place.id}`);
        } else {
            const params = new URLSearchParams({
                api_id: place.place_api_id,
                provider: place.provider,
                name: place.name
            });
            navigate(`/places/detail?${params.toString()}`);
        }
    };



    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] transition-colors">
            {/* Main Content */}
            <main className="container mx-auto px-4 max-w-screen-xl py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-6 text-center">
                        {queryFromUrl
                            ? t('search_results_title').replace('{query}', queryFromUrl)
                            : t('place_search_title')}
                    </h1>

                    {/* Dedicated Search Input */}
                    <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl mx-auto mb-4 relative z-50">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-xl">🔍</span>
                            </div>
                            <input
                                type="text"
                                className={`w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e2b36] focus:ring-2 focus:ring-[#1392ec] focus:border-transparent outline-none transition-all text-lg shadow-sm ${showSuggestions && suggestions.length > 0 ? 'rounded-b-none' : ''}`}
                                placeholder={t('place_search_placeholder')}
                                value={searchInput}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => {
                                    if (searchInput.length >= 2 && suggestions.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                onBlur={() => {
                                    // Delay hiding to allow click event on suggestion to process
                                    setTimeout(() => setShowSuggestions(false), 150);
                                }}
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-2 bottom-2 px-6 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
                            >
                                {t('search_btn')}
                            </button>
                        </div>

                        {/* Autocomplete Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute w-full bg-white dark:bg-[#1e2b36] border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto z-50">
                                {suggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent blur before click
                                            handleSuggestionClick(suggestion);
                                        }}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#1392ec] transition-colors">
                                                {suggestion.name.split(new RegExp(`(${searchInput})`, 'gi')).map((part, i) =>
                                                    part.toLowerCase() === searchInput.toLowerCase()
                                                        ? <span key={i} className="text-[#1392ec]">{part}</span>
                                                        : part
                                                )}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {suggestion.address}
                                            </span>
                                        </div>
                                        {suggestion.city && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                                                {suggestion.city}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </form>

                    <p className="text-gray-600 dark:text-gray-400 text-center">
                        {loading
                            ? t('searching')
                            : queryFromUrl
                                ? t('search_result_count').replace('{count}', searchMeta.total)
                                : t('search_initial_msg')}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-8">
                        {error}
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
                {!loading && results.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {results.map((place) => (
                            <div
                                key={place.place_api_id || place.id}
                                onClick={() => handlePlaceClick(place)}
                                className="group bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-transparent hover:border-blue-500/30 overflow-hidden cursor-pointer flex flex-col h-full"
                            >
                                {/* Image Area */}
                                <div className="relative h-48 overflow-hidden bg-gray-200 dark:bg-gray-700">
                                    {place.thumbnail_urls && place.thumbnail_urls.length > 0 ? (
                                        <img
                                            src={place.thumbnail_urls[0]}
                                            alt={place.name}
                                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl font-bold">
                                            {place.name.charAt(0)}
                                        </div>
                                    )}
                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
                                        {place.category_main || '장소'}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg line-clamp-1 group-hover:text-[#1392ec] transition-colors">
                                            {place.name}
                                        </h3>
                                    </div>

                                    <div className="text-sm text-[#1392ec] font-medium mb-1">
                                        {place.category_main || '장소'}
                                        {place.category_detail && place.category_detail.length > 0 && (
                                            <span className="text-gray-400 font-normal ml-1">
                                                | {place.category_detail.join(', ')}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">
                                        {place.address}
                                    </p>

                                    <div className="mt-auto flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-1 text-[#1392ec] font-medium">
                                            <span>★</span>
                                            <span>{place.average_rating ? place.average_rating.toFixed(1) : '0.0'}</span>
                                            <span className="text-gray-400 font-normal">({place.review_count || 0})</span>
                                        </div>
                                        <div className="text-gray-400 text-xs">
                                            {place.city || '정보 없음'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* No Results */}
                {!loading && queryFromUrl && results.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🏝️</div>
                        <h3 className="text-xl font-bold mb-2">{t('no_results_title')}</h3>
                        <p className="text-gray-500">{t('no_results_desc')}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PlaceSearch;
