import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const menuItems = [
        { label: `🏠 ${t('nav_home')}`, path: '/' },
        { label: `📍 ${t('nav_places') || '장소'}`, path: '/places/search' },
        { label: `🏨 ${t('nav_stays')}`, path: '/stays' },
        { label: `📸 ${t('nav_geoquiz')}`, path: '/geo-quiz' },
        { label: `🎮 ${t('nav_game')}`, path: '/game' },
        { label: `📅 ${t('nav_ai_plan')}`, path: null }, // Placeholder
        { label: `🥘 ${t('nav_column')}`, path: null },
        { label: `🔥 ${t('nav_shorts')}`, path: '/shorts' },
        { label: `✈️ ${t('nav_ticket')}`, path: null },
    ];

    const bottomItems = [
        { label: `❤️ ${t('nav_likes')}`, path: null },
        { label: `⚙️ ${t('nav_settings')}`, path: null },
        { label: `📞 ${t('nav_support')}`, path: null },
        { label: `${t('nav_version')} v1.0`, path: null },
    ];

    const handleNavigation = (path) => {
        if (path) {
            navigate(path);
        }
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>

            {/* Sidebar Panel */}
            <aside
                className={`fixed top-0 left-0 h-full w-[280px] bg-white dark:bg-[#1e2b36] shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xl font-bold text-[#1392ec]">Korea Trip</span>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
                    <ul className="space-y-1">
                        {menuItems.map((item, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => handleNavigation(item.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-[#1392ec] transition-all font-medium"
                                >
                                    <span>{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="my-4 border-t border-gray-100 dark:border-gray-700 mx-2"></div>

                    <ul className="space-y-1">
                        {bottomItems.map((item, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => handleNavigation(item.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
                                >
                                    <span>{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer (Optional) */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-xs text-center text-gray-400">
                    © 2026 Tripko Platform
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
