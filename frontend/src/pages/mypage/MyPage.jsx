import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const MyPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const { t, language } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('profile');

    // Edit States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});

    // Local state for full profile data
    const [detailedUser, setDetailedUser] = useState(null);

    // My Shorts State
    const [myShorts, setMyShorts] = useState([]);
    const [shortsLoading, setShortsLoading] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            // handled by AuthProvider mostly, but safe guard
        }
        fetchProfile();
    }, [isAuthenticated]);

    useEffect(() => {
        if (activeTab === 'shorts') {
            fetchMyShorts();
        }
    }, [activeTab, language]);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/users/profile/');
            setDetailedUser(response.data);
            setProfileForm(response.data);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                logout();
                navigate('/login-page');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMyShorts = async () => {
        setShortsLoading(true);
        try {
            // Using the new filter 'writer=me' and language parameter
            const langCode = API_LANG_CODES[language] || 'eng_Latn';
            const response = await api.get(`/shortforms/?writer=me&lang=${langCode}`);
            // Check if response.data is pagination object or list
            const data = response.data.results ? response.data.results : response.data;
            setMyShorts(data);
        } catch (err) {
            console.error("Failed to fetch shorts", err);
        } finally {
            setShortsLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put('/users/profile/', {
                nickname: profileForm.nickname,
                country: profileForm.country,
                city: profileForm.city,
                phone_number: profileForm.phone_number
            });
            setDetailedUser(prev => ({ ...prev, ...response.data }));
            setProfileForm(response.data);
            setIsEditingProfile(false);
        } catch (err) {
            console.error("Update failed", err);
            alert("Failed to update profile.");
        }
    };

    if (loading) return <div className="flex justify-center py-20">{t('loading')}</div>;

    const displayUser = detailedUser || user;

    const renderProfile = () => (
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t('profile_basic')}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('profile_basic_desc')}</p>
                </div>
                {!isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)} className="rounded-lg border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                        ✏️ {t('edit_btn')}
                    </Button>
                )}
            </div>

            {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <Input
                            id="nickname" label={t('nickname_label')}
                            value={profileForm.nickname || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-800/50"
                        />
                        <div className="grid grid-cols-2 gap-6">
                            <Input
                                id="country" label="Country"
                                value={profileForm.country || ''}
                                onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                            />
                            <Input
                                id="city" label="City"
                                value={profileForm.city || ''}
                                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                            />
                        </div>
                        <Input
                            id="phone_number" label={t('phone_label')}
                            value={profileForm.phone_number || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                        />
                    </div>
                    <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-6">
                        <Button type="submit" className="bg-[#1392ec] hover:bg-blue-600 rounded-lg px-6">{t('save_btn')}</Button>
                        <Button variant="ghost" className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" onClick={() => { setIsEditingProfile(false); setProfileForm(displayUser); }}>{t('cancel_btn')}</Button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors group">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('id_label')}</div>
                            <div className="text-lg font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {displayUser?.username}
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">ID</span>
                            </div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('email_label')}</div>
                            <div className="text-lg font-medium text-slate-900 dark:text-slate-100 break-all">{displayUser?.email}</div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('nickname_label')}</div>
                            <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{displayUser?.nickname}</div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('location_label')}</div>
                            <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                                {displayUser?.city && displayUser?.country ? `${displayUser.city}, ${displayUser.country}` : <span className="text-slate-400 italic">N/A</span>}
                            </div>
                        </div>
                    </div>

                    {/* Local Badge Section */}
                    <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            🏅 {t('local_badge_title') || '현지인 인증 뱃지'}
                        </h3>
                        {displayUser?.local_badges && displayUser.local_badges.filter(b => b.is_active).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {displayUser.local_badges.filter(b => b.is_active).map((badge) => (
                                    <div
                                        key={badge.id}
                                        className="relative p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-700/50 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="absolute top-3 right-3">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                                            ${badge.level >= 5 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                                                    badge.level >= 3 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                                                        'bg-gradient-to-br from-orange-300 to-orange-400 text-white'}`}
                                            >
                                                {badge.level}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="text-3xl">
                                                {badge.level >= 5 ? '🥇' : badge.level >= 3 ? '🥈' : '🥉'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-lg">{badge.city}</div>
                                                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                    Level {badge.level} {badge.level >= 3 ? '✍️ Writer' : '🔍 Explorer'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                            <div className="flex justify-between">
                                                <span>{t('badge_since') || '인증 시작'}:</span>
                                                <span className="font-medium">{badge.first_authenticated_at}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t('badge_months') || '유지 개월'}:</span>
                                                <span className="font-medium text-amber-600 dark:text-amber-400">{badge.maintenance_months}개월</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                <div className="text-4xl mb-3">🗺️</div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    {t('no_local_badge') || '아직 현지인 인증 뱃지가 없습니다.'}
                                </p>
                                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                                    {t('no_local_badge_desc') || '현지에서 일정 기간 거주하면 뱃지를 획득할 수 있어요!'}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    const renderMyShorts = () => {
        if (shortsLoading) return <div className="text-center py-20">{t('loading')}</div>;
        if (!myShorts || myShorts.length === 0) return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-4xl">🎬</div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('no_shorts')}</h3>
                <p>Upload your first short video!</p>
            </div>
        );

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myShorts.map(short => (
                    <div key={short.id}
                        onClick={() => navigate(`/shorts/${short.id}`)}
                        className="relative aspect-[9/16] rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                        <img
                            src={short.thumbnail_url || 'https://via.placeholder.com/300x533?text=No+Thumbnail'}
                            alt={short.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <button className="bg-white/20 backdrop-blur-md rounded-full p-3 text-white">
                                ▶
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                            <h4 className="font-semibold text-sm truncate">{short.title_translated || short.title}</h4>
                            <div className="flex justify-between text-xs text-white/80 mt-1">
                                <span>👀 {short.total_views}</span>
                                <span>❤️ {short.total_likes}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderPreferences = () => (
        <div className="max-w-2xl">
            <h3 className="text-xl font-bold dark:text-white mb-6">{t('nav_settings')}</h3>
            <div className="p-6 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700 text-center text-gray-500">
                <p>Language and Currency settings.</p>
                <div className="mt-4 flex justify-center gap-4">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">Language: {displayUser?.preferences?.language || 'en'}</span>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">Currency: {displayUser?.preferences?.currency || 'USD'}</span>
                </div>
            </div>
        </div>
    );

    const tabList = [
        { id: 'profile', label: t('tab_profile'), icon: '👤' },
        { id: 'shorts', label: t('tab_shorts'), icon: '🎬' },
        { id: 'schedules', label: t('tab_schedules'), icon: '🗓️' },
        { id: 'columns', label: t('tab_columns'), icon: '✍️' },
        { id: 'reservations', label: t('tab_reservations'), icon: '✈️' },
        { id: 'preferences', label: t('tab_preferences'), icon: '⚙️' },
        { id: 'saved', label: t('tab_saved'), icon: '💾' },
        { id: 'reviews', label: t('tab_reviews'), icon: '⭐' },
    ];

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen transition-colors duration-300">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{t('mypage_title')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">{t('mypage_desc')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Sidebar */}
                    <div className="md:col-span-3">
                        <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-24">
                            <div className="p-8 flex flex-col items-center border-b border-slate-100 dark:border-slate-700">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mb-4 ring-4 ring-white dark:ring-[#1e2b36] shadow-lg">
                                    <span className="text-4xl">😎</span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{displayUser?.nickname || 'Traveler'}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{displayUser?.email}</p>
                            </div>
                            <nav className="p-3 space-y-1">
                                {tabList.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium flex items-center gap-3
                                            ${activeTab === tab.id
                                                ? 'bg-[#1392ec] text-white shadow-md shadow-blue-500/20 translate-x-1'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}
                                        `}
                                    >
                                        <span className="opacity-70">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="md:col-span-9">
                        <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-10 min-h-[600px]">
                            {activeTab === 'profile' && renderProfile()}
                            {activeTab === 'preferences' && renderPreferences()}
                            {activeTab === 'shorts' && renderMyShorts()}

                            {/* Placeholders for others */}
                            {['schedules', 'columns', 'reservations', 'saved', 'reviews'].includes(activeTab) && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-3xl">🚧</div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Coming Soon</h3>
                                    <p>Feature under development.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyPage;
