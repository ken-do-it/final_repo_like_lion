import React from 'react';
import SearchBar from './components/SearchBar';
import CityCard from './components/CityCard';
import { MdFlight, MdHotel, MdTrain, MdRateReview } from 'react-icons/md';
import { IoTicket, IoMap } from 'react-icons/io5';
import { RiSuitcase3Fill, RiArticleLine } from 'react-icons/ri';
import { FaUserCircle } from 'react-icons/fa';

const TripleIntroPage = () => {
    // Mock Data: CITIES (Places)
    const PLACES = [
        { id: 1, name: '오사카', country: '일본', imageUrl: 'https://images.unsplash.com/photo-1590559899731-a38283956c8c?auto=format&fit=crop&w=600&q=80' },
        { id: 2, name: '도쿄', country: '일본', imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80' },
        { id: 3, name: '후쿠오카', country: '일본', imageUrl: 'https://images.unsplash.com/photo-1605218427368-35b85073abec?auto=format&fit=crop&w=600&q=80' },
        { id: 4, name: '다낭', country: '베트남', imageUrl: 'https://images.unsplash.com/photo-1559592413-7cec430aaec3?auto=format&fit=crop&w=600&q=80' },
        { id: 5, name: '제주', country: '대한민국', imageUrl: 'https://images.unsplash.com/photo-1577745334710-9114dbe1f86f?auto=format&fit=crop&w=600&q=80' },
        { id: 6, name: '서울', country: '대한민국', imageUrl: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80' },
        { id: 7, name: '파리', country: '프랑스', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80' },
        { id: 8, name: '뉴욕', country: '미국', imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80' },
    ];

    // Mock Data: Local Columns
    const COLUMNS = [
        { id: 101, title: '오사카 현지인 맛집 BEST 5', author: '맛객', views: 12500, image: 'https://images.unsplash.com/photo-1554502078-ef0fc409efce?auto=format&fit=crop&w=600&q=80' },
        { id: 102, title: '도쿄 골목 숨은 명소 찾기', author: '여행자 Kim', views: 8200, image: 'https://images.unsplash.com/photo-1545564858-a53ec2d431f4?auto=format&fit=crop&w=600&q=80' },
        { id: 103, title: '다낭에서 꼭 사야 할 기념품', author: '쇼핑왕', views: 15400, image: 'https://images.unsplash.com/photo-1505075406086-a7873832d20e?auto=format&fit=crop&w=600&q=80' },
        { id: 104, title: '후쿠오카 2박 3일 알짜 코스', author: '플래너 J', views: 9800, image: 'https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=600&q=80' },
    ];

    // Mock Data: Travel Plans
    const PLANS = [
        { id: 201, title: '오사카 3박 4일 먹방 투어', user: '먹깨비', likes: 342, tags: ['#맛집', '#오사카', '#커플여행'] },
        { id: 202, title: '가족과 함께하는 제주 힐링 여행', user: '해피패밀리', likes: 512, tags: ['#가족여행', '#제주', '#휴식'] },
        { id: 203, title: '혼자 떠나는 도쿄 감성 여행', user: '혼행러', likes: 128, tags: ['#혼자여행', '#도쿄', '#감성'] },
    ];

    const MENU_ICONS = [
        { label: '항공권', icon: <MdFlight className="text-3xl text-blue-500" /> },
        { label: '숙소', icon: <MdHotel className="text-3xl text-pink-500" /> },
        { label: '투어·티켓', icon: <IoTicket className="text-3xl text-purple-500" /> },
        { label: '여행계획', icon: <RiSuitcase3Fill className="text-3xl text-indigo-500" /> }, // Plan
        { label: '현지인칼럼', icon: <RiArticleLine className="text-3xl text-orange-500" /> }, // Column
        { label: '철도', icon: <MdTrain className="text-3xl text-green-600" /> }, // Train
        { label: '장소찾기', icon: <IoMap className="text-3xl text-green-500" /> }, // Place
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 pb-20">

            {/* 1. Header & Search - "어디로 떠나시나요?" */}
            <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-12 pb-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
                        어디로 떠나시나요?
                    </h1>
                    <p className="text-gray-500 text-lg">
                        여행을 쓰자, 트러블! (Clone)
                    </p>
                </div>
                <div className="mb-10">
                    <SearchBar className="shadow-xl" />
                </div>

                {/* 2. Menu Icons */}
                <div className="flex justify-center flex-wrap gap-4 md:gap-8 mb-16 py-2">
                    {MENU_ICONS.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group">
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:bg-gray-100 transition-all">
                                {item.icon}
                            </div>
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-4 md:px-8">

                {/* 3. Section: Travel Plans (여행계획) */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">🔥 인기 여행 계획</h2>
                        <span className="text-gray-400 text-sm cursor-pointer hover:text-gray-600">전체보기</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map(plan => (
                            <div key={plan.id} className="border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white">
                                <div className="flex items-center gap-2 mb-3">
                                    <FaUserCircle className="text-gray-300 text-2xl" />
                                    <span className="text-sm text-gray-600 font-medium">{plan.user}</span>
                                </div>
                                <h3 className="text-lg font-bold mb-2 line-clamp-1">{plan.title}</h3>
                                <div className="flex gap-2 mb-3">
                                    {plan.tags.map(tag => (
                                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md">{tag}</span>
                                    ))}
                                </div>
                                <div className="text-xs text-gray-400">
                                    ❤️ {plan.likes}명이 저장함
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Section: Local Columns (현지인 칼럼) */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">📝 현지인 맛집 칼럼</h2>
                        <span className="text-gray-400 text-sm cursor-pointer hover:text-gray-600">전체보기</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {COLUMNS.map(col => (
                            <div key={col.id} className="group cursor-pointer">
                                <div className="relative aspect-[3/2] overflow-hidden rounded-lg mb-3">
                                    <img src={col.image} alt={col.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                </div>
                                <h3 className="text-base font-bold leading-snug mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {col.title}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>by {col.author}</span>
                                    <span>👀 {col.views}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Section: Places (여행지/장소) */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">✈️ 추천 여행지</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-x-6 gap-y-10">
                        {PLACES.map((city) => (
                            <CityCard key={city.id} city={city} />
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TripleIntroPage;
