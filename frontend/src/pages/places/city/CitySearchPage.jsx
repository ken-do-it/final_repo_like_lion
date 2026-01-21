import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPopularCities } from '../../../api/destinations';

const CitySearchPage = () => {
    const navigate = useNavigate();
    const [popularCities, setPopularCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        fetchPopularCities();
    }, []);

    const fetchPopularCities = async () => {
        try {
            const data = await getPopularCities();
            setPopularCities(data);
        } catch (error) {
            console.error('Failed to fetch popular cities:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchInput.trim()) {
            navigate(`/places/city/${encodeURIComponent(searchInput.trim())}`);
        }
    };

    const handleCityClick = (cityName) => {
        navigate(`/places/city/${encodeURIComponent(cityName)}`);
    };

    // 도시 이미지 매핑 (임시) - 실제로는 API에서 오거나 별도 관리가 필요할 수 있음
    const getCityImage = (cityName) => {
        const images = {
            '서울': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&q=80&w=400',
            '부산': 'https://images.unsplash.com/photo-1525177089949-b1488a0ea5b6?auto=format&fit=crop&q=80&w=400',
            '제주': 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&q=80&w=400',
            '대전': 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?auto=format&fit=crop&q=80&w=400',
            '대구': 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&q=80&w=400',
            '인천': 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?auto=format&fit=crop&q=80&w=400',
            '광주': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=400',
            '수원': 'https://images.unsplash.com/photo-1558862107-d49ef2a04d72?auto=format&fit=crop&q=80&w=400',
            '전주': 'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&q=80&w=400',
            '경주': 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?auto=format&fit=crop&q=80&w=400',
            // Default fallback
            'default': 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&q=80&w=400'
        };
        return images[cityName] || images['default'];
    };

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] transition-colors py-10">
            <div className="container mx-auto px-4 max-w-screen-xl">

                {/* Header & Search */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">어디로 떠나시나요? ✈️</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                        도시 이름을 검색하고 통합된 여행 정보를 만나보세요.
                    </p>

                    <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto relative group">
                        <div className="absolute inset-0 bg-[#1392ec]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="relative flex items-center w-full h-14 rounded-2xl bg-white dark:bg-[#1e2b36] shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-[#1392ec] transition-all overflow-hidden">
                            <div className="pl-6 pr-4 text-slate-400">
                                <span className="text-xl">🔍</span>
                            </div>
                            <input
                                className="w-full h-full bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg"
                                placeholder="도시 이름 검색 (예: 서울, 부산, 대전)"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="mr-2 px-6 py-2 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-xl whitespace-nowrap transition-colors"
                            >
                                검색
                            </button>
                        </div>
                    </form>
                </div>

                {/* Popular Cities */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 px-2">인기 여행지 🔥</h2>

                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-[#1e2b36] rounded-xl h-40 animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {popularCities.map((city) => (
                                <div
                                    key={city.city_name}
                                    onClick={() => handleCityClick(city.city_name)}
                                    className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[4/3] shadow-sm hover:shadow-lg transition-all transform hover:-translate-y-1"
                                >
                                    <img
                                        src={getCityImage(city.city_name)}
                                        alt={city.city_name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                        <h3 className="text-white font-bold text-xl mb-1">{city.city_name}</h3>
                                        <p className="text-white/80 text-xs line-clamp-1">{city.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CitySearchPage;
