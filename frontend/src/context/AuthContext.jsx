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

            // Normalize user data if needed (ensure nickname exists)
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
        // Check for stored token and user data on mount
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
                        // Try fetching from API
                        await fetchProfile(storedToken);
                    }
                } else {
                    // Token exists but no user data, fetch from API
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
