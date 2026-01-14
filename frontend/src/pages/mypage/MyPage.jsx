import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../api/axios';

const MyPage = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('profile'); // profile, preferences, saved, reviews

    // Edit States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/users/profile/');
            setUser(response.data);
            setProfileForm(response.data);
        } catch (err) {
            console.error(err);
            // If unauthorized, redirect to login
            if (err.response?.status === 401) {
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
            setUser(prev => ({ ...prev, ...response.data }));
            setIsEditingProfile(false);
        } catch (err) {
            console.error("Update failed", err);
            alert("프로필 업데이트에 실패했습니다.");
        }
    };

    if (loading) return <Layout><div className="flex justify-center py-20">로딩 중...</div></Layout>;

    const renderProfile = () => (
        <div className="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold dark:text-white">내 정보</h3>
                {!isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                        프로필 수정
                    </Button>
                )}
            </div>

            {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <Input
                        id="nickname" label="닉네임"
                        value={profileForm.nickname || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="flex space-x-3 pt-2">
                        <Button type="submit">저장</Button>
                        <Button variant="ghost" onClick={() => { setIsEditingProfile(false); setProfileForm(user); }}>취소</Button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">아이디</span>
                            <span className="font-medium text-lg">{user?.username}</span>
                        </div>
                        <div className="p-4 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">이메일</span>
                            <span className="font-medium text-lg">{user?.email}</span>
                        </div>
                        <div className="p-4 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">닉네임</span>
                            <span className="font-medium text-lg">{user?.nickname}</span>
                        </div>
                        <div className="p-4 bg-white dark:bg-dark-surface rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="block text-xs text-gray-500 uppercase tracking-wide">위치</span>
                            <span className="font-medium text-lg">{user?.city}, {user?.country}</span>
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
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">언어: {user?.preferences?.language || 'en'}</span>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">통화: {user?.preferences?.currency || 'USD'}</span>
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
        <Layout>
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Sidebar */}
                    <div className="md:col-span-3">
                        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden sticky top-24">
                            <div className="p-6 text-center border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-primary/10 to-transparent">
                                <div className="w-24 h-24 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full mb-4 flex items-center justify-center">
                                    <span className="text-3xl">👤</span>
                                </div>
                                <h2 className="text-xl font-bold dark:text-white">{user?.nickname}</h2>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                            <nav className="p-2 space-y-1">
                                {['profile', 'shorts', 'schedules', 'columns', 'reservations', 'preferences', 'saved', 'reviews'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors
                                            ${activeTab === tab
                                                ? 'bg-primary text-white font-medium'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}
                                        `}
                                    >
                                        {tabNames[tab]}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="md:col-span-9">
                        <div className="bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm rounded-2xl p-6 sm:p-10 border border-gray-200 dark:border-gray-800 min-h-[500px]">
                            {activeTab === 'profile' && renderProfile()}
                            {activeTab === 'preferences' && renderPreferences()}
                            {activeTab === 'shorts' && (
                                <div className="text-center py-20 text-gray-500">
                                    <h3 className="text-xl font-bold dark:text-white mb-4">내 쇼츠</h3>
                                    <p>업로드한 쇼츠 영상이 여기에 표시됩니다.</p>
                                </div>
                            )}
                            {activeTab === 'schedules' && (
                                <div className="text-center py-20 text-gray-500">
                                    <h3 className="text-xl font-bold dark:text-white mb-4">내 일정</h3>
                                    <p>생성한 여행 일정을 확인하고 관리하세요.</p>
                                    <Button className="mt-4">새 일정 만들기</Button>
                                </div>
                            )}
                            {activeTab === 'columns' && (
                                <div className="text-center py-20 text-gray-500">
                                    <h3 className="text-xl font-bold dark:text-white mb-4">내 칼럼</h3>
                                    <p>작성한 칼럼과 댓글 내역을 확인할 수 있습니다.</p>
                                </div>
                            )}
                            {activeTab === 'reservations' && (
                                <div className="text-center py-20 text-gray-500">
                                    <h3 className="text-xl font-bold dark:text-white mb-4">내 예약</h3>
                                    <p className="mb-4">항공권 예약 내역을 확인하세요.</p>
                                    <p className="text-sm">(숙박 및 기타 예약 기능은 추후 제공될 예정입니다)</p>
                                </div>
                            )}
                            {activeTab === 'saved' && <div className="text-center py-20 text-gray-500">저장한 장소 기능 준비 중입니다.</div>}
                            {activeTab === 'reviews' && <div className="text-center py-20 text-gray-500">내 리뷰 기능 준비 중입니다.</div>}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MyPage;
