import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../constants/translations';
/* eslint-disable react-refresh/only-export-components */

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const normalizeLanguage = useCallback((value) => {
        const map = {
            // Standard language codes
            en: 'English',
            ko: '한국어',
            ja: '日本語',
            jp: '日本語',
            zh: '中文',
            'zh-cn': '中文',
            'zh-tw': '中文',
            // Display codes (from Navbar)
            ENG: 'English',
            KOR: '한국어',
            JPN: '日本語',
            CHN: '中文',
            // API language codes (from backend)
            eng_Latn: 'English',
            kor_Hang: '한국어',
            jpn_Jpan: '日本語',
            zho_Hans: '中文',
            // Legacy broken encodings (just in case)
            'í•œêµ­ì–´': '한국어',
            'æ—¥æœ¬èªž': '日本語',
            'ä¸­æ–‡': '中文',
        };

        return map[value] || value;
    }, []);

    const [language, setLanguageState] = useState(() => {
        // Initialize from localStorage or default to 'English'
        const savedLanguage = localStorage.getItem('userLanguage');
        return savedLanguage ? normalizeLanguage(savedLanguage) : 'English';
    });

    const setLanguage = useCallback((value) => {
        const normalized = normalizeLanguage(value);
        setLanguageState(normalized);
        // Persist to localStorage so axios can access it
        localStorage.setItem('userLanguage', normalized);
    }, [normalizeLanguage]);

    // Helper: Translate key based on current language
    const t = useCallback((key, params = {}) => {
        const langData = translations[language] || translations['English'];
        let text = langData[key] || translations['English'][key] || key;

        if (params && typeof params === 'object') {
            Object.keys(params).forEach(param => {
                text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
            });
        }
        return text;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
