// frontend/src/pages/SearchPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../App.css'; // 기존 스타일 사용

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
    <div className="main-container">
      <h2>🔍 "{query}" 검색 결과</h2>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>AI가 데이터를 분류해서 찾고 있습니다... 🤖</p>
        </div>
      ) : (
        <>
          {hasAnyResults() ? (
            <div className="search-results-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              
              {/* 1. 장소 섹션 (Places) */}
              {results.places && results.places.length > 0 && (
                <section>
                  <h3 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>🏰 추천 장소</h3>
                  <div className="card-grid" style={{ flexWrap: 'wrap', marginTop: '15px' }}>
                    {results.places.map((item) => (
                      <div key={item.id} className="placeholder-card" style={{ width: '300px' }}>
                        <div className="image-area" style={{ backgroundColor: '#e0f7fa', color: '#006064' }}>
                          장소 ID: {item.id}
                        </div>
                        <div className="text-area">
                          <h4>{item.content.substring(0, 15)}...</h4>
                          <p>{item.content}</p>
                          <small>유사도: {item.distance.toFixed(4)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 2. 리뷰 섹션 (Reviews) */}
              {results.reviews && results.reviews.length > 0 && (
                <section>
                  <h3 style={{ borderBottom: '2px solid #ff9800', paddingBottom: '10px' }}>🗣️ 생생 리뷰</h3>
                  <div className="card-grid" style={{ flexWrap: 'wrap', marginTop: '15px' }}>
                    {results.reviews.map((item) => (
                      <div key={item.id} className="placeholder-card" style={{ width: '300px' }}>
                        <div className="image-area" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                          리뷰 ID: {item.id}
                        </div>
                        <div className="text-area">
                          <p style={{ fontStyle: 'italic' }}>"{item.content}"</p>
                          <small>유사도: {item.distance.toFixed(4)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. 여행 일정 섹션 (Plans) */}
              {results.plans && results.plans.length > 0 && (
                <section>
                  <h3 style={{ borderBottom: '2px solid #4caf50', paddingBottom: '10px' }}>📅 추천 일정</h3>
                  <div className="card-grid" style={{ flexWrap: 'wrap', marginTop: '15px' }}>
                    {results.plans.map((item) => (
                      <div key={item.id} className="placeholder-card" style={{ width: '300px' }}>
                         <div className="image-area" style={{ backgroundColor: '#e8f5e9', color: '#1b5e20' }}>
                          일정 ID: {item.id}
                        </div>
                        <div className="text-area">
                          <p>{item.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 4. 기타 (Others) */}
              {results.others && results.others.length > 0 && (
                <section>
                  <h3>📦 기타 결과</h3>
                  <div className="card-grid" style={{ flexWrap: 'wrap' }}>
                    {results.others.map((item) => (
                      <div key={item.id} className="placeholder-card" style={{ width: '300px' }}>
                        <div className="text-area">
                          <p>{item.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          ) : (
             <div className="placeholder-box" style={{ textAlign: 'center', padding: '50px' }}>
                <h3>검색 결과가 없습니다. 😢</h3>
                <p>다른 키워드로 검색해보거나, 데이터를 등록해주세요.</p>
             </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;