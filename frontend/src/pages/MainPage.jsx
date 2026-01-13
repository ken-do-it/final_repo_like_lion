import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import '../App.css';

const MainPage = () => {
  const navigate = useNavigate();
  const [shortforms, setShortforms] = useState([]);
  const [loadingShorts, setLoadingShorts] = useState(true);

  // Fetch Shortforms
  useEffect(() => {
    const fetchShortforms = async () => {
      try {
        // Using axiosInstance, base URL is already set to /api or http://localhost:8000/api
        // The endpoint requested is '/shortforms/'
        const response = await axiosInstance.get('/shortforms/');
        const data = response.data;
        const list = Array.isArray(data) ? data : (data.results || []);
        setShortforms(list);
      } catch (error) {
        console.error("Shortform fetch error:", error);
      } finally {
        setLoadingShorts(false);
      }
    };

    fetchShortforms();
  }, []);

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen text-[#111111] dark:text-[#f1f5f9] transition-colors duration-300 pb-20">
      {/* 1. Hero Section */}
      <section className="relative w-full py-20 px-4 bg-gradient-to-r from-blue-50 to-white dark:from-[#1e2b36] dark:to-[#101a22]">
        <div className="container mx-auto max-w-screen-xl text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            🚀 AI와 함께 떠나는 <br />
            <span className="text-[#1392ec]">한국 여행</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            어디로 떠나고 싶으신가요? AI가 당신의 취향을 분석하여 최적의 여행 코스를 제안해 드립니다.
          </p>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <button
              className="px-8 py-4 bg-[#1392ec] hover:bg-blue-600 text-white text-lg font-bold rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 w-full md:w-auto"
              onClick={() => alert("AI 기능은 커밍순!")}
            >
              AI 일정 생성하기
            </button>
            {/* Placeholder Search Box */}
            <div className="bg-white dark:bg-[#1e2b36] border border-gray-200 dark:border-gray-700 rounded-full px-6 py-3 flex items-center shadow-sm w-full md:w-96 text-gray-500">
              <span>🔍 여행지 검색 (준비중)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Local Recommendations (Horizontal Scroll) */}
      <section className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🥘 현지인이 알려주는 추천 장소</h2>
          <button className="text-[#1392ec] hover:underline text-sm font-medium">전체보기</button>
        </div>

        <div className="flex space-x-6 overflow-x-auto pb-6 scrollbar-hide">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="min-w-[280px] bg-white dark:bg-[#1e2b36] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100 dark:border-gray-700">
              <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                이미지 영역
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1 truncate">숨겨진 명소 {item}</h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span className="bg-blue-100 dark:bg-blue-900 text-[#1392ec] text-xs px-2 py-0.5 rounded-full mr-2">현지인</span>
                  <span>작성자 {item}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Short-form Videos */}
      <section className="bg-gray-50 dark:bg-[#15202b] py-16">
        <div className="container mx-auto px-4 max-w-screen-xl">
          <h2 className="text-2xl font-bold mb-8">🔥 실시간 인기 여행 숏폼</h2>

          {loadingShorts ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1392ec]"></div>
            </div>
          ) : shortforms.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {shortforms.map((item) => (
                <div key={item.id} className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg group cursor-pointer transform hover:scale-[1.02] transition-transform duration-300">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url.startsWith('http') ? item.thumbnail_url : `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}${item.thumbnail_url}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                      <span className="text-xs">NO IMAGE</span>
                    </div>
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12">
                    <h3 className="text-white font-bold text-sm md:text-base line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  {/* Play Icon on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <span className="text-white text-xl">▶</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              등록된 숏폼 영상이 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 4. Flight Banner */}
      <section className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="bg-gradient-to-r from-blue-600 to-[#1392ec] rounded-2xl p-8 md:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between">
          <div className="mb-6 md:mb-0">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">✈️ 최저가 항공권을 찾고 계신가요?</h2>
            <p className="text-blue-100">가장 저렴한 시기에 떠나는 여행, 지금 바로 확인하세요.</p>
          </div>
          <button className="px-8 py-3 bg-white text-[#1392ec] font-bold rounded-lg shadow-md hover:bg-gray-100 transition-colors">
            항공권 검색하기
          </button>
        </div>
      </section>
    </div>
  );
};

export default MainPage;