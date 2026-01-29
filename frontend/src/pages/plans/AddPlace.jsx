// src/pages/plans/AddPlace.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { placesAxios } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext'; // [NEW]

const AddPlace = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage(); // [NEW]
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 자동완성 관련 상태
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [formData, setFormData] = useState({
    place_name: '',
    date: '',
    description: '',
    order_index: 0,
  });

  // 로그인 체크
  useEffect(() => {
    if (!isAuthenticated) {
      alert(t('alert_login_required_service'));
      navigate(-1); // 이전 페이지로 돌아가기
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlanDetail();
    }
  }, [planId, isAuthenticated]);

  // 자동완성 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.place_name.length >= 2) {
        fetchSuggestions(formData.place_name);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.place_name]);

  const fetchSuggestions = async (query) => {
    try {
      const response = await placesAxios.get('/places/autocomplete', {
        params: { q: query, limit: 5 }
      });
      if (response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error("Autocomplete failed:", err);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      place_name: suggestion.name
    }));
    setSelectedPlace(suggestion);
    setShowSuggestions(false);
  };

  const fetchPlanDetail = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlanById(planId);
      setPlan(response.data);

      // Set default date to start_date
      setFormData(prev => ({
        ...prev,
        date: response.data.start_date,
      }));
    } catch (err) {
      setError(t('msg_plan_not_found'));
      console.error('Error fetching plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'order_index' ? parseInt(value) || 0 : value,
    }));
    // 장소 이름이 변경되면 선택된 장소 정보 초기화
    if (name === 'place_name') {
      setSelectedPlace(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.place_name.trim()) {
      alert(t('alert_place_name_required'));
      return;
    }

    if (!formData.date) {
      alert(t('alert_visit_date_required'));
      return;
    }

    // Validate date is within plan range
    if (formData.date < plan.start_date || formData.date > plan.end_date) {
      alert(t('alert_date_range_error', { startDate: plan.start_date, endDate: plan.end_date }));
      return;
    }

    try {
      setSubmitting(true);
      await plansService.details.addPlaceToplan(planId, formData);
      navigate(`/plans/${planId}`);
    } catch (err) {
      console.error('Error adding place:', err);
      alert(err.response?.data?.detail || err.response?.data?.error || t('alert_add_place_fail'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">{t('msg_loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || t('msg_plan_not_found')}</div>
          <button
            onClick={() => navigate('/plans')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] transition-all"
          >
            {t('btn_back_to_list')}
          </button>
        </div>
      </div>
    );
  }

  // Generate date options
  const dateOptions = [];
  const startDate = new Date(plan.start_date);
  const endDate = new Date(plan.end_date);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dateOptions.push(new Date(d).toISOString().split('T')[0]);
  }

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/plans/${planId}`)}
            className="text-gray-600 dark:text-gray-400 hover:text-[#1392ec] dark:hover:text-[#1392ec] mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('btn_back')}
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('title_add_place')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subtitle_add_place', { planTitle: plan.title })}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="space-y-6">
            {/* Place Name with Autocomplete */}
            <div className="relative">
              <label htmlFor="place_name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('label_place_name')} *
              </label>
              <input
                type="text"
                id="place_name"
                name="place_name"
                value={formData.place_name}
                onChange={handleChange}
                onFocus={() => {
                  if (formData.place_name.length >= 2 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder={t('placeholder_place_name')}
                className={`w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent ${showSuggestions && suggestions.length > 0 ? 'rounded-b-none' : ''}`}
                autoComplete="off"
                required
              />

              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white dark:bg-[#1e2b36] border border-t-0 border-gray-300 dark:border-gray-600 rounded-b-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick(suggestion);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#1392ec] transition-colors">
                          {suggestion.name.split(new RegExp(`(${formData.place_name})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === formData.place_name.toLowerCase()
                              ? <span key={i} className="text-[#1392ec]">{part}</span>
                              : part
                          )}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.address}
                        </span>
                      </div>
                      {suggestion.city && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                          {suggestion.city}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Place Info */}
              {selectedPlace && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#1392ec]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-[#1392ec]">{t('msg_selected')}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {selectedPlace.address}
                  </p>
                </div>
              )}

              {!selectedPlace && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('msg_autocomplete_guide')}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('label_visit_date')} *
              </label>
              <select
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                required
              >
                {dateOptions.map((date, index) => (
                  <option key={date} value={date}>
                    Day {index + 1} - {new Date(date).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Index */}
            <div>
              <label htmlFor="order_index" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('label_visit_order')}
              </label>
              <input
                type="number"
                id="order_index"
                name="order_index"
                value={formData.order_index}
                onChange={handleChange}
                min="0"
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('desc_visit_order')}
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('label_memo')}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder={t('placeholder_memo')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={() => navigate(`/plans/${planId}`)}
              className="flex-1 h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? t('btn_adding') : t('btn_add_place')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPlace;
