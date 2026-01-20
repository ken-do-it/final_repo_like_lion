import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const MyPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated, logout } = useAuth();
    const { t, language } = useLanguage();
    const [loading, setLoading] = useState(true);

    // URL 파라미터에서 탭 초기값 설정 (예: /mypage?tab=reservations)
    const initialTab = searchParams.get('tab') || 'profile';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Edit States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});

    // Local state for full profile data
    const [detailedUser, setDetailedUser] = useState(null);

    // My Shorts State
    const [myShorts, setMyShorts] = useState([]);
    const [shortsLoading, setShortsLoading] = useState(false);

    // My Reservations State
    const [reservations, setReservations] = useState([]);
    const [reservationsLoading, setReservationsLoading] = useState(false);

    // Reservation Detail Modal State
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [reservationDetail, setReservationDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);

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
        if (activeTab === 'reservations') {
            fetchReservations();
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

    const fetchReservations = async () => {
        setReservationsLoading(true);
        try {
            const response = await api.get('/v1/my/reservations/');
            setReservations(response.data.items || []);
        } catch (err) {
            console.error("Failed to fetch reservations", err);
        } finally {
            setReservationsLoading(false);
        }
    };

    const fetchReservationDetail = async (reservationId) => {
        setDetailLoading(true);
        try {
            const response = await api.get(`/v1/my/reservations/${reservationId}/`);
            setReservationDetail(response.data);
            setShowDetailModal(true);
        } catch (err) {
            console.error("Failed to fetch reservation detail", err);
            alert('예약 상세 정보를 불러오는데 실패했습니다.');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleReservationClick = (reservation) => {
        setSelectedReservation(reservation);
        fetchReservationDetail(reservation.reservationId);
    };

    const closeDetailModal = () => {
        setShowDetailModal(false);
        setReservationDetail(null);
        setSelectedReservation(null);
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

    const renderReservations = () => {
        if (reservationsLoading) return <div className="text-center py-20">{t('loading')}</div>;

        if (!reservations || reservations.length === 0) return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-4xl">✈️</div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('no_reservations') || 'No Reservations Yet'}</h3>
                <p className="mb-6">{t('no_reservations_desc') || 'Book your first flight to explore Korea!'}</p>
                <Button
                    onClick={() => navigate('/reservations/flights')}
                    className="bg-[#1392ec] hover:bg-blue-600 rounded-lg px-6"
                >
                    ✈️ {t('search_flights') || 'Search Flights'}
                </Button>
            </div>
        );

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {t('my_reservations') || 'My Reservations'} ({reservations.length})
                    </h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/reservations/flights')}
                        className="rounded-lg"
                    >
                        + {t('new_reservation') || 'New Booking'}
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {reservations.map(reservation => (
                        <div
                            key={reservation.reservationId}
                            onClick={() => handleReservationClick(reservation)}
                            className="p-5 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800/60 dark:to-blue-900/20 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                                        {reservation.type === 'FLIGHT' ? '✈️' : reservation.type === 'TRAIN' ? '🚄' : '🚇'}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{reservation.title}</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {new Date(reservation.startAt).toLocaleDateString('ko-KR', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${reservation.status === 'CONFIRMED_TEST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            reservation.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                reservation.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                        }`}>
                                        {reservation.status === 'CONFIRMED_TEST' ? '✓ Confirmed' :
                                            reservation.status === 'PENDING' ? '⏳ Pending' :
                                                reservation.status === 'CANCELLED' ? '✕ Cancelled' : reservation.status}
                                    </span>
                                    <p className="mt-2 font-bold text-lg text-[#1392ec]">
                                        {Number(reservation.totalAmount).toLocaleString()} {reservation.currency}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                                <span>Order: {reservation.testOrderNo}</span>
                                <span>{new Date(reservation.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

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
                            {activeTab === 'reservations' && renderReservations()}

                            {/* Placeholders for others */}
                            {['schedules', 'columns', 'saved', 'reviews'].includes(activeTab) && (
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

            {/* Reservation Detail Modal */}
            {showDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetailModal}>
                    <div
                        className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white dark:bg-[#1e2b36] border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">예약 상세</h2>
                            <button
                                onClick={closeDetailModal}
                                className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {detailLoading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1392ec] mx-auto mb-4"></div>
                                    <p className="text-slate-500">불러오는 중...</p>
                                </div>
                            ) : reservationDetail ? (
                                <div className="space-y-6">
                                    {/* 기본 예약 정보 */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                                                {reservationDetail.reservation?.type === 'FLIGHT' ? '✈️' : '🚄'}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {reservationDetail.reservation?.title}
                                                </h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    주문번호: {reservationDetail.reservation?.testOrderNo}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400">상태</span>
                                                <p className="font-semibold text-green-600 dark:text-green-400">
                                                    {reservationDetail.reservation?.status === 'CONFIRMED_TEST' ? '확정됨' : reservationDetail.reservation?.status}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400">결제 금액</span>
                                                <p className="font-bold text-[#1392ec]">
                                                    {Number(reservationDetail.reservation?.totalAmount).toLocaleString()} {reservationDetail.reservation?.currency}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400">출발 일시</span>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {reservationDetail.reservation?.startAt && new Date(reservationDetail.reservation.startAt).toLocaleString('ko-KR')}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400">예약 일시</span>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {reservationDetail.reservation?.createdAt && new Date(reservationDetail.reservation.createdAt).toLocaleString('ko-KR')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 항공편 상세 */}
                                    {reservationDetail.flightDetail && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5">
                                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">항공편 정보</h4>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">여정</span>
                                                    <p className="font-medium">{reservationDetail.flightDetail.tripType === 'ONEWAY' ? '편도' : '왕복'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">좌석 등급</span>
                                                    <p className="font-medium">{reservationDetail.flightDetail.cabinClass}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">인원</span>
                                                    <p className="font-medium">
                                                        성인 {reservationDetail.flightDetail.adults}명
                                                        {reservationDetail.flightDetail.children > 0 && `, 아동 ${reservationDetail.flightDetail.children}명`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 구간 정보 */}
                                    {reservationDetail.segments && reservationDetail.segments.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">비행 구간</h4>
                                            <div className="space-y-3">
                                                {reservationDetail.segments.map((seg, idx) => (
                                                    <div key={seg.id || idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-center">
                                                                <p className="text-lg font-bold text-slate-900 dark:text-white">{seg.depAirport}</p>
                                                                <p className="text-sm text-slate-500">
                                                                    {seg.depAt && new Date(seg.depAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                            <div className="flex-1 px-4">
                                                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                                                    <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
                                                                    <span className="text-xs">{seg.durationMin}분</span>
                                                                    <div className="flex-1 h-px bg-slate-300 dark:bg-slate-600"></div>
                                                                </div>
                                                                <p className="text-center text-xs text-slate-500 mt-1">
                                                                    {seg.airlineCode} {seg.flightNo}
                                                                </p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-lg font-bold text-slate-900 dark:text-white">{seg.arrAirport}</p>
                                                                <p className="text-sm text-slate-500">
                                                                    {seg.arrAt && new Date(seg.arrAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 승객 정보 */}
                                    {reservationDetail.passengers && reservationDetail.passengers.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">승객 정보</h4>
                                            <div className="space-y-2">
                                                {reservationDetail.passengers.map((pax, idx) => (
                                                    <div key={pax.id || idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg">👤</span>
                                                            <div>
                                                                <p className="font-medium text-slate-900 dark:text-white">{pax.fullName}</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {pax.passengerType === 'ADT' ? '성인' : pax.passengerType === 'CHD' ? '아동' : '유아'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {pax.birthDate && (
                                                            <span className="text-sm text-slate-500">{pax.birthDate}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 좌석 정보 */}
                                    {reservationDetail.seats && reservationDetail.seats.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">좌석 정보</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {reservationDetail.seats.map((seat, idx) => (
                                                    <span key={seat.id || idx} className="px-3 py-1 bg-[#1392ec]/10 text-[#1392ec] rounded-lg text-sm font-medium">
                                                        {seat.seatNo || '미지정'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    정보를 불러올 수 없습니다.
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white dark:bg-[#1e2b36] border-t border-slate-200 dark:border-slate-700 p-4">
                            <Button
                                onClick={closeDetailModal}
                                className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"
                            >
                                닫기
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPage;
