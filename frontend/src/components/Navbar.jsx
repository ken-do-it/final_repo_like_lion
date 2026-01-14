import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ toggleSidebar, toggleTheme, isDarkMode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { language, setLanguage, t } = useLanguage();
    const { user, isAuthenticated, logout } = useAuth();

    // Menu dropdown state
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef(null);

    // Search State
    const [searchQuery, setSearchQuery] = React.useState('');

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync search input with URL query parameter
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const query = params.get('query');
        if (query) {
            setSearchQuery(query);
        } else {
            setSearchQuery('');
        }
    }, [location.search]);

    const handleSearch = (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            if (searchQuery.trim()) {
                navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
                setSearchQuery('');
            }
        }
    };

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
        navigate('/');
        // window.location.reload(); // Context updates automatically, reload not needed usually
    };

    // User display info
    const initials = user?.nickname
        ? user.nickname.substring(0, 2).toUpperCase()
        : (user?.username ? user.username.substring(0, 2).toUpperCase() : 'ME');

    const displayName = user?.nickname || user?.username || 'User';
    const displayEmail = user?.email || 'user@example.com';

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#101a22]/95 backdrop-blur-md transition-colors">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">

                {/* 1. Left Section: Hamburger & Logo */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <button
                        type="button"
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        onClick={toggleSidebar}
                        aria-label="Open menu"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => navigate('/')}
                    >
                        <div className="flex items-center justify-center size-8 rounded-lg bg-[#1392ec] text-white font-bold text-xl group-hover:bg-blue-600 transition-colors">
                            T
                        </div>
                        <span className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#f1f5f9] hidden sm:block">
                            Tripko
                        </span>
                    </div>
                </div>

                {/* 2. Center Section: Search Bar */}
                <div className={`flex-1 max-w-md ${location.pathname === '/search' ? 'block' : 'hidden sm:block'}`}>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-[#1392ec] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearch}
                            placeholder={t('search_placeholder') || "Search trips..."}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-full leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-[#1392ec] focus:border-transparent transition-all sm:text-sm"
                        />
                    </div>
                </div>

                {/* 3. Right Section: Actions */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">

                    {location.pathname !== '/search' && (
                        <button
                            className="sm:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            onClick={() => navigate('/search')}
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    )}

                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-gray-500 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Toggle Dark Mode"
                    >
                        {isDarkMode ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>

                    <div className="relative">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="appearance-none bg-transparent font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-[#111111] dark:hover:text-white cursor-pointer outline-none pl-2 pr-6 py-1 focus:ring-0 border-none"
                        >
                            <option value="English">ENG</option>
                            <option value="한국어">KOR</option>
                            <option value="日本語">JPN</option>
                            <option value="中文">CHN</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

                    {/* Auth Section */}
                    {isAuthenticated ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer"
                            >
                                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <div className="size-7 rounded-full bg-gradient-to-tr from-blue-400 to-[#1392ec] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-[#1e2b36] overflow-hidden">
                                    {initials}
                                </div>
                            </button>

                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[#1e2b36] shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 transform origin-top-right transition-all">
                                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            navigate('/mypage');
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        {t('nav_mypage')}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        {t('nav_logout')}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/login-page')}
                                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#1392ec] dark:hover:text-[#1392ec] px-3 py-2 transition-colors"
                            >
                                {t('nav_login')}
                            </button>
                            <button
                                onClick={() => navigate('/register-page')}
                                className="hidden sm:block text-sm font-medium text-white bg-[#1392ec] hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors shadow-sm hover:shadow-md"
                            >
                                {t('nav_signup')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
