import React, { useState } from 'react';
// [Team Convention] Stitch Design System
import './App.css';
// import './App_test_stitch.css';

/**
 * [Team Reference] App_test.jsx
 * 
 * Stitch Design System이 적용된 "Travel Dashboard" 예시 페이지입니다.
 * 팀 프로젝트의 메인 대시보드 구조를 잡을 때 참고하세요.
 */
function App_test() {
    const [activeTab, setActiveTab] = useState('All');

    return (
        <div className="app-container">
            {/* 1. Navigation Bar */}
            <nav className="navbar">
                <div className="navbar-inner">
                    <div className="logo-area">
                        <div className="logo-icon">
                            <span className="material-symbols-outlined">flight_takeoff</span>
                        </div>
                        <span>Trippr</span>
                    </div>

                    <div className="hidden md:flex gap-8 font-medium">
                        <a href="#" className="text-primary font-bold">Home</a>
                        <a href="#" className="text-muted hover:text-primary">Trips</a>
                        <a href="#" className="text-muted hover:text-primary">Saved</a>
                        <a href="#" className="text-muted hover:text-primary">Profile</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="btn-icon">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200">
                            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="Profile" />
                        </div>
                    </div>
                </div>
            </nav>

            {/* 2. Main Content */}
            <main className="content-wrapper">

                {/* Hero Section */}
                <section className="text-center py-12 space-y-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-main">
                        Where to next?
                    </h1>

                    {/* Search Bar */}
                    <div className="max-w-2xl mx-auto relative flex items-center h-16 rounded-2xl bg-card shadow-soft ring-1 ring-slate-100 focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                        <div className="pl-6 pr-4 text-muted">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Search destinations, flights, hotels..."
                            className="w-full h-full bg-transparent border-none outline-none text-lg"
                        />
                        <button className="btn-primary mr-2">Search</button>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex gap-3 justify-center flex-wrap">
                        {['All', 'Destinations', 'Flights', 'Hotels'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all ${activeTab === tab
                                    ? 'bg-primary text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-card text-muted border border-slate-200 hover:border-primary hover:text-primary'
                                    }`}
                            >
                                {tab === 'All' && <span className="material-symbols-outlined text-[20px]">grid_view</span>}
                                {tab === 'Destinations' && <span className="material-symbols-outlined text-[20px]">public</span>}
                                {tab === 'Flights' && <span className="material-symbols-outlined text-[20px]">flight</span>}
                                {tab === 'Hotels' && <span className="material-symbols-outlined text-[20px]">hotel</span>}
                                <span>{tab}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Quick Actions Grid */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-16">
                    {[
                        { icon: 'airplane_ticket', label: 'Book Flight', color: 'text-blue-500', bg: 'bg-blue-50' },
                        { icon: 'bed', label: 'Find Stays', color: 'text-orange-500', bg: 'bg-orange-50' },
                        { icon: 'directions_car', label: 'Rentals', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { icon: 'local_activity', label: 'Activities', color: 'text-purple-500', bg: 'bg-purple-50' },
                    ].map((item) => (
                        <div key={item.label} className="card p-4 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-all group">
                            <div className={`w-12 h-12 rounded-full ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <span className="material-symbols-outlined">{item.icon}</span>
                            </div>
                            <span className="font-semibold text-sm text-main">{item.label}</span>
                        </div>
                    ))}
                </section>

                {/* Upcoming Adventure */}
                <section className="max-w-5xl mx-auto w-full mb-16">
                    <div className="flex justify-between items-end mb-6">
                        <h2 className="text-2xl font-bold">Upcoming Adventure</h2>
                        <a href="#" className="text-primary font-bold text-sm hover:underline">View all trips</a>
                    </div>

                    <div className="card flex flex-col md:flex-row">
                        <div className="w-full md:w-2/5 h-64 md:h-auto relative card-image-container">
                            <img src="https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1000&auto=format&fit=crop" alt="Tokyo" />
                            <div className="absolute top-4 left-4">
                                <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    In 12 days
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-8 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold mb-1">Tokyo, Japan</h3>
                                    <p className="text-muted flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-lg">calendar_month</span>
                                        Nov 12 - Nov 20, 2024
                                    </p>
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="flex items-center gap-2 text-main">
                                        <span className="material-symbols-outlined text-amber-500">sunny</span>
                                        <span className="font-bold text-lg">14°C</span>
                                    </div>
                                    <p className="text-muted text-sm">Partly Cloudy</p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined">flight_takeoff</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">Flight to HND</p>
                                        <p className="text-xs text-muted">JL 005 • 10:45 AM</p>
                                    </div>
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Confirmed</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined">hotel</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">Shibuya Stream Excel</p>
                                        <p className="text-xs text-muted">Check-in • 03:00 PM</p>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full mt-8 btn-primary">View Itinerary</button>
                        </div>
                    </div>
                </section>

                {/* Recommended Cities */}
                <section className="max-w-7xl mx-auto w-full pb-12">
                    <div className="flex justify-between items-center mb-6 px-2">
                        <h2 className="text-2xl font-bold">Recommended Cities</h2>
                        <div className="flex gap-2">
                            <button className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-50"><span className="material-symbols-outlined text-sm">arrow_back</span></button>
                            <button className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-50"><span className="material-symbols-outlined text-sm">arrow_forward</span></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { title: 'Kyoto', country: 'Japan', price: '$1,200', img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop' },
                            { title: 'Paris', country: 'France', price: '$1,850', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop' },
                            { title: 'New York', country: 'USA', price: '$2,100', img: 'https://images.unsplash.com/photo-1496442226666-8d4a0e62e6e9?q=80&w=800&auto=format&fit=crop' },
                            { title: 'Dubai', country: 'UAE', price: '$1,950', img: 'https://images.unsplash.com/photo-1512453979798-5ea936a79405?q=80&w=800&auto=format&fit=crop' },
                        ].map((city) => (
                            <div key={city.title} className="card h-[400px] cursor-pointer group relative">
                                <div className="card-image-container h-full">
                                    <img src={city.img} alt={city.title} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                                    <div className="absolute bottom-0 left-0 p-6 w-full text-white">
                                        <h3 className="text-2xl font-bold mb-1">{city.title}</h3>
                                        <div className="flex items-center gap-1 text-white/80 text-sm mb-3">
                                            <span className="material-symbols-outlined text-base">location_on</span>
                                            {city.country}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="flex items-center gap-1 text-sm font-bold"><span className="text-yellow-400 material-symbols-outlined text-sm">star</span> 4.9</span>
                                            <span className="font-bold text-lg">{city.price}<span className="text-xs font-normal opacity-70">/trip</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default App_test;
