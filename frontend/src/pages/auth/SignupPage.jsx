import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../api/axios';

const SignupPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '', // Required by backend
        email: '',
        password: '',
        password_confirm: '',
        nickname: '',
        birth_year: '',
        country: '',
        city: '',
        phone_number: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const validateForm = () => {
        if (formData.password !== formData.password_confirm) {
            setError("Passwords do not match");
            return false;
        }
        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setIsLoading(true);

        // Convert birth_year to integer if present
        const payload = {
            ...formData,
            birth_year: formData.birth_year ? parseInt(formData.birth_year) : null
        };

        try {
            await api.post('/users/register/', payload);
            alert('Registration successful! Please log in.'); // Simple feedback
            navigate('/login-page');
        } catch (err) {
            console.error(err);
            if (err.response?.data) {
                // Handle field-specific errors if returned as object, otherwise generic
                const serverError = err.response.data;
                if (typeof serverError === 'object') {
                    // Just showing the first error found
                    const firstKey = Object.keys(serverError)[0];
                    const firstMsg = Array.isArray(serverError[firstKey]) ? serverError[firstKey][0] : serverError[firstKey];
                    setError(`${firstKey}: ${firstMsg}`);
                } else {
                    setError('Registration failed. Please try again.');
                }
            } else {
                setError('A network error occurred.');
            }
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">회원가입</h1>
                    <p className="text-gray-500 dark:text-gray-400">Tripko와 함께 완벽한 여행을 떠나보세요</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Account Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            id="username"
                            label="아이디"
                            placeholder="사용하실 아이디를 입력하세요"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="email"
                            type="email"
                            label="이메일"
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            id="password"
                            type="password"
                            label="비밀번호"
                            placeholder="최소 8자 이상"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="password_confirm"
                            type="password"
                            label="비밀번호 확인"
                            placeholder="비밀번호를 한번 더 입력하세요"
                            value={formData.password_confirm}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <hr className="border-gray-200 dark:border-gray-700 my-6" />

                    {/* Personal Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            id="nickname"
                            label="닉네임"
                            placeholder="화면에 표시될 이름"
                            value={formData.nickname}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="phone_number"
                            type="tel"
                            label="전화번호"
                            placeholder="+82 10-1234-5678"
                            value={formData.phone_number}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input
                            id="birth_year"
                            type="number"
                            label="출생연도"
                            placeholder="YYYY"
                            value={formData.birth_year}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="country"
                            label="국가"
                            placeholder="예: 대한민국"
                            value={formData.country}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="city"
                            label="도시"
                            placeholder="예: 서울"
                            value={formData.city}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="pt-4">
                        <Button
                            type="submit"
                            fullWidth
                            disabled={isLoading}
                            className="text-lg font-semibold"
                        >
                            {isLoading ? '가입 처리 중...' : '회원가입'}
                        </Button>
                    </div>
                </form>

                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    이미 계정이 있으신가요?{' '}
                    <Link to="/login-page" className="text-primary hover:text-primary-hover font-semibold">
                        로그인
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
