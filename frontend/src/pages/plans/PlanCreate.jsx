// src/pages/plans/PlanCreate.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext'; // [NEW] Import language hook

const PlanCreate = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage(); // [NEW] Use hook
  const [loading, setLoading] = useState(false);

  // 로그인 체크
  useEffect(() => {
    if (!isAuthenticated) {
      alert(t('alert_login_required_service'));
      navigate(-1); // 이전 페이지로 돌아가기
    }
  }, [isAuthenticated, navigate]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_public: false,
    plan_type: 'personal',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      alert(t('alert_input_title'));
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      alert(t('alert_select_dates'));
      return;
    }
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert(t('alert_date_order'));
      return;
    }

    try {
      setLoading(true);
      const response = await plansService.plans.createPlan(formData);
      alert(t('msg_create_success'));
      navigate(`/plans/${response.data.id}`);
    } catch (err) {
      console.error('Error creating plan:', err);
      alert(t('msg_create_fail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate('/plans')}
            className="text-gray-600 dark:text-gray-400 hover:text-[#1392ec] dark:hover:text-[#1392ec]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            {t('plan_create_title')}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('plan_create_subtitle')}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('label_trip_title')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder={t('placeholder_trip_title')}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('label_trip_desc')}
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('placeholder_trip_desc')}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent resize-none"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="start_date" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('label_start_date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="end_date" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('label_end_date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                min={formData.start_date}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Public Toggle */}
          <div className="mb-8">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_public"
                checked={formData.is_public}
                onChange={handleChange}
                className="w-5 h-5 text-[#1392ec] border-gray-300 dark:border-gray-600 rounded focus:ring-[#1392ec] focus:ring-2"
              />
              <span className="ml-3 text-gray-900 dark:text-gray-100">
                {t('label_public')}
                <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('desc_public')}
                </span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/plans')}
              className="flex-1 h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? t('btn_creating') : t('btn_submit_create')}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">{t('info_after_create_title')}</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                  <li>{t('info_after_create_1')}</li>
                  <li>{t('info_after_create_2')}</li>
                  <li>{t('info_after_create_3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanCreate;
