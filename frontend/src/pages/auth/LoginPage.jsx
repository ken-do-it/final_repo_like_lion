import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../api/axios';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuth();
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        remember_me: false,
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await api.post('/users/login/', {
                username: formData.username,
                password: formData.password,
            });

            // Update Auth Context
            login(
                response.data.access_token,
                response.data.refresh_token,
                response.data.user
            );

            // Navigate to home or stored redirect
            const redirectUrl = searchParams.get('redirect') || '/';
            navigate(redirectUrl);
        } catch (err) {
            console.error(err);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Login failed. Please check your credentials.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialLogin = (provider) => {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
        const backendUrl = apiBase.replace(/\/api\/?$/, '');
        window.location.href = `${backendUrl}/accounts/${provider}/login/`;
    };

    return (
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-64px-130px)]">
            <div className="w-full max-w-md bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('login_title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('login_subtitle')}</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        id="username"
                        label={t('id_label')}
                        placeholder={t('id_label')}
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        id="password"
                        type="password"
                        label={t('password_label')}
                        placeholder={t('password_label')}
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                id="remember_me"
                                checked={formData.remember_me}
                                onChange={handleChange}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-gray-600 dark:text-gray-400">Remember me</span>
                        </label>
                        <Link to="/find-account" className="text-primary hover:text-primary-hover font-medium">
                            {t('forgot_password')}
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        fullWidth
                        disabled={isLoading}
                        className="text-lg font-semibold"
                    >
                        {isLoading ? t('loading') : t('login_btn')}
                    </Button>
                </form>

                <div className="mt-8">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-surface-light dark:bg-surface-dark text-gray-500 transition-colors">SNS Login</span>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                        <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={() => handleSocialLogin('google')}
                        >
                            Google
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={() => handleSocialLogin('kakao')}
                        >
                            Kakao
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full text-sm"
                            onClick={() => handleSocialLogin('naver')}
                        >
                            Naver
                        </Button>
                    </div>
                </div>

                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    {t('no_account')}{' '}
                    <Link to="/register-page" className="text-primary hover:text-primary-hover font-semibold">
                        {t('signup_btn')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
