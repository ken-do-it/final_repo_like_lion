// frontend/src/App.jsx
import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import MainPage from './pages/MainPage'
import SearchPage from './pages/SearchPage'
import GeoImageUploader from './pages/GeoImageUploader'
import RoadviewGame from './pages/RoadviewGame'
import TestFrontAI from './pages/test_front_ai/TestFrontAI'
import './App.css'

function App() {
  // 1. 상태 관리
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 페이지 이동을 위한 훅
  const navigate = useNavigate();

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)
  const goHome = () => {
    setSearchQuery("");
    navigate("/");
  };

  // ★ [2] 지오게서(퀴즈) 페이지로 이동하는 함수 추가
  const goGeoQuiz = () => {
    navigate('/geo-quiz')
    setIsSidebarOpen(false)
  }
  const goTestFront = () => {
    navigate('/test-front')
    setIsSidebarOpen(false)
  }
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) return;
      console.log("페이지 이동:", searchQuery);
      navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
      setIsSidebarOpen(false);
    }
  }

  return (
    <div className="app-container">
      {/* ------------------------------------------------------
          1. 상단 Navbar
      ------------------------------------------------------- */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="icon-btn menu-toggle" onClick={toggleSidebar}>
            메뉴
          </button>
          <span className="logo-text" onClick={goHome} style={{ cursor: 'pointer' }}>
            KOREA TRIP
          </span>
        </div>

        <div className="navbar-center">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="main-search-input"
              placeholder="어디로 떠나고 싶으신가요? (AI 의미 검색)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
        </div>

        <div className="navbar-right">
          <button className="icon-btn">알림</button>
          <div className="profile-avatar">🙂</div>
        </div>
      </nav>

      <div className="content-wrapper">
        {/* ------------------------------------------------------
            2. 사이드바 (Navigation)
        ------------------------------------------------------- */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <ul className="sidebar-menu">
            <li onClick={goHome}>🏠 홈</li>
            <li onClick={goGeoQuiz}>지오 퀴즈 업로더</li>
            <li onClick={goTestFront}>🚪 테스트 프론트</li>
            <li>📅 AI 일정 만들기</li>
            <li>🥘 현지인 맛집 칼럼</li>
            <li>🔥 실시간 숏폼</li>
            <li>✈️ 항공권 예약</li>
            <div className="divider"></div>
            <li>❤️ 찜한 장소</li>
            <li>⚙️ 설정</li>
            <li>📞 고객센터</li>
            <li>버전 정보</li>
          </ul>
        </aside>

        {/* ------------------------------------------------------
            3. 메인 컨텐츠 영역 (라우팅 적용)
        ------------------------------------------------------- */}
        <main className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
          <Routes>
            {/* 기본 주소(/)일 때 -> 메인 페이지 */}
            <Route path="/" element={<MainPage />} />

            {/* 검색 주소(/search)일 때 -> 검색 결과 페이지 */}
            <Route path="/search" element={<SearchPage />} />

            {/* ★ [4] 지오게서 퀴즈 페이지 라우터 추가 */}
            <Route path="/geo-quiz" element={<GeoImageUploader />} />
            <Route path="/game" element={<RoadviewGame />} />
            <Route path="/test-front" element={<TestFrontAI />} />
          </Routes>
        </main>

      </div>
    </div>
  )
}

export default App
