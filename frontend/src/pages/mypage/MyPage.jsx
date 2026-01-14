import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const MyPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth(); // Use Global Auth
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('profile');

    // Edit States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});

    // Local state for full profile data (if detailed fields are needed beyond context)
    const [detailedUser, setDetailedUser] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            // If context says not logged in, redirect immediately
            // specific timing might need handling if auth check is async
        }
        fetchProfile();
    }, [isAuthenticated]);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/users/profile/');
            setDetailedUser(response.data);
            setProfileForm(response.data);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                logout(); // Sync context
                navigate('/login-page');
            }
        } finally {
            setLoading(false);
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
            // Update local state
            setDetailedUser(prev => ({ ...prev, ...response.data }));
            setProfileForm(response.data);

            // NOTE: Ideally, we should also update the global AuthContext user here if nickname changed
            // But for now, local update is sufficient for this page
            setIsEditingProfile(false);
        } catch (err) {
            console.error("Update failed", err);
            alert("프로필 업데이트에 실패했습니다.");
        }
    };

    if (loading) return <div className="flex justify-center py-20">로딩 중...</div>;

    // Use detailedUser for display as it has fresh data from API
    // Fallback to 'user' from context if needed
    const displayUser = detailedUser || user;

    const renderProfile = () => (
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-end mb-8 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">기본 정보</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">다른 사용자에게 공개되는 프로필 정보입니다.</p>
                </div>
                {!isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)} className="rounded-lg border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                        ✏️ 수정하기
                    </Button>
                )}
            </div>

            {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <Input
                            id="nickname" label="닉네임"
                            value={profileForm.nickname || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-800/50"
                        />
                        <div className="grid grid-cols-2 gap-6">
                            <Input
                                id="country" label="국가"
                                value={profileForm.country || ''}
                                onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                            />
                            <Input
                                id="city" label="도시"
                                value={profileForm.city || ''}
                                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                            />
                        </div>
                        <Input
                            id="phone_number" label="전화번호"
                            value={profileForm.phone_number || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                        />
                    </div>
                    <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-6">
                        <Button type="submit" className="bg-[#1392ec] hover:bg-blue-600 rounded-lg px-6">저장 완료</Button>
                        <Button variant="ghost" className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" onClick={() => { setIsEditingProfile(false); setProfileForm(displayUser); }}>취소</Button>
                    </div>
                </form>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors group">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">아이디</div>
                        <div className="text-lg font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {displayUser?.username}
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">ID</span>
                        </div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">이메일</div>
                        <div className="text-lg font-medium text-slate-900 dark:text-slate-100 break-all">{displayUser?.email}</div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">닉네임</div>
                        <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{displayUser?.nickname}</div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-[#1392ec]/30 transition-colors">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">위치</div>
                        <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                            {displayUser?.city && displayUser?.country ? `${displayUser.city}, ${displayUser.country}` : <span className="text-slate-400 italic">미설정</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderPreferences = () => (
        <div className="max-w-2xl">
            <h3 className="text-xl font-bold dark:text-white mb-6">설정</h3>
            <div className="p-6 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700 text-center text-gray-500">
                <p>언어 및 통화 설정은 곧 구현될 예정입니다.</p>
                <div className="mt-4 flex justify-center gap-4">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">언어: {displayUser?.preferences?.language || 'en'}</span>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">통화: {displayUser?.preferences?.currency || 'USD'}</span>
                </div>
            </div>
        </div>
    );

    const tabNames = {
        'profile': '내 정보',
        'shorts': '내 쇼츠',
        'schedules': '내 일정',
        'columns': '내 칼럼',
        'reservations': '내 예약',
        'preferences': '설정',
        'saved': '저장한 장소',
        'reviews': '내 리뷰'
    };

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen transition-colors duration-300">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">마이페이지</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">내 계정 정보와 활동을 관리하세요.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Sidebar */}
                    <div className="md:col-span-3">
                        <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-24">
                            <div className="p-8 flex flex-col items-center border-b border-slate-100 dark:border-slate-700">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mb-4 ring-4 ring-white dark:ring-[#1e2b36] shadow-lg">
                                    <span className="text-4xl">😎</span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{displayUser?.nickname || '여행자'}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{displayUser?.email}</p>
                            </div>
                            <nav className="p-3 space-y-1">
                                {['profile', 'shorts', 'schedules', 'columns', 'reservations', 'preferences', 'saved', 'reviews'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium flex items-center gap-3
                                            ${activeTab === tab
                                                ? 'bg-[#1392ec] text-white shadow-md shadow-blue-500/20 translate-x-1'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}
                                        `}
                                    >
                                        <span className="opacity-70">
                                            {tab === 'profile' && '👤'}
                                            {tab === 'shorts' && '🎬'}
                                            {tab === 'schedules' && '🗓️'}
                                            {tab === 'columns' && '✍️'}
                                            {tab === 'reservations' && '✈️'}
                                            {tab === 'preferences' && '⚙️'}
                                            {tab === 'saved' && '💾'}
                                            {tab === 'reviews' && '⭐'}
                                        </span>
                                        {tabNames[tab]}
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
                            {activeTab === 'shorts' && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-4xl">🎬</div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">내 쇼츠</h3>
                                    <p>업로드한 쇼츠 영상이 여기에 표시됩니다.</p>
                                </div>
                            )}
                            {activeTab === 'schedules' && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-4xl">🗓️</div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">내 일정</h3>
                                    <p className="mb-6">아직 생성된 일정이 없습니다.</p>
                                    <Button className="bg-[#1392ec] hover:bg-blue-600 text-white rounded-xl px-8">새 일정 만들기</Button>
                                </div>
                            )}
                            {activeTab === 'reservations' && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-4xl">✈️</div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">내 예약</h3>
                                    <p>항공권 예약 내역을 확인하세요.</p>
                                </div>
                            )}
                            {/* Generic placeholder for others */}
                            {['columns', 'saved', 'reviews'].includes(activeTab) && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-3xl">🚧</div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">준비 중</h3>
                                    <p>{tabNames[activeTab]} 기능은 곧 제공될 예정입니다.</p>
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
