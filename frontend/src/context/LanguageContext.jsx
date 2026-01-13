import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../constants/translations';
/* eslint-disable react-refresh/only-export-components */

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('English');

    // Helper: Translate key based on current language
    const t = useCallback((key) => {
        const langData = translations[language] || translations['English'];
        return langData[key] || translations['English'][key] || key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
