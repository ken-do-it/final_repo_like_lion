import React from 'react';

const AntiTestPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#101a22] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
            {/* Header Section */}
            <header className="bg-white dark:bg-[#1e2b36] shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 max-w-screen-xl h-16 flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[#1392ec] to-blue-500 bg-clip-text text-transparent">
                        Anti Test Project
                    </h1>
                    <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <a href="#" className="hover:text-[#1392ec] transition-colors">Home</a>
                        <a href="#" className="hover:text-[#1392ec] transition-colors">Features</a>
                        <a href="#" className="hover:text-[#1392ec] transition-colors">About</a>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 max-w-screen-xl py-12">

                {/* Hero Section */}
                <section className="mb-16 text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Welcome to the <br />
                        <span className="text-[#1392ec]">New Experience</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                        This is a newly created page to demonstrate a responsive, modern, and premium design using React and Tailwind CSS.
                    </p>
                    <button className="px-8 py-3 bg-[#1392ec] hover:bg-blue-600 text-white font-semibold rounded-full shadow-lg transform hover:scale-105 transition-all duration-300">
                        Get Started
                    </button>
                </section>

                {/* Content Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Card 1 */}
                    <div className="bg-white dark:bg-[#1e2b36] p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-[#1392ec] text-2xl">
                            ✨
                        </div>
                        <h3 className="text-xl font-bold mb-2">Modern Design</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Clean lines, ample whitespace, and a focus on typography ensure a reading experience that is second to none.
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-white dark:bg-[#1e2b36] p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-[#1392ec] text-2xl">
                            🚀
                        </div>
                        <h3 className="text-xl font-bold mb-2">Fast Performance</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Optimized for speed with lightweight components and efficient rendering strategies.
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-white dark:bg-[#1e2b36] p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 text-[#1392ec] text-2xl">
                            📱
                        </div>
                        <h3 className="text-xl font-bold mb-2">Fully Responsive</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Looks great on all devices, from large desktop monitors to the smallest mobile screens.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AntiTestPage;
