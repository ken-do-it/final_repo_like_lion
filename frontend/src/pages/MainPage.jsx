// frontend/src/pages/MainPage.jsx
import React from 'react';
import '../App.css'; // 스타일 공유

const MainPage = () => {
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

      {/* 3. 여행 꿀팁 숏폼 (세로 영상) */}
      <section className="feature-section bg-gray">
        <h2>🔥 실시간 인기 여행 숏폼</h2>
        <div className="shorts-grid">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="placeholder-shorts">
              <span>Shorts {item}</span>
            </div>
          ))}
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