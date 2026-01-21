import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext'; // Added
import { placesAxios as api } from '../../../api/axios';
import Button from '../../../components/ui/Button';

const LocalAuthModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { t } = useLanguage(); // Added
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');
    const [badgeData, setBadgeData] = useState(null);

    // 모달이 열리거나 사용자가 변경될 때 상태 초기화
    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setMessage('');
            setBadgeData(null);
        }
    }, [isOpen, user?.id]);

    if (!isOpen) return null;

    const handleAuthenticate = () => {
        setStatus('loading');
        setMessage(t('msg_loc_fetching'));

        if (!navigator.geolocation) {
            setStatus('error');
            setMessage(t('msg_loc_not_support'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    setMessage(t('msg_auth_checking'));

                    const response = await api.post('/places/local-badge/authenticate', {
                        latitude,
                        longitude
                    });

                    setBadgeData(response.data);
                    setStatus('success');
                    setMessage(response.data.message || t('msg_auth_success'));
                } catch (error) {
                    console.error('Authentication failed:', error);
                    setStatus('error');
                    if (error.response?.data?.detail) {
                        setMessage(error.response.data.detail);
                    } else {
                        setMessage(t('msg_auth_fail'));
                    }
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                setStatus('error');
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setMessage(t('msg_loc_perm_denied'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setMessage(t('msg_loc_unavailable'));
                        break;
                    case error.TIMEOUT:
                        setMessage(t('msg_loc_timeout'));
                        break;
                    default:
                        setMessage(t('msg_loc_fail'));
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
                        {t('auth_modal_title')}
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                        {status === 'idle' && t('auth_modal_desc')}
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
                                {t('btn_auth_my_loc')}
                            </Button>
                        )}
                        {status === 'success' && (
                            <Button
                                onClick={onClose}
                                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                            >
                                {t('btn_close')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocalAuthModal;
