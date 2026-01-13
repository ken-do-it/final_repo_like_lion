import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Navbar = ({ toggleSidebar, toggleTheme, isDarkMode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { language, setLanguage, t } = useLanguage();

    // ... existing code ...

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#101a22]/95 backdrop-blur-md transition-colors">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

                {/* 1. Left Logo section */}
                <div className="flex items-center gap-2">
                    {/* Mobile menu button */}
                    <button
                        type="button"
                        className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={toggleSidebar}
                    >
                        <span className="sr-only">Open menu</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate('/')}
                    >
                        <div className="flex items-center justify-center size-8 rounded-lg bg-[#1392ec] text-white font-bold text-xl">
                            T
                        </div>
                        <span className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#f1f5f9] hidden sm:block">
                            Tripko
                        </span>
                    </div>

                    {/* Dark/Light Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-center p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Toggle Dark Mode"
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                </div>

                {/* 2. Center Navigation Links (Desktop) */}
                <div className="hidden lg:flex items-center gap-8">
                    <button onClick={() => navigate('/')} className={`text-sm font-medium transition-colors hover:text-blue-500 ${location.pathname === '/' ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t('nav_home')}
                    </button>
                    <button onClick={() => navigate('/shorts')} className={`text-sm font-medium transition-colors hover:text-blue-500 ${location.pathname.startsWith('/shorts') ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t('nav_shorts')}
                    </button>
                    <button onClick={() => navigate('/game')} className={`text-sm font-medium transition-colors hover:text-blue-500 ${location.pathname === '/game' ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t('nav_game')}
                    </button>
                    <button onClick={() => navigate('/stays')} className={`text-sm font-medium transition-colors hover:text-blue-500 ${location.pathname === '/stays' ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`}>
                        {t('nav_stays')}
                    </button>
                </div>

                {/* 3. Right Profile / Actions */}
                <div className="flex items-center gap-4">
                    {/* Language Selector */}
                    <div className="relative">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="appearance-none bg-transparent font-bold text-sm text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white cursor-pointer outline-none pr-4"
                        >
                            <option>English</option>
                            <option>한국어</option>
                            <option>日本語</option>
                            <option>中文</option>
                        </select>
                        {/* Custom arrow if needed, but simple select is functional */}
                    </div>

                    <button className="hidden sm:block text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white">
                        {t('nav_mytrips')}
                    </button>
                    <div className="size-9 rounded-full bg-gray-200 dark:bg-gray-700 ring-2 ring-white dark:ring-[#1e2b36] overflow-hidden cursor-pointer hover:ring-[#1392ec] transition-all">
                        {/* Placeholder Avatar */}
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-400 to-[#1392ec] text-white font-bold text-xs">
                            JS
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
