import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api', // Fallback or strict
    headers: {
        'Content-Type': 'application/json',
    },
});

export const searchAxios = axios.create({
    baseURL: import.meta.env.VITE_SEARCH_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const placesAxios = axios.create({
    baseURL: import.meta.env.VITE_PLACES_API_URL || 'http://localhost:8002/api/v1',
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

            // Try refresh token logic here if needed in future
            // For now, if 401, we just let the error propagate 
            // and let the page handle redirect (like MyPage.jsx does)

            // Optional: Clear tokens if we know they are definitively invalid
            // localStorage.removeItem('access_token');
            // localStorage.removeItem('refresh_token');
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
