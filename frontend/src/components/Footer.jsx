import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
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
                            Discover the best of Korea with AI-powered itineraries and local insights.
                        </p>
                    </div>

                    {/* Links Column 1 */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Explore</h3>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <li><Link to="/search" className="hover:text-[#1392ec] transition-colors">Destinations</Link></li>
                            <li><Link to="/shorts" className="hover:text-[#1392ec] transition-colors">Trending Shorts</Link></li>
                            <li><Link to="/accommodations" className="hover:text-[#1392ec] transition-colors">Hotels</Link></li>
                        </ul>
                    </div>

                    {/* Links Column 2 */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Company</h3>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                            <li><Link to="/about" className="hover:text-[#1392ec] transition-colors">About Us</Link></li>
                            <li><Link to="/contact" className="hover:text-[#1392ec] transition-colors">Contact</Link></li>
                            <li><Link to="/terms" className="hover:text-[#1392ec] transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>

                    {/* Social / Newsletter */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Stay Updated</h3>
                        <div className="flex gap-4">
                            {/* Social Icons Placeholder */}
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">Instagram</a>
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">Twitter</a>
                            <a href="#" className="text-gray-400 hover:text-[#1392ec] transition-colors">YouTube</a>
                        </div>
                    </div>
                </div>
                <div className="mt-12 border-t border-gray-100 dark:border-gray-800 pt-8 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Tripko Inc. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
