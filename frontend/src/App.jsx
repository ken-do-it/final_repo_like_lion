import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import MainPage from './pages/MainPage';
import SearchPage from './pages/SearchPage';
import GeoImageUploader from './pages/GeoImageUploader';
import RoadviewGame from './pages/RoadviewGame';
import AccommodationMap from './pages/AccommodationMap';
import TestFrontAI from './pages/test_front_ai/TestFrontAI';
import AntiTestPage from './pages/anti_test/AntiTestPage';
import TripleIntroPage from './pages/anti_test/TripleIntroPage';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import './App.css'; // Global styles if any, strictly Tailwind preferred

function App() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // 1. Global Dark Mode Initialization
  useEffect(() => {
    // Check system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Initial check
    applyTheme(mediaQuery);

    // Listener for changes
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, []);

  // 2. Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Define routes where the global navbar should be hidden
  const hideNavbarRoutes = ['/game', '/search']; // SearchPage has its own header, Game needs full immersion
  const showNavbar = !hideNavbarRoutes.includes(location.pathname);

  console.log("Current Path:", location.pathname);
  console.log("Show Navbar:", showNavbar);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] font-sans">
      {showNavbar && <Navbar toggleSidebar={() => setIsSidebarOpen(true)} />}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Routes>
        {/* Core Pages */}
        <Route path="/" element={<MainPage />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Features */}
        <Route path="/stays" element={<AccommodationMap />} />        {/* Updated path for consistency */}
        <Route path="/accommodations" element={<AccommodationMap />} /> {/* Legacy support */}

        <Route path="/geo-quiz" element={<GeoImageUploader />} />
        <Route path="/upload" element={<GeoImageUploader />} />     {/* Alias */}
        <Route path="/game" element={<RoadviewGame />} />

        {/* Development / Test Pages */}
        <Route path="/test-front" element={<TestFrontAI />} />
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