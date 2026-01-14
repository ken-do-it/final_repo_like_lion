// frontend/src/pages/MainPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // 스타일 공유

import Layout from '../components/layout/Layout';

const MainPage = () => {
  const navigate = useNavigate();
  const [shortforms, setShortforms] = useState([]);
  const [loadingShorts, setLoadingShorts] = useState(true);

  // 2. 데이터 가져오기
  useEffect(() => {
    const fetchShortforms = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/shortforms/");
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) ? data : (data.results || []);
          setShortforms(list);
        } else {
          console.error("숏폼 불러오기 실패:", response.status);
        }
      } catch (error) {
        console.error("네트워크 에러:", error);
      } finally {
        setLoadingShorts(false);
      }
    };

    fetchShortforms();
  }, []);

  return (
    <Layout>
      <div className="main-container container mx-auto px-4 py-8">
        {/* 1. 히어로 섹션 (AI 여행 코스 짜기) - 가장 강조됨 */}
        <section className="hero-section mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4 dark:text-white">🚀 AI와 함께 떠나는 한국 여행</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">어디로 떠나고 싶으신가요? AI가 최적의 코스를 짜드립니다.</p>
          <div className="placeholder-box search-box max-w-2xl mx-auto mb-8 p-4 bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <span className="text-gray-500">🔍 (나중에 여기에 '여행지 입력' 기능이 들어갑니다)</span>
          </div>
          <button className="bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-lg text-lg font-bold transition-colors" onClick={() => alert("AI 기능은 커밍순!")}>
            AI 일정 생성하기
          </button>
        </section>

        {/* 2. 현지인 추천 칼럼 (가로 스크롤 카드) */}
        <section className="feature-section mb-16">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">🥘 현지인이 알려주는 추천 장소</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 나중에 데이터가 들어오면 map()으로 돌릴 부분 */}
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="bg-white dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">이미지 영역</div>
                <div className="p-4">
                  <h3 className="font-bold mb-2 dark:text-white">추천 칼럼 제목 {item}</h3>
                  <p className="text-sm text-gray-500">작성자: 현지인 뱃지</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. 여행 꿀팁 숏폼 (API 연동됨) */}
        <section className="feature-section mb-16">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">🔥 실시간 인기 여행 숏폼</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {loadingShorts ? (
              <p>로딩 중...</p>
            ) : shortforms.length > 0 ? (
              shortforms.map((item) => (
                <div key={item.id} className="relative rounded-xl overflow-hidden aspect-[9/16] bg-gray-900 group cursor-pointer">
                  {/* 썸네일이 있으면 표시 */}
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url.startsWith('http') ? item.thumbnail_url : `http://127.0.0.1:8000${item.thumbnail_url}`}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white bg-gray-800">
                      NO IMAGE
                    </div>
                  )}
                  {/* 제목 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white font-bold text-sm line-clamp-2">
                      {item.title}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="placeholder-shorts col-span-full text-center py-10 text-gray-500">
                <span>등록된 영상이 없습니다.</span>
              </div>
            )}
          </div>
        </section>

        {/* 4. 항공권/예약 (간단 배너) */}
        <section className="feature-section mb-12">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">✈️ 최저가 항공권 찾기</h2>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-dark-surface dark:to-gray-800 rounded-xl p-10 text-center border border-blue-100 dark:border-gray-700">
            <span className="text-gray-500 font-medium">(나중에 여기에 '날짜/인원 선택' 위젯이 들어갑니다)</span>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default MainPage;