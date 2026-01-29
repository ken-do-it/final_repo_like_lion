// src/pages/plans/EditPlace.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import placesApi from '../../api/placesApi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext'; // [NEW]

const EditPlace = () => {
  const { detailId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage(); // [NEW]
  const [detail, setDetail] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    place_name: '',
    date: '',
    description: '',
    order_index: 0,
  });

  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  // 로그인 체크
  useEffect(() => {
    if (!isAuthenticated) {
      alert(t('alert_login_required_service'));
      navigate(-1); // 이전 페이지로 돌아가기
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDetailAndPlan();
    }
  }, [detailId, isAuthenticated]);

  const fetchDetailAndPlan = async () => {
    try {
      setLoading(true);
      console.log('Fetching detail with ID:', detailId);
      const detailResponse = await plansService.details.getDetailById(detailId);
      console.log('Detail response:', detailResponse.data);
      const detailData = detailResponse.data;
      setDetail(detailData);

      // Fetch plan to get date range
      console.log('Plan ID from detail:', detailData.plan);
      if (!detailData.plan) {
        throw new Error('Plan ID is missing from detail data');
      }
      const planResponse = await plansService.plans.getPlanById(detailData.plan);
      setPlan(planResponse.data);

      // Set form data
      setFormData({
        place_name: detailData.place_name || '',
        date: detailData.date,
        description: detailData.description || '',
        order_index: detailData.order_index || 0,
      });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || t('msg_plan_not_found');
      setError(errorMsg);
      console.error('Error fetching detail:', err);
      console.error('Error response:', err.response);
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
  };

  const handlePlaceNameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, place_name: value }));

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Hide results if input is too short
    if (value.length < 2) {
      setShowResults(false);
      setSearchResults([]);
      return;
    }

    // Debounced search (500ms delay)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        console.log('Searching for:', value);
        const response = await placesApi.autocomplete(value, 10);
        console.log('Search response:', response);
        console.log('Suggestions:', response.data.suggestions);
        setSearchResults(response.data.suggestions || []);
        setShowResults(true);
      } catch (err) {
        console.error('Place search error:', err);
        console.error('Error response:', err.response);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectPlace = (place) => {
    setFormData(prev => ({
      ...prev,
      place_name: place.name,
    }));
    setShowResults(false);
    setSearchResults([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      await plansService.details.patchDetail(detailId, formData);
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      console.error('Error updating place:', err);
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

  if (error || !detail || !plan) {
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
            onClick={() => navigate(`/plans/${plan.id}`)}
            className="text-gray-600 dark:text-gray-400 hover:text-[#1392ec] dark:hover:text-[#1392ec] mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('btn_back')}
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('title_edit_place')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subtitle_edit_place', { placeName: detail.place_name })}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="space-y-6">
            {/* Place Name (Editable with Autocomplete) */}
            <div className="relative" ref={searchInputRef}>
              <label htmlFor="place_name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('label_place_name')} *
              </label>
              <input
                type="text"
                id="place_name"
                name="place_name"
                value={formData.place_name}
                onChange={handlePlaceNameChange}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowResults(true);
                  }
                }}
                placeholder={t('placeholder_place_name')}
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                required
                autoComplete="off"
              />

              {/* Autocomplete Dropdown */}
              {showResults && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e2b36] border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                      {t('msg_searching')}
                    </div>
                  ) : searchResults.length > 0 ? (
                    <ul>
                      {searchResults.map((place, index) => (
                        <li
                          key={index}
                          onClick={() => handleSelectPlace(place)}
                          className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {place.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {place.address}
                          </div>
                          {place.city && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {place.city}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                      {t('msg_no_results')}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('msg_autocomplete_guide_2')}
              </p>
            </div>

            {/* Current Address (Display only) */}
            {detail.place_address && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('label_current_address')}
                </label>
                <div className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {detail.place_address}
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('desc_address_update')}
                </p>
              </div>
            )}

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
              onClick={() => navigate(`/plans/${plan.id}`)}
              className="flex-1 h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPlace;
