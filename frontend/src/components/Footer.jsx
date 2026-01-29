import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();

    return (
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101a22] transition-colors mt-auto">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    {/* Brand */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center size-8 rounded-lg bg-[#1392ec] text-white font-bold text-xl">
                                T
                            </div>
                            <span className="text-xl font-bold text-gray-900 dark:text-white">Tripko</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('footer_desc')}
                        </p>
                    </div>

                    {/* Links Column 1 */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('footer_explore')}</h3>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <li><Link to="/search" className="hover:text-[#1392ec] transition-colors">{t('footer_destinations')}</Link></li>
                            <li><Link to="/shorts" className="hover:text-[#1392ec] transition-colors">{t('footer_trending_shorts')}</Link></li>
                            <li><Link to="/accommodations" className="hover:text-[#1392ec] transition-colors">{t('footer_hotels')}</Link></li>
                        </ul>
                    </div>

                    {/* Links Column 2 */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('footer_company')}</h3>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <li><Link to="/about" className="hover:text-[#1392ec] transition-colors">{t('footer_about')}</Link></li>
                            <li><Link to="/contact" className="hover:text-[#1392ec] transition-colors">{t('footer_contact')}</Link></li>
                            <li><Link to="/terms" className="hover:text-[#1392ec] transition-colors">{t('footer_privacy')}</Link></li>
                        </ul>
                    </div>

                    {/* Social / Newsletter */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('footer_stay_updated')}</h3>
                        <div className="flex gap-4">
                            {/* Social Icons Placeholder */}
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">Instagram</a>
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">Twitter</a>
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">YouTube</a>
                        </div>
                    </div>
                </div>
                <div className="mt-12 border-t border-gray-100 dark:border-gray-800 pt-8 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} {t('footer_copyright')}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
