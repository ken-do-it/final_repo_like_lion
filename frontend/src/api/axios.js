import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api', // Fallback or strict
    headers: {
        'Content-Type': 'application/json',
    },
});

export const searchAxios = axios.create({
    baseURL: import.meta.env.VITE_SEARCH_API_URL || 'http://127.0.0.1:8001',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const placesAxios = axios.create({
    baseURL: import.meta.env.VITE_PLACES_BASE_URL, // Root for places api
    headers: {
        'Content-Type': 'application/json',
    },
});

export default axiosInstance;
