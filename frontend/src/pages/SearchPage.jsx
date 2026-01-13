import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchAxios } from '../api/axios';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query) return;

      setLoading(true);
      try {
        // Using searchAxios which points to port 8001 (or env VITE_SEARCH_API_URL)
        const response = await searchAxios.post('/search', { query });
        setResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
        setResults(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

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
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen text-[#111111] dark:text-[#f1f5f9] transition-colors duration-300 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-[#1e2b36] shadow-sm py-6">
        <div className="container mx-auto px-4 max-w-screen-xl">
          <h2 className="text-2xl font-bold">
            🔍 <span className="text-[#1392ec]">"{query}"</span> 검색 결과
          </h2>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-screen-xl py-8 space-y-12">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1392ec] mb-4"></div>
            <p className="text-gray-500 animate-pulse">AI가 최적의 여행 정보를 분석하고 있습니다...</p>
          </div>
        ) : (
          <>
            {hasAnyResults() ? (
              <>
                {/* 1. Places Section */}
                {results?.places?.length > 0 && (
                  <section>
                    <div className="flex items-center mb-6">
                      <h3 className="text-xl font-bold border-l-4 border-[#1392ec] pl-3">🏰 추천 명소</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.places.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-[#1e2b36] rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col">
                          <div className="h-48 bg-gray-200 dark:bg-gray-700 w-full flex items-center justify-center text-gray-400 font-medium">
                            이미지 준비중
                          </div>
                          <div className="p-5 flex-1 flex flex-col">
                            <h4 className="text-lg font-bold mb-2 line-clamp-1">{item.content ? item.content.split('\n')[0] : '장소명'}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                              {item.content}
                            </p>
                            <div className="flex justify-between items-center text-xs text-gray-400 mt-auto">
                              <span>유사도: {(item.distance * 100).toFixed(1)}%</span>
                              <button className="text-[#1392ec] hover:underline font-medium">자세히 보기</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. Reviews Section */}
                {results?.reviews?.length > 0 && (
                  <section>
                    <div className="flex items-center mb-6">
                      <h3 className="text-xl font-bold border-l-4 border-orange-500 pl-3">🗣️ 생생 리뷰</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.reviews.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 relative">
                          <div className="absolute top-4 left-0 w-1 h-8 bg-orange-400 rounded-r"></div>
                          <p className="text-gray-700 dark:text-gray-300 italic mb-4 leading-relaxed line-clamp-3">
                            "{item.content}"
                          </p>
                          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600"></div>
                              <span className="text-sm text-gray-500">Reviewer</span>
                            </div>
                            <span className="text-xs text-orange-500 font-medium">매칭 {(item.distance * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Plans Section */}
                {results?.plans?.length > 0 && (
                  <section>
                    <div className="flex items-center mb-6">
                      <h3 className="text-xl font-bold border-l-4 border-green-500 pl-3">📅 추천 일정</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {results.plans.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-l-4 border-green-500 border-gray-100 dark:border-gray-700">
                          <h4 className="font-bold text-lg mb-2">여행 일정 제안</h4>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                            {item.content}
                          </p>
                          <button className="w-full py-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                            일정 자세히 보기
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Others Section */}
                {results?.others?.length > 0 && (
                  <section>
                    <div className="flex items-center mb-6">
                      <h3 className="text-xl font-bold border-l-4 border-gray-400 pl-3">📦 기타 정보</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {results.others.map((item) => (
                        <div key={item.id} className="bg-gray-50 dark:bg-[#15202b] rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.content}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-6xl mb-6">😢</div>
                <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-2">검색 결과가 없습니다.</h3>
                <p className="text-gray-500 max-w-md">
                  다른 키워드로 검색해보시거나, 철자를 확인해주세요. AI가 아직 학습하지 못한 장소일 수도 있습니다.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SearchPage;