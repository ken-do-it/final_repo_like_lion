import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import MainPage from './pages/MainPage';
import SearchPage from './pages/SearchPage';
import PlaceSearch from './pages/places/PlaceSearch';
import PlaceDetailPage from './pages/places/PlaceDetailPage';
import GeoImageUploader from './pages/GeoImageUploader';
import RoadviewGame from './pages/RoadviewGame';
import AccommodationMap from './pages/AccommodationMap';
import ShortsPage from './pages/shorts/ShortsPage';
import ShortsDetailPage from './pages/shorts/ShortsDetailPage';
import AntiTestPage from './pages/anti_test/AntiTestPage';
import TripleIntroPage from './pages/anti_test/TripleIntroPage';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import './App.css'; // Global styles if any, strictly Tailwind preferred

function App() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return storedTheme === 'dark' || (!storedTheme && systemPrefersDark);
  });

  // 1. Global Dark Mode Initialization (System + Manual)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    if (isDarkMode) {
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // 2. Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Define routes where the global navbar should be hidden
  const hideNavbarRoutes = ['/game']; // SearchPage has its own header, Game needs full immersion
  const showNavbar = !hideNavbarRoutes.includes(location.pathname);

  console.log("Current Path:", location.pathname);
  console.log("Show Navbar:", showNavbar);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] font-sans">
      {showNavbar && (
        <Navbar
          toggleSidebar={() => setIsSidebarOpen(true)}
          toggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Routes>
        {/* Core Pages */}
        <Route path="/" element={<MainPage />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Features */}
        <Route path="/stays" element={<AccommodationMap />} />        {/* Updated path for consistency */}
        <Route path="/accommodations" element={<AccommodationMap />} /> {/* Legacy support */}
        <Route path="/shorts" element={<ShortsPage />} />
        <Route path="/shorts/:id" element={<ShortsDetailPage />} />

        {/* Place Pages */}
        <Route path="/places/search" element={<PlaceSearch />} />
        <Route path="/places/detail" element={<PlaceDetailPage />} />
        <Route path="/places/:id" element={<PlaceDetailPage />} />

        <Route path="/geo-quiz" element={<GeoImageUploader />} />
        <Route path="/upload" element={<GeoImageUploader />} />     {/* Alias */}
        <Route path="/game" element={<RoadviewGame />} />

        {/* Development / Test Pages */}
        <Route path="/anti-test" element={<TripleIntroPage />} />
        <Route path="/anti-test-page" element={<AntiTestPage />} />

        {/* Fallback */}
        <Route path="*" element={
          <div className="flex h-screen items-center justify-center flex-col">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p>Page not found</p>
            <a href="/" className="mt-4 text-blue-500 hover:underline">Go Home</a>
          </div>
        } />
      </Routes>
    </div>
  );
}

export default App;
