import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../constants/translations';
/* eslint-disable react-refresh/only-export-components */

const LanguageContext = createContext();

// 도시명 번역 매핑
const CITY_TRANSLATIONS = {
    '서울': { 'English': 'Seoul', '한국어': '서울', '日本語': 'ソウル', '中文': '首尔' },
    '부산': { 'English': 'Busan', '한국어': '부산', '日本語': '釜山', '中文': '釜山' },
    '대전': { 'English': 'Daejeon', '한국어': '대전', '日本語': '大田', '中文': '大田' },
    '대구': { 'English': 'Daegu', '한국어': '대구', '日本語': '大邱', '中文': '大邱' },
    '인천': { 'English': 'Incheon', '한국어': '인천', '日本語': '仁川', '中文': '仁川' },
    '광주': { 'English': 'Gwangju', '한국어': '광주', '日本語': '光州', '中文': '光州' },
    '울산': { 'English': 'Ulsan', '한국어': '울산', '日本語': '蔚山', '中文': '蔚山' },
    '제주': { 'English': 'Jeju', '한국어': '제주', '日本語': '済州', '中文': '济州' },
    '수원': { 'English': 'Suwon', '한국어': '수원', '日本語': '水原', '中文': '水原' },
    '경주': { 'English': 'Gyeongju', '한국어': '경주', '日本語': '慶州', '中文': '庆州' },
    '전주': { 'English': 'Jeonju', '한국어': '전주', '日本語': '全州', '中文': '全州' },
    '강릉': { 'English': 'Gangneung', '한국어': '강릉', '日本語': '江陵', '中文': '江陵' },
    '속초': { 'English': 'Sokcho', '한국어': '속초', '日本語': '束草', '中文': '束草' },
    '여수': { 'English': 'Yeosu', '한국어': '여수', '日本語': '麗水', '中文': '丽水' },
    '춘천': { 'English': 'Chuncheon', '한국어': '춘천', '日本語': '春川', '中文': '春川' },
    '천안': { 'English': 'Cheonan', '한국어': '천안', '日本語': '天安', '中文': '天安' },
    '청주': { 'English': 'Cheongju', '한국어': '청주', '日本語': '清州', '中文': '清州' },
    '포항': { 'English': 'Pohang', '한국어': '포항', '日本語': '浦項', '中文': '浦项' },
    '창원': { 'English': 'Changwon', '한국어': '창원', '日本語': '昌原', '中文': '昌原' },
    '안동': { 'English': 'Andong', '한국어': '안동', '日本語': '安東', '中文': '安东' },
    '목포': { 'English': 'Mokpo', '한국어': '목포', '日本語': '木浦', '中文': '木浦' },
    '순천': { 'English': 'Suncheon', '한국어': '순천', '日本語': '順天', '中文': '顺天' },
    '군산': { 'English': 'Gunsan', '한국어': '군산', '日本語': '群山', '中文': '群山' },
    '익산': { 'English': 'Iksan', '한국어': '익산', '日本語': '益山', '中文': '益山' },
    '세종': { 'English': 'Sejong', '한국어': '세종', '日本語': '世宗', '中文': '世宗' },
    '가평': { 'English': 'Gapyeong', '한국어': '가평', '日本語': '加平', '中文': '加平' },
    '양평': { 'English': 'Yangpyeong', '한국어': '양평', '日本語': '楊平', '中文': '杨平' },
    '태안': { 'English': 'Taean', '한국어': '태안', '日本語': '泰安', '中文': '泰安' },
    '홍천': { 'English': 'Hongcheon', '한국어': '홍천', '日本語': '洪川', '中文': '洪川' },
};

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

    // Helper: Translate city name (Korean to target language)
    const translateCity = useCallback((cityName) => {
        if (!cityName) return cityName;
        const cityData = CITY_TRANSLATIONS[cityName];
        if (cityData && cityData[language]) {
            return cityData[language];
        }
        return cityName; // Return original if no translation found
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, translateCity }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
