import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const SocialCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // 이미 처리 중이면 return
        if (isProcessing) return;

        const success = searchParams.get('success');

        if (success === 'true') {
            setIsProcessing(true);

            // 세션에서 토큰 가져오기 (URL에 노출하지 않음)
            const fetchSessionToken = async () => {
                try {
                    console.log("✅ [SocialCallback] Fetching tokens from session...");
                    const response = await api.get('/users/session-token/');

                    const { access_token, refresh_token, user } = response.data;

                    console.log("✅ [SocialCallback] Tokens received from session");
                    console.log("👤 User Info:", user);

                    // AuthContext의 login 함수 호출하여 상태 즉시 업데이트
                    login(access_token, refresh_token, user);

                    // 홈으로 이동 (replace: true로 히스토리 교체)
                    setTimeout(() => {
                        navigate('/', { replace: true });
                    }, 100);
                } catch (error) {
                    console.error('❌ [SocialCallback] Failed to fetch session token:', error);
                    alert('Social login failed: Could not retrieve session token.');
                    navigate('/login-page', { replace: true });
                }
            };

            fetchSessionToken();
        } else if (success === 'false') {
            setIsProcessing(true);
            console.error('❌ [SocialCallback] Social login failed');
            alert('Social login failed: No session found.');
            navigate('/login-page', { replace: true });
        } else {
            // success 파라미터가 없는 경우
            setIsProcessing(true);
            console.error('❌ [SocialCallback] Invalid callback');
            alert('Social login failed: Invalid callback.');
            navigate('/login-page', { replace: true });
        }
    }, [searchParams, navigate, login, isProcessing]);

    return (
        <div className="flex h-screen items-center justify-center flex-col">
            <h2 className="text-xl font-bold mb-4">Logging in...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    );
};

export default SocialCallback;
