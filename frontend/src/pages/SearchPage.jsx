// frontend/src/pages/SearchPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../App.css'; // 스타일 공유

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query'); // URL에서 '?query=검색어' 가져옴
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query) return;

      setLoading(true);
      try {
        const response = await fetch("http://localhost:8001/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query }),
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data);
        } else {
          console.error("검색 실패");
        }
      } catch (error) {
        console.error("에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]); // query가 바뀔 때마다 실행

  return (
    <div className="main-container">
      <h2>🔍 "{query}" 검색 결과</h2>
      
      {loading ? (
        <p>AI가 열심히 찾고 있습니다... 🤖</p>
      ) : (
        <>
          {results.length > 0 ? (
            <div className="card-grid" style={{ flexWrap: 'wrap' }}>
              {results.map((item) => (
                <div key={item.place_id} className="placeholder-card" style={{ width: '300px' }}>
                  <div className="image-area">이미지 (ID: {item.place_id})</div>
                  <div className="text-area">
                    <h3>{item.content.substring(0, 15)}...</h3>
                    <p>{item.content}</p>
                    <small>유사도: {item.distance.toFixed(4)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="placeholder-box">
                <p>검색 결과가 없습니다. 다른 단어로 검색해보세요!</p>
             </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;