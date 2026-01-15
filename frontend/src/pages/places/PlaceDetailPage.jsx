import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { placesAxios as api } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const PlaceDetailPage = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [place, setPlace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Params for API mode
    const apiId = searchParams.get('api_id');
    const provider = searchParams.get('provider');
    const nameData = searchParams.get('name');

    // Data Fetching
    useEffect(() => {
        const fetchPlaceDetail = async () => {
            setLoading(true);
            setError(null);
            try {
                let response;

                // Mode 1: DB ID-based (Existing place)
                if (id) {
                    response = await api.get(`/places/${id}`);
                }
                // Mode 2: API ID-based (New or unsaved place)
                else if (apiId && provider) {
                    response = await api.get('/places/detail', {
                        params: {
                            place_api_id: apiId,
                            provider: provider,
                            name: nameData
                        }
                    });
                } else {
                    throw new Error("잘못된 접근입니다. 장소 ID가 필요합니다.");
                }

                setPlace(response.data);
            } catch (err) {
                console.error("Failed to fetch place detail:", err);
                setError(err.response?.data?.detail || "장소 정보를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchPlaceDetail();
    }, [id, apiId, provider, nameData]);

    const mapRef = useRef(null);

    // Kakao Map Logic
    useEffect(() => {
        if (!place || !place.latitude || !place.longitude) return;

        const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
        if (!kakaoKey) {
            console.warn("Kakao JS Key is missing in .env");
            return;
        }

        const initMap = () => {
            if (!window.kakao || !window.kakao.maps) {
                console.log("Kakao maps not loaded yet.");
                return;
            }

            window.kakao.maps.load(() => {
                if (!mapRef.current) {
                    console.log("Map container ref is null.");
                    return;
                }

                const options = {
                    center: new window.kakao.maps.LatLng(place.latitude, place.longitude),
                    level: 3
                };
                const map = new window.kakao.maps.Map(mapRef.current, options);

                const marker = new window.kakao.maps.Marker({
                    position: new window.kakao.maps.LatLng(place.latitude, place.longitude)
                });
                marker.setMap(map);
                console.log("Kakao map initialized with marker.");
            });
        };

        if (window.kakao && window.kakao.maps) {
            console.log("Kakao maps already loaded, initializing map directly.");
            initMap();
        } else {
            const scriptId = 'kakao-map-sdk';
            let script = document.getElementById(scriptId);

            if (!script) {
                console.log("Creating Kakao map script.");
                script = document.createElement("script");
                script.id = scriptId;
                script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`;
                script.async = true;
                document.head.appendChild(script);
            } else {
                console.log("Kakao map script already exists.");
            }

            script.addEventListener('load', initMap);

            return () => {
                console.log("Cleaning up Kakao map script event listener.");
                script.removeEventListener('load', initMap);
            };
        }
    }, [place]);

    if (loading) return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
            <div className="animate-pulse text-[#1392ec] font-bold text-xl">
                장소 정보를 불러오는 중입니다...
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex flex-col items-center justify-center gap-4">
            <div className="text-red-500 font-bold text-xl">{error}</div>
            <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
                뒤로 가기
            </button>
        </div>
    );

    const { isAuthenticated } = useAuth();

    const handleActionClick = (action) => {
        if (!isAuthenticated) {
            if (window.confirm("로그인이 필요한 서비스입니다. 로그인 페이지로 이동하시겠습니까?")) {
                navigate('/login-page');
            }
            return;
        }

        // TODO: Implement actual action logic
        console.log(`${action} executed by authenticated user`);
        alert(`${action} 기능은 준비 중입니다.`);
    };

    if (!place) return null;

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] pb-20">
            {/* Hero Image / Map Placeholder */}
            <div className="relative h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                {place.thumbnail_urls && place.thumbnail_urls.length > 0 ? (
                    <img
                        src={place.thumbnail_urls[0]}
                        alt={place.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <span className="text-4xl mb-2">🗺️</span>
                        <span className="font-medium">이미지가 없습니다</span>
                    </div>
                )}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/60 to-transparent"></div>

                <div className="absolute bottom-0 left-0 w-full p-6 container mx-auto max-w-screen-xl">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 shadow-sm">
                        {place.name}
                    </h1>
                    <div className="flex items-center text-white/90 gap-3 text-sm md:text-base">
                        <span className="bg-[#1392ec] px-2 py-1 rounded text-xs font-bold text-white">
                            {place.category_main || '장소'}
                        </span>
                        <span>{place.city}</span>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <main className="container mx-auto px-4 max-w-screen-xl mt-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column (Main Info) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 className="text-xl font-bold mb-4">기본 정보</h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <span className="w-6 text-center">📍</span>
                                    <span className="text-gray-600 dark:text-gray-300">{place.address}</span>
                                </div>
                                {place.phone && (
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 text-center">📞</span>
                                        <a href={`tel:${place.phone}`} className="text-[#1392ec] hover:underline">
                                            {place.phone}
                                        </a>
                                    </div>
                                )}
                                {place.place_url && (
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 text-center">🔗</span>
                                        <a href={place.place_url} target="_blank" rel="noopener noreferrer" className="text-[#1392ec] hover:underline break-all">
                                            {place.place_url}
                                        </a>
                                    </div>
                                )}
                                {place.category_detail && place.category_detail.length > 0 && (
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 text-center">🏷️</span>
                                        <div className="flex flex-wrap gap-2">
                                            {place.category_detail.map((cat, idx) => (
                                                <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-xs text-gray-600 dark:text-gray-300">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Opening Hours */}
                        {place.opening_hours && place.opening_hours.length > 0 && (
                            <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-xl font-bold mb-4">영업 시간</h2>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                    {place.opening_hours.map((path, idx) => (
                                        <li key={idx} className="flex gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#1392ec] mt-2 shrink-0"></span>
                                            {path}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Kakao Map */}
                        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 className="text-xl font-bold mb-4">위치</h2>
                            <div ref={mapRef} className="w-full h-64 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
                        </div>


                    </div>

                    {/* Right Column (Actions & Map) */}
                    <div className="space-y-6">
                        {/* Action Card */}
                        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">평점</div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-2xl font-bold text-[#111111] dark:text-white">
                                            {place.average_rating ? place.average_rating.toFixed(1) : "0.0"}
                                        </span>
                                        <span className="text-yellow-400 text-xl">★</span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        리뷰 {place.review_count || 0}개
                                    </div>
                                </div>
                                <button className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 group transition-colors">
                                    <span className="text-2xl text-gray-400 group-hover:text-red-500 transition-colors">♥</span>
                                </button>
                            </div>

                            <button
                                onClick={() => handleActionClick("여행 계획에 추가")}
                                className="w-full py-3 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-lg transition-colors mb-3"
                            >
                                여행 계획에 추가
                            </button>
                            <button
                                onClick={() => handleActionClick("리뷰 작성")}
                                className="w-full py-3 bg-white dark:bg-transparent border border-[#1392ec] text-[#1392ec] font-bold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                                리뷰 작성하기
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlaceDetailPage;
