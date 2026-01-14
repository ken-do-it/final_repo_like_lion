import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchAxios } from '../api/axios';



const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query');
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query) return;

      setLoading(true);
      try {
        const response = await searchAxios.post('', { query });
        setResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
        setResults(null);
      } finally {
        setLoading(false);
      }
    };

    if (query) {
      fetchSearchResults();
    }
  }, [query]);


  const hasResults = (type) => {
    if (!results) return false;
    if (type === 'All') {
      return (
        results.places?.length > 0 ||
        results.reviews?.length > 0 ||
        results.plans?.length > 0 ||
        results.others?.length > 0
      );
    }
    return results[type.toLowerCase()]?.length > 0;
  };

  // 거리(0~2)를 점수(100점 만점)로 변환하는 함수
  const getMatchScore = (distance) => {
    // Cosine Distance는 0이 완전 일치, 1이 직교, 2가 반대
    // 따라서 (1 - distance)가 유사도입니다.
    const similarity = Math.max(0, 1 - distance);
    return (similarity * 100).toFixed(0);
  };

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen text-slate-900 dark:text-white font-sans transition-colors duration-300">
      {/* Sticky Tabs Sub-header */}
      <div className="sticky top-16 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101a22]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar">
            {['All', 'Places', 'Plans', 'Reviews', 'Others'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-xl px-5 py-2 text-sm font-bold transition-all ${activeTab === tab
                  ? 'bg-[#1392ec] text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-700'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1392ec] mb-4"></div>
            <p className="text-gray-500 animate-pulse">Searching for "{query}"...</p>
          </div>
        ) : !results ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-bold mb-2">Ready to explore?</h3>
            <p className="text-gray-500">Search for destinations, hotels, or guides.</p>
          </div>
        ) : (
          <>
            {/* Places Section */}
            {(activeTab === 'All' || activeTab === 'Places') && results.places?.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Recommended Places</h2>
                  {activeTab === 'All' && <button onClick={() => setActiveTab('Places')} className="text-sm font-bold text-[#1392ec]">See all</button>}
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {results.places.map((place) => (
                    <div key={place.id} className="group relative flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#1e2b36] p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md border border-gray-100 dark:border-gray-700">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-700">
                        <div className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110 cursor-pointer text-black">
                          🔖
                        </div>
                        <div className="h-full w-full bg-gray-300 flex items-center justify-center text-gray-500">
                          {/* Placeholder for image */}
                          Image
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 px-1 pb-1">
                        <div className="flex items-center justify-between">
                          <h3 className="line-clamp-1 text-lg font-bold group-hover:text-[#1392ec]">{place.content?.split('\n')[0] || 'Unknown Place'}</h3>
                          <div className="flex items-center gap-1 text-[#1392ec]">
                            <span>★</span>
                            {/* 점수 계산 로직 수정 (1 - distance) */}
                            <span className="text-sm font-bold">{getMatchScore(place.distance)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{place.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Itineraries Section */}
            {(activeTab === 'All' || activeTab === 'Plans') && results.plans?.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Popular Itineraries</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {results.plans.map((plan) => (
                    <div key={plan.id} className="group flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#1e2b36] shadow-sm transition-all hover:shadow-md border border-gray-100 dark:border-gray-700 sm:flex-row">
                      <div className="h-48 w-full shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 sm:h-auto sm:w-2/5 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">Map/Image</div>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-bold text-[#1392ec]">Plan</span>
                            <span className="text-xs font-medium text-gray-500">AI Suggestion</span>
                          </div>
                          <h3 className="mb-3 text-xl font-bold leading-tight group-hover:text-[#1392ec] line-clamp-2">
                            {plan.content.substring(0, 50)}...
                          </h3>
                          {/* Timeline Visualization (Mock) */}
                          <div className="relative flex items-center gap-3 py-2">
                            <div className="absolute left-1 top-1/2 h-[calc(100%-8px)] w-0.5 -translate-y-1/2 bg-gray-200 dark:bg-gray-700"></div>
                            <div className="z-10 flex flex-col gap-3 w-full">
                              <div className="flex items-center gap-3">
                                <div className="size-2 rounded-full bg-[#1392ec] ring-4 ring-white dark:ring-[#1e2b36]"></div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Start</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="size-2 rounded-full bg-[#1392ec]/40 ring-4 ring-white dark:ring-[#1e2b36]"></div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Activity</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                          <button className="rounded-lg bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 text-sm font-bold text-[#1392ec] hover:bg-[#1392ec] hover:text-white transition-colors">
                            View Plan
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews Section */}
            {(activeTab === 'All' || activeTab === 'Reviews') && results.reviews?.length > 0 && (
              <section className="flex flex-col gap-5 pb-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">From Travelers</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {results.reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl bg-white dark:bg-[#1e2b36] p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                          <div>
                            <p className="text-sm font-bold">Traveler</p>
                            <p className="text-xs text-gray-500">Recent</p>
                          </div>
                        </div>
                        <div className="flex rounded-md bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5">
                          <span className="text-xs font-bold text-green-700 dark:text-green-400">★ 5.0</span>
                        </div>
                      </div>
                      <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-3">
                        "{review.content}"
                      </p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-500">
                        {/* 점수 계산 로직 수정 */}
                        <span>Match Score: {getMatchScore(review.distance)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Others Section (Added) */}
            {(activeTab === 'All' || activeTab === 'Others') && results.others?.length > 0 && (
              <section className="flex flex-col gap-5 pb-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Other Results</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.others.map((item) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 dark:bg-[#1e2b36] p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!hasResults('All') && (
              <div className="text-center py-20 bg-white dark:bg-[#1e2b36] rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="text-6xl mb-4">😢</div>
                <h3 className="text-lg font-bold">No results found for "{activeTab}"</h3>
                <p className="text-gray-500">Try adjusting your search or filters.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SearchPage;