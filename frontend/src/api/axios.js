import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api', // Relative path for Nginx proxy
    headers: {
        'Content-Type': 'application/json',
    },
});

export const searchAxios = axios.create({
    baseURL: import.meta.env.VITE_SEARCH_API_URL || '/search',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const placesAxios = axios.create({
    baseURL: import.meta.env.VITE_PLACES_API_URL || '/api/v1', // Relative path
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Also attach token for placesAxios
placesAxios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Token Expiration (Simple)
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Prevent infinite loop
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // 401 발생 시 자동으로 토큰 삭제 및 로그아웃 처리
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');

            // 페이지를 새로고침하여 앱을 비로그인 상태로 초기화
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
