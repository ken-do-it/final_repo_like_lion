import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../ui/Button';

const Layout = ({ children }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Placeholder login state - replace with context or reliable auth check later
    const isLoggedIn = !!localStorage.getItem('access_token');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        navigate('/login-page');
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f6f7f8] dark:bg-[#101a22] transition-colors duration-200">
            {/* Navbar */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#1e2b36]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="text-2xl font-bold text-primary tracking-tight">
                        Tripko
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-8">
                        <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-primary font-medium">홈</Link>
                        <Link to="/search" className="text-gray-600 dark:text-gray-300 hover:text-primary font-medium">검색</Link>
                        {/* Add more links as needed */}
                    </nav>

                    {/* Right Side / Auth Buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        {isLoggedIn ? (
                            <div className="flex items-center space-x-4">
                                <Link to="/mypage">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                                        {/* Placeholder Avatar */}
                                        <svg className="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                </Link>
                                <Button variant="ghost" size="sm" onClick={handleLogout}>로그아웃</Button>
                            </div>
                        ) : (
                            <>
                                <Link to="/login-page">
                                    <Button variant="ghost" size="sm">로그인</Button>
                                </Link>
                                <Link to="/register-page">
                                    <Button variant="primary" size="sm">회원가입</Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button (Hamburger) */}
                    <button
                        className="md:hidden p-2 text-gray-600 dark:text-gray-300"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden bg-white dark:bg-[#1e2b36] border-b border-gray-200 dark:border-gray-700 px-4 py-4 space-y-4 shadow-lg absolute w-full">
                        <Link to="/" className="block text-gray-700 dark:text-gray-200 py-2">홈</Link>
                        <Link to="/search" className="block text-gray-700 dark:text-gray-200 py-2">검색</Link>
                        <hr className="border-gray-200 dark:border-gray-700" />
                        {isLoggedIn ? (
                            <>
                                <Link to="/mypage" className="block text-gray-700 dark:text-gray-200 py-2">마이페이지</Link>
                                <button onClick={handleLogout} className="block w-full text-left text-red-500 py-2">로그아웃</button>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Link to="/login-page" className="block"><Button fullWidth variant="ghost">로그인</Button></Link>
                                <Link to="/register-page" className="block"><Button fullWidth variant="primary">회원가입</Button></Link>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-grow">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#1e2b36] border-t border-gray-200 dark:border-gray-700 py-8 mt-12">
                <div className="container mx-auto px-4 text-center text-gray-500 dark:text-gray-400">
                    <p className="mb-2">&copy; {new Date().getFullYear()} Tripko. All rights reserved.</p>
                    <div className="space-x-4 text-sm">
                        <a href="#" className="hover:text-primary">Privacy Policy</a>
                        <a href="#" className="hover:text-primary">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
