import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../api/axios';

const LoginPage = () => {
    const navigate = useNavigate();
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

            // Store tokens
            localStorage.setItem('access_token', response.data.access_token);
            localStorage.setItem('refresh_token', response.data.refresh_token);
            localStorage.setItem('user', JSON.stringify(response.data.user)); // Optional: store minimal user info locally

            // Navigate to home or stored redirect
            navigate('/');
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

    return (
        <Layout>
            <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-64px-130px)]">
                <div className="w-full max-w-md bg-white dark:bg-dark-surface p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">환영합니다!</h1>
                        <p className="text-gray-500 dark:text-gray-400">여행을 시작하려면 로그인하세요</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            id="username"
                            label="아이디"
                            placeholder="아이디를 입력하세요"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="password"
                            type="password"
                            label="비밀번호"
                            placeholder="비밀번호를 입력하세요"
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
                                <span className="text-gray-600 dark:text-gray-400">로그인 상태 유지</span>
                            </label>
                            <Link to="/find-account" className="text-primary hover:text-primary-hover font-medium">
                                계정 찾기
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            disabled={isLoading}
                            className="text-lg font-semibold"
                        >
                            {isLoading ? '로그인 중...' : '로그인'}
                        </Button>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-dark-surface text-gray-500">SNS 계정으로 로그인</span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-3 gap-3">
                            <Button
                                variant="outline"
                                className="w-full text-sm"
                                onClick={() => window.location.href = `http://localhost:8000/accounts/google/login/`}
                            >
                                구글
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full text-sm"
                                onClick={() => window.location.href = `http://localhost:8000/accounts/kakao/login/`}
                            >
                                카카오
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full text-sm"
                                onClick={() => window.location.href = `http://localhost:8000/accounts/naver/login/`}
                            >
                                네이버
                            </Button>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                        계정이 없으신가요?{' '}
                        <Link to="/register-page" className="text-primary hover:text-primary-hover font-semibold">
                            회원가입
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default LoginPage;
