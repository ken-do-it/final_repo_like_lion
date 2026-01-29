import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        setUser(null);
        setIsAuthenticated(false);
    };

    const fetchProfile = useCallback(async (token) => {
        try {
            const response = await api.get('/users/profile/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = response.data;

            // 필요한 경우 사용자 데이터 정규화 (닉네임 확인)
            if (!userData.nickname && userData.username) {
                userData.nickname = userData.username;
            }

            setUser(userData);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            console.error("❌ [AuthContext] Failed to fetch profile:", error);
            logout();
        }
    }, []);

    const login = (token, refreshToken, userData) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));

        setUser(userData);
        setIsAuthenticated(true);
    };

    useEffect(() => {
        // 마운트 시 저장된 토큰 및 사용자 데이터 확인
        const storedToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');

        const initAuth = async () => {
            if (storedToken) {
                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setUser(parsedUser);
                        setIsAuthenticated(true);
                    } catch (error) {
                        console.error("Failed to parse stored user data:", error);
                        // API에서 가져오기 시도
                        await fetchProfile(storedToken);
                    }
                } else {
                    // 토큰은 존재하지만 사용자 데이터가 없음, 프로필 가져오기
                    console.log("⚠️ [AuthContext] Token found but no user data. Fetching profile...");
                    await fetchProfile(storedToken);
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, [fetchProfile]);

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

//경고 무시 코드
// eslint-disable-next-line react-refresh/only-export-components 
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
