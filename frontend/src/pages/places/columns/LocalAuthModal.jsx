import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { placesAxios as api } from '../../../api/axios';
import Button from '../../../components/ui/Button';

const LocalAuthModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');
    const [badgeData, setBadgeData] = useState(null);

    if (!isOpen) return null;

    const handleAuthenticate = () => {
        setStatus('loading');
        setMessage('위치 정보를 가져오는 중입니다...');

        if (!navigator.geolocation) {
            setStatus('error');
            setMessage('브라우저가 위치 정보를 지원하지 않습니다.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    setMessage('인증 서버와 통신 중입니다...');

                    const response = await api.post('/places/local-badge/authenticate', {
                        latitude,
                        longitude
                    });

                    setBadgeData(response.data);
                    setStatus('success');
                    setMessage(response.data.message || '인증에 성공했습니다!');
                } catch (error) {
                    console.error('Authentication failed:', error);
                    setStatus('error');
                    if (error.response?.data?.detail) {
                        setMessage(error.response.data.detail);
                    } else {
                        setMessage('인증 중 오류가 발생했습니다.');
                    }
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                setStatus('error');
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setMessage('위치 정보 제공을 허용해주세요.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setMessage('위치 정보를 사용할 수 없습니다.');
                        break;
                    case error.TIMEOUT:
                        setMessage('위치 정보 요청 시간이 초과되었습니다.');
                        break;
                    default:
                        setMessage('위치 정보를 가져오는데 실패했습니다.');
                }
            }
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-[#1e2b36] rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all animate-fade-in-up">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    ✕
                </button>

                <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-3xl">
                        {status === 'success' ? '🏅' : '📍'}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        현지인 인증
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                        {status === 'idle' && '현재 위치를 기반으로 현지인 뱃지를 획득하세요!'}
                        {status === 'loading' && message}
                        {status === 'error' && <span className="text-red-500">{message}</span>}
                        {status === 'success' && (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                                {message}
                                <br />
                                <span className="text-xs text-gray-400 mt-1 block">
                                    {badgeData?.city} (Lv.{badgeData?.level})
                                </span>
                            </span>
                        )}
                    </p>

                    <div className="flex gap-2 justify-center">
                        {status !== 'success' && (
                            <Button
                                onClick={handleAuthenticate}
                                isLoading={status === 'loading'}
                                className="w-full bg-[#1392ec] hover:bg-blue-600 text-white"
                            >
                                내 위치로 인증하기
                            </Button>
                        )}
                        {status === 'success' && (
                            <Button
                                onClick={onClose}
                                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                            >
                                닫기
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocalAuthModal;
