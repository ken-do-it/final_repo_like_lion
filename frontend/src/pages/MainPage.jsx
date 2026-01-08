// frontend/src/pages/MainPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // 스타일 공유

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
        setLoadingShorts(false); // 여기서 loadingShorts를 사용하려면 위에서 선언이 되어 있어야 합니다.
      }
    };

    fetchShortforms();
  }, []);

  return (
    <div className="main-container">
      {/* 1. 히어로 섹션 (AI 여행 코스 짜기) - 가장 강조됨 */}
      <section className="hero-section">
        <h1>🚀 AI와 함께 떠나는 한국 여행</h1>
        <p>어디로 떠나고 싶으신가요? AI가 최적의 코스를 짜드립니다.</p>
        <div className="placeholder-box search-box">
          <span>🔍 (나중에 여기에 '여행지 입력' 기능이 들어갑니다)</span>
        </div>
        <button className="cta-button" onClick={() => alert("AI 기능은 커밍순!")}>
          AI 일정 생성하기
        </button>
      </section>

      {/* 2. 현지인 추천 칼럼 (가로 스크롤 카드) */}
      <section className="feature-section">
        <h2>🥘 현지인이 알려주는 추천 장소</h2>
        <div className="card-grid">
          {/* 나중에 데이터가 들어오면 map()으로 돌릴 부분 */}
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="placeholder-card">
              <div className="image-area">이미지 영역</div>
              <div className="text-area">
                <h3>추천 칼럼 제목 {item}</h3>
                <p>작성자: 현지인 뱃지</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 여행 꿀팁 숏폼 (API 연동됨) */}
      <section className="feature-section bg-gray">
        <h2>🔥 실시간 인기 여행 숏폼</h2>
        <div className="shorts-grid">
          {loadingShorts ? (
            <p>로딩 중...</p>
          ) : shortforms.length > 0 ? (
            shortforms.map((item) => (
              <div key={item.id} className="placeholder-shorts" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* 썸네일이 있으면 표시 */}
                {item.thumbnail_url ? (
                  <img 
                    src={item.thumbnail_url.startsWith('http') ? item.thumbnail_url : `http://127.0.0.1:8000${item.thumbnail_url}`}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    NO IMAGE
                  </div>
                )}
                {/* 제목 오버레이 */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                  color: 'white', fontWeight: 'bold', fontSize: '0.9rem'
                }}>
                  {item.title}
                </div>
              </div>
            ))
          ) : (
            <div className="placeholder-shorts">
              <span>등록된 영상이 없습니다.</span>
            </div>
          )}
        </div>
      </section>

      {/* 4. 항공권/예약 (간단 배너) */}
      <section className="feature-section">
        <h2>✈️ 최저가 항공권 찾기</h2>
        <div className="placeholder-box wide-banner">
          <span>(나중에 여기에 '날짜/인원 선택' 위젯이 들어갑니다)</span>
        </div>
      </section>
    </div>
  );
};

export default MainPage;