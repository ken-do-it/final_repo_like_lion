// frontend/src/pages/SearchPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../App.css'; // 기존 스타일 사용

import Layout from '../components/layout/Layout';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query'); // URL에서 검색어 가져오기

  // 백엔드에서 { places: [], reviews: [], ... } 형태로 받으므로 초기값은 null 또는 빈 객체
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query) return;

      setLoading(true);
      try {
        console.log("🚀 검색 요청:", query);

        // 1. 백엔드 호출 (통합 검색)
        const response = await fetch("http://127.0.0.1:8001/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", // 필수!
          },
          body: JSON.stringify({ query: query }), // 키값 'query' 필수!
        });

        if (response.ok) {
          const data = await response.json();
          console.log("✅ 분류된 결과 받음:", data);
          setResults(data);
        } else {
          console.error("❌ 검색 실패:", response.status);
          setResults(null);
        }
      } catch (error) {
        console.error("❌ 네트워크 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  // 결과가 하나라도 있는지 확인하는 헬퍼 함수
  const hasAnyResults = () => {
    if (!results) return false;
    return (
      (results.places && results.places.length > 0) ||
      (results.reviews && results.reviews.length > 0) ||
      (results.plans && results.plans.length > 0) ||
      (results.others && results.others.length > 0)
    );
  };

  return (
    <Layout>
      <div className="main-container container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6 dark:text-white">🔍 "{query}" 검색 결과</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <p className="text-xl">AI가 데이터를 분류해서 찾고 있습니다... 🤖</p>
          </div>
        ) : (
          <>
            {hasAnyResults() ? (
              <div className="search-results-wrapper space-y-12">

                {/* 1. 장소 섹션 (Places) */}
                {results.places && results.places.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold border-b-2 border-gray-800 dark:border-gray-200 pb-2 mb-4 dark:text-white">🏰 추천 장소</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.places.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                          <div className="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-800 dark:text-cyan-300 p-3 text-sm font-medium">
                            장소 ID: {item.id}
                          </div>
                          <div className="p-4">
                            <h4 className="font-bold mb-2 text-lg dark:text-white">{item.content.substring(0, 15)}...</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{item.content}</p>
                            <small className="text-gray-400">유사도: {item.distance.toFixed(4)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. 리뷰 섹션 (Reviews) */}
                {results.reviews && results.reviews.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold border-b-2 border-orange-500 pb-2 mb-4 dark:text-white">🗣️ 생생 리뷰</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.reviews.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                          <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 p-3 text-sm font-medium">
                            리뷰 ID: {item.id}
                          </div>
                          <div className="p-4">
                            <p className="italic text-gray-600 dark:text-gray-300 mb-2">"{item.content}"</p>
                            <small className="text-gray-400">유사도: {item.distance.toFixed(4)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. 여행 일정 섹션 (Plans) */}
                {results.plans && results.plans.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold border-b-2 border-green-500 pb-2 mb-4 dark:text-white">📅 추천 일정</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.plans.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                          <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-3 text-sm font-medium">
                            일정 ID: {item.id}
                          </div>
                          <div className="p-4">
                            <p className="text-gray-600 dark:text-gray-300">{item.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. 기타 (Others) */}
                {results.others && results.others.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold mb-4 dark:text-white">📦 기타 결과</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.others.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                          <div className="p-4">
                            <p className="text-gray-600 dark:text-gray-300">{item.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </div>
            ) : (
              <div className="placeholder-box text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">검색 결과가 없습니다. 😢</h3>
                <p className="text-gray-500">다른 키워드로 검색해보거나, 데이터를 등록해주세요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;