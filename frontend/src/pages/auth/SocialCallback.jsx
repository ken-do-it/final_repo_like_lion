import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SocialCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth(); // Assuming AuthContext has a login or we manually set token
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // 이미 처리 중이면 return
        if (isProcessing) return;

        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const userId = searchParams.get('user_id');
        const username = searchParams.get('username');
        const email = searchParams.get('email');
        const nickname = searchParams.get('nickname');
        const socialProvider = searchParams.get('social_provider');

        if (accessToken && refreshToken) {
            setIsProcessing(true);

            console.log("✅ [SocialCallback] Tokens received successfully");
            console.log("🔑 Access Token:", accessToken);
            console.log("🔄 Refresh Token:", refreshToken);
            console.log("👤 User Info:", { userId, username, email, nickname, socialProvider });

            // 사용자 정보 구성
            if (userId && username) {
                const userData = {
                    id: userId,
                    username: username,
                    email: email,
                    nickname: nickname || username,
                    social_provider: socialProvider
                };
                console.log("👤 [SocialCallback] User Data saved:", userData);

                // AuthContext의 login 함수 호출하여 상태 즉시 업데이트
                login(accessToken, refreshToken, userData);

                // 홈으로 이동 (replace: true로 히스토리 교체)
                setTimeout(() => {
                    navigate('/', { replace: true });
                }, 100);
            } else {
                alert('Social login failed: Invalid user data received.');
                navigate('/login-page', { replace: true });
            }
        } else if (!isProcessing) {
            // 토큰이 없고 아직 처리되지 않은 경우에만 에러 표시
            console.error('❌ [SocialCallback] No tokens found in URL');
            alert('Social login failed: No tokens received.');
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
