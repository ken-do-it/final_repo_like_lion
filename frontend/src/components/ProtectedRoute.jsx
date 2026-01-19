import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            alert("로그인이 필요한 서비스입니다.");
        }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center dark:bg-[#101a22] text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to={`/login-page?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }

    return children;
};

export default ProtectedRoute;
