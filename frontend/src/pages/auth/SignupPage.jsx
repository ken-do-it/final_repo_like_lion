import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../api/axios';
import { useLanguage } from '../../context/LanguageContext';

const SignupPage = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
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
            setError(t('passwords_not_match'));
            return false;
        }
        if (formData.password.length < 8) {
            setError(t('password_min_length'));
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
            alert(t('registration_success')); // Simple feedback
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
                    setError(t('registration_failed'));
                }
            } else {
                setError(t('network_error'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('signup_title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('signup_subtitle')}</p>
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
                            label={t('id_label')}
                            placeholder={t('id_label')}
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="email"
                            type="email"
                            label={t('email_label')}
                            placeholder={t('email_placeholder')}
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            id="password"
                            type="password"
                            label={t('password_label')}
                            placeholder={t('password_label')}
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="password_confirm"
                            type="password"
                            label={t('password_confirm_label')}
                            placeholder={t('password_confirm_label')}
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
                            label={t('nickname_label')}
                            placeholder={t('nickname_label')}
                            value={formData.nickname}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="phone_number"
                            type="tel"
                            label={t('phone_label')}
                            placeholder={t('phone_placeholder')}
                            value={formData.phone_number}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input
                            id="birth_year"
                            type="number"
                            label={t('birth_year_label')}
                            placeholder={t('year_placeholder')}
                            value={formData.birth_year}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="country"
                            label={t('country_label')}
                            placeholder={t('country_placeholder')}
                            value={formData.country}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="city"
                            label={t('city_label')}
                            placeholder={t('city_label')}
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
                            {isLoading ? t('loading') : t('signup_btn')}
                        </Button>
                    </div>
                </form>

                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    {t('have_account')}{' '}
                    <Link to="/login-page" className="text-primary hover:text-primary-hover font-semibold">
                        {t('login_btn')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
