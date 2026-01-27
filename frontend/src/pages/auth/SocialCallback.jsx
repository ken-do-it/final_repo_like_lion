
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

                // 홈으로 이동 (새로고침 없이 navigate 사용)
                navigate('/');
            } else {
                alert('Social login failed: Invalid user data received.');
                navigate('/login-page');
            }
        } else {
            // 실패 시 로그인 페이지로
            alert('Social login failed: No tokens received.');
            navigate('/login-page');
        }
    }, [searchParams, navigate, login]);

    return (
        <div className="flex h-screen items-center justify-center flex-col">
            <h2 className="text-xl font-bold mb-4">Logging in...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    );
};

export default SocialCallback;
