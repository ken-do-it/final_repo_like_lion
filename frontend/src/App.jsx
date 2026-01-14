import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import FindAccountPage from './pages/auth/FindAccountPage';
import MyPage from './pages/mypage/MyPage';

// Import CSS
import './index.css';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Auth Routes */}
        <Route path="/login-page" element={<LoginPage />} />
        <Route path="/register-page" element={<SignupPage />} />
        <Route path="/find-account" element={<FindAccountPage />} />

        {/* User Routes */}
        <Route path="/mypage" element={<MyPage />} />

      </Routes>
    </Router>
  );
}

export default App;
