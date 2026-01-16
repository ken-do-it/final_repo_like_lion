
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
        const userJson = searchParams.get('user');

        if (accessToken && refreshToken) {
            console.log("✅ [SocialCallback] Tokens received successfully");
            console.log("🔑 Access Token:", accessToken);
            console.log("🔄 Refresh Token:", refreshToken);

            // 토큰 저장 (AuthContext 형식이면 AuthContext 함수 사용 권장하지만, 
            // 여기서는 localStorage에 직접 저장 후 새로고침/상태업데이트 유도)
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);

            if (userJson) {
                try {
                    // URL 디코딩이 필요할 수 있음
                    const parsedUser = JSON.parse(userJson);
                    console.log("👤 [SocialCallback] User Data parsed:", parsedUser);
                    localStorage.setItem('user', JSON.stringify(parsedUser));
                } catch (e) {
                    console.error("Failed to parse user data", e);
                }
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
