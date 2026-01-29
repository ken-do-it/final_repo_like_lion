// src/pages/plans/AIRecommend.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext'; // [NEW]

const DESTINATIONS = [
  { value: 'gapyeong_yangpyeong', labelKey: 'dest_gapyeong_yangpyeong' },
  { value: 'gangneung_sokcho', labelKey: 'dest_gangneung_sokcho' },
  { value: 'gyeongju', labelKey: 'dest_gyeongju' },
  { value: 'busan', labelKey: 'dest_busan' },
  { value: 'yeosu', labelKey: 'dest_yeosu' },
  { value: 'incheon', labelKey: 'dest_incheon' },
  { value: 'jeonju', labelKey: 'dest_jeonju' },
  { value: 'jeju', labelKey: 'dest_jeju' },
  { value: 'chuncheon_hongcheon', labelKey: 'dest_chuncheon_hongcheon' },
  { value: 'taean', labelKey: 'dest_taean' },
];

const TRAVEL_STYLES = [
  { value: 'healing', labelKey: 'style_healing', icon: '🧘', descriptionKey: 'style_healing_desc' },
  { value: 'activity', labelKey: 'style_activity', icon: '🏄', descriptionKey: 'style_activity_desc' },
  { value: 'culture', labelKey: 'style_culture', icon: '🎭', descriptionKey: 'style_culture_desc' },
  { value: 'food', labelKey: 'style_food', icon: '🍜', descriptionKey: 'style_food_desc' },
  { value: 'nature', labelKey: 'style_nature', icon: '🏔️', descriptionKey: 'style_nature_desc' },
];

const AIRecommend = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage(); // [NEW]
  const [loading, setLoading] = useState(false);
  const [pollingRequestId, setPollingRequestId] = useState(null);
  const [formData, setFormData] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    travel_style: '',
    additional_info: '',
  });

  // 로그인 체크
  useEffect(() => {
    if (!isAuthenticated) {
      alert(t('alert_login_required_service'));
      navigate(-1); // 이전 페이지로 돌아가기
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStyleSelect = (style) => {
    setFormData(prev => ({
      ...prev,
      travel_style: style,
    }));
  };

  const pollAIRequest = async (requestId) => {
    const maxAttempts = 60; // 60 attempts = 60 seconds
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await plansService.ai.getAIRequestById(requestId);
        const request = response.data;

        if (request.status === 'success') {
          setLoading(false);
          setPollingRequestId(null);
          alert(t('msg_create_success'));
          if (request.created_plan) {
            navigate(`/plans/${request.created_plan}`);
          } else {
            navigate('/plans');
          }
        } else if (request.status === 'failed') {
          setLoading(false);
          setPollingRequestId(null);
          alert(t('msg_create_fail'));
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000); // Poll every 1 second
        } else {
          setLoading(false);
          setPollingRequestId(null);
          alert(t('alert_ai_request_fail'));
        }
      } catch (err) {
        console.error('Error polling AI request:', err);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        } else {
          setLoading(false);
          setPollingRequestId(null);
          alert(t('alert_ai_polling_fail'));
        }
      }
    };

    poll();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.destination) {
      alert(t('alert_dest_required'));
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      alert(t('alert_date_required'));
      return;
    }
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert(t('alert_date_order'));
      return;
    }
    if (!formData.travel_style) {
      alert(t('alert_style_required'));
      return;
    }

    try {
      setLoading(true);
      const response = await plansService.ai.createAIRequest(formData);
      const requestId = response.data.id;
      setPollingRequestId(requestId);

      // Start polling for status
      pollAIRequest(requestId);
    } catch (err) {
      console.error('Error creating AI request:', err);
      alert(t('alert_ai_request_fail'));
      setLoading(false);
    }
  };

  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const days = Math.ceil(
        (new Date(formData.end_date) - new Date(formData.start_date)) / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? days : 0;
    }
    return 0;
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
            {t('title_ai_recommend')}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('subtitle_ai_recommend')}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Destination */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('q_destination')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {DESTINATIONS.map((dest) => (
                <button
                  key={dest.value}
                  type="button"
                  onClick={() => handleChange({ target: { name: 'destination', value: dest.value } })}
                  className={`h-14 px-4 rounded-lg border-2 font-semibold transition-all ${formData.destination === dest.value
                    ? 'border-[#1392ec] bg-[#1392ec] text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 hover:border-[#1392ec] hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                >
                  {t(dest.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('q_date')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('label_start_date')}
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
                <label htmlFor="end_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('label_end_date')}
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
            {calculateDays() > 0 && (
              <p className="mt-2 text-sm text-[#1392ec] font-semibold">
                {t('msg_total_days', { days: calculateDays() })}
              </p>
            )}
          </div>

          {/* Travel Style */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('q_style')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TRAVEL_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => handleStyleSelect(style.value)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${formData.travel_style === style.value
                    ? 'border-[#1392ec] bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] hover:border-[#1392ec] hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                >
                  <div className="text-3xl mb-2">{style.icon}</div>
                  <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {t(style.labelKey)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t(style.descriptionKey)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mb-8">
            <label htmlFor="additional_info" className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('q_additional')}
            </label>
            <textarea
              id="additional_info"
              name="additional_info"
              value={formData.additional_info}
              onChange={handleChange}
              placeholder={t('placeholder_additional')}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/plans')}
              disabled={loading}
              className="flex-1 h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-[#1392ec] text-white font-semibold hover:from-purple-700 hover:to-[#0f7bc2] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('btn_ai_generating')}
                </span>
              ) : (
                t('btn_get_ai_recommend')
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="text-sm text-purple-800 dark:text-purple-300">
                <p className="font-semibold mb-1">{t('info_ai_how_title')}</p>
                <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-400">
                  <li>{t('info_ai_how_1')}</li>
                  <li>{t('info_ai_how_2')}</li>
                  <li>{t('info_ai_how_3')}</li>
                  <li>{t('info_ai_how_4')}</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIRecommend;
