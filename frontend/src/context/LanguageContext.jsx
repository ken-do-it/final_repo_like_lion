import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../constants/translations';
/* eslint-disable react-refresh/only-export-components */

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('English');

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
