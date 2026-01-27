
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SocialCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth(); // Assuming AuthContext has a login or we manually set token

    useEffect(() => {
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const userId = searchParams.get('user_id');
        const username = searchParams.get('username');
        const email = searchParams.get('email');
        const nickname = searchParams.get('nickname');
        const socialProvider = searchParams.get('social_provider');

        if (accessToken && refreshToken) {
            console.log("✅ [SocialCallback] Tokens received successfully");
            console.log("🔑 Access Token:", accessToken);
            console.log("🔄 Refresh Token:", refreshToken);
            console.log("👤 User Info:", { userId, username, email, nickname, socialProvider });

            // 토큰 저장
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);

            // 사용자 정보 저장
            if (userId && username) {
                const userData = {
                    id: userId,
                    username: username,
                    email: email,
                    nickname: nickname || username,
                    social_provider: socialProvider
                };
                console.log("👤 [SocialCallback] User Data saved:", userData);
                localStorage.setItem('user', JSON.stringify(userData));
            }

            // 홈으로 이동 (새로고침하여 AuthContext가 토큰을 인식하게 함)
            window.location.href = '/';
        } else {
            // 실패 시 로그인 페이지로
            alert('Social login failed: No tokens received.');
            navigate('/login-page');
        }
    }, [searchParams, navigate]);

    return (
        <div className="flex h-screen items-center justify-center flex-col">
            <h2 className="text-xl font-bold mb-4">Logging in...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    );
};

export default SocialCallback;
