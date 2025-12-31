// frontend/src/App.jsx
import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom' // ★ 라우터 필수 요소
import MainPage from './pages/MainPage'
import SearchPage from './pages/SearchPage' // ★ 검색 페이지 import
import './App.css'

function App() {
  // 1. 상태 관리
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // 페이지 이동을 위한 훅 (Hook)
  const navigate = useNavigate();

  // 사이드바 토글
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 홈으로 가기 (로고나 홈 버튼 클릭 시)
  const goHome = () => {
    setSearchQuery(""); // 검색창 비우기
    navigate("/");      // 메인 페이지로 이동
  };

  // 2. 검색 실행 함수 (API 호출 안 함 -> 페이지 이동만 함)
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      // 빈 값 입력 방지
      if (!searchQuery.trim()) return;

      console.log("페이지 이동:", searchQuery);
      
      // 검색 결과 페이지로 이동 (예: /search?query=경복궁)
      // encodeURIComponent는 한글이 깨지지 않게 변환해줍니다.
      navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
      
      // 모바일 등에서 사이드바가 열려있다면 닫아줌
      setIsSidebarOpen(false); 
    }
  };

  return (
    <div className="app-container">
      {/* ------------------------------------------------------
          1. 상단 Navbar
      ------------------------------------------------------- */}
      <nav className="navbar">
        {/* 왼쪽: 햄버거 버튼 + 로고 */}
        <div className="navbar-left">
          <button className="icon-btn menu-toggle" onClick={toggleSidebar}>
            ☰
          </button>
          {/* 로고 클릭 시 홈으로 이동 */}
          <span className="logo-text" onClick={goHome} style={{ cursor: 'pointer' }}>
            KOREA TRIP
          </span>
        </div>

        {/* 가운데: 검색창 */}
        <div className="navbar-center">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              className="main-search-input" 
              placeholder="어디로 떠나고 싶으신가요? (AI 의미 검색)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch} // 엔터키 감지
            />
          </div>
        </div>

        {/* 오른쪽: 알림/프로필 */}
        <div className="navbar-right">
          <button className="icon-btn">🔔</button>
          <div className="profile-avatar">👤</div>
        </div>
      </nav>

      <div className="content-wrapper">
        {/* ------------------------------------------------------
            2. 사이드바 (Navigation)
        ------------------------------------------------------- */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <ul className="sidebar-menu">
            <li onClick={goHome}>🏠 홈</li>
            <li>📅 AI 일정 만들기</li>
            <li>🥘 현지인 맛집 칼럼</li>
            <li>🔥 실시간 숏폼</li>
            <li>✈️ 항공권 예약</li>
            <div className="divider"></div>
            <li>❤️ 찜한 장소</li>
            <li>⚙️ 설정</li>
            <li>📞 고객센터</li>
          </ul>
        </aside>

        {/* ------------------------------------------------------
            3. 메인 컨텐츠 영역 (라우팅 적용)
        ------------------------------------------------------- */}
        <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
          {/* URL 주소에 따라 보여줄 컴포넌트를 결정합니다 */}
          <Routes>
            {/* 기본 주소(/)일 때 -> 메인 페이지 */}
            <Route path="/" element={<MainPage />} />
            
            {/* 검색 주소(/search)일 때 -> 검색 결과 페이지 */}
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App