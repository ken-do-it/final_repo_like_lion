import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ toggleSidebar, toggleTheme, isDarkMode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchInput, setSearchInput] = useState('');

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            navigate(`/search?query=${encodeURIComponent(searchInput)}`);
        }
    };

    // Helper to check active state
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#101a22]/95 backdrop-blur-md transition-colors">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

                {/* 1. Left: Hamburger + Logo */}
                <div className="flex items-center gap-4">
                    {/* Hamburger Button */}
                    <button
                        onClick={toggleSidebar}
                        className="hidden sm:flex items-center justify-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Open Menu"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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

                {/* 2. Center Menu / Search */}
                <div className="hidden md:flex flex-1 items-center justify-center px-8">
                    {/* Navigation Links */}
                    <div className="flex items-center gap-6 mr-8">
                        <button
                            onClick={() => navigate('/')}
                            className={`text-sm font-bold transition-colors ${isActive('/') ? 'text-[#1392ec]' : 'text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white'}`}
                        >
                            Home
                        </button>
                        <button
                            onClick={() => navigate('/stays')}
                            className={`text-sm font-bold transition-colors ${isActive('/stays') ? 'text-[#1392ec]' : 'text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white'}`}
                        >
                            Stays
                        </button>
                        <button
                            onClick={() => navigate('/geo-quiz')}
                            className={`text-sm font-bold transition-colors ${isActive('/geo-quiz') ? 'text-[#1392ec]' : 'text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white'}`}
                        >
                            GeoQuiz
                        </button>
                    </div>

                    {/* Search Bar - styled slightly smaller than hero search */}
                    <div className="relative w-full max-w-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-400">🔍</span>
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1e2b36] py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-[#1392ec] focus:bg-white dark:focus:bg-[#101a22] focus:outline-none focus:ring-1 focus:ring-[#1392ec] dark:text-white transition-all"
                            placeholder="Search..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={handleSearch}
                        />
                    </div>
                </div>

                {/* 3. Right Profile / Actions */}
                <div className="flex items-center gap-4">
                    <button className="hidden sm:block text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-[#111111] dark:hover:text-white">
                        My Trips
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
