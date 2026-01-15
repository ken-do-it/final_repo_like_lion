// src/pages/plans/AIRecommend.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';

const DESTINATIONS = [
  { value: 'gapyeong_yangpyeong', label: '가평/양평' },
  { value: 'gangneung_sokcho', label: '강릉/속초' },
  { value: 'gyeongju', label: '경주' },
  { value: 'busan', label: '부산' },
  { value: 'yeosu', label: '여수' },
  { value: 'incheon', label: '인천' },
  { value: 'jeonju', label: '전주' },
  { value: 'jeju', label: '제주' },
  { value: 'chuncheon_hongcheon', label: '춘천/홍천' },
  { value: 'taean', label: '태안' },
];

const TRAVEL_STYLES = [
  { value: 'healing', label: '힐링/휴양', icon: '🧘', description: '조용하고 편안한 여행' },
  { value: 'activity', label: '액티비티', icon: '🏄', description: '활동적이고 역동적인 여행' },
  { value: 'culture', label: '문화/역사', icon: '🎭', description: '역사와 문화를 느끼는 여행' },
  { value: 'food', label: '맛집 투어', icon: '🍜', description: '맛집 탐방 중심 여행' },
  { value: 'nature', label: '자연 경관', icon: '🏔️', description: '자연을 만끽하는 여행' },
];

const AIRecommend = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pollingRequestId, setPollingRequestId] = useState(null);
  const [formData, setFormData] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    travel_style: '',
    additional_info: '',
  });

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
          alert('AI 여행 추천이 완료되었습니다!');
          if (request.created_plan) {
            navigate(`/plans/${request.created_plan}`);
          } else {
            navigate('/plans');
          }
        } else if (request.status === 'failed') {
          setLoading(false);
          setPollingRequestId(null);
          alert('AI 추천 생성에 실패했습니다. 다시 시도해주세요.');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000); // Poll every 1 second
        } else {
          setLoading(false);
          setPollingRequestId(null);
          alert('요청 시간이 초과되었습니다. 나중에 다시 시도해주세요.');
        }
      } catch (err) {
        console.error('Error polling AI request:', err);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        } else {
          setLoading(false);
          setPollingRequestId(null);
          alert('AI 추천 상태 확인에 실패했습니다.');
        }
      }
    };

    poll();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.destination) {
      alert('목적지를 선택해주세요.');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      alert('여행 날짜를 선택해주세요.');
      return;
    }
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert('종료 날짜는 시작 날짜보다 이후여야 합니다.');
      return;
    }
    if (!formData.travel_style) {
      alert('여행 스타일을 선택해주세요.');
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
      alert('AI 추천 요청에 실패했습니다.');
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
            AI 여행 추천
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          인공지능이 당신의 취향에 맞는 완벽한 여행 일정을 만들어드립니다
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Destination */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              어디로 여행을 떠나시나요? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {DESTINATIONS.map((dest) => (
                <button
                  key={dest.value}
                  type="button"
                  onClick={() => handleChange({ target: { name: 'destination', value: dest.value } })}
                  className={`h-14 px-4 rounded-lg border-2 font-semibold transition-all ${
                    formData.destination === dest.value
                      ? 'border-[#1392ec] bg-[#1392ec] text-white'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] text-gray-900 dark:text-gray-100 hover:border-[#1392ec] hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  {dest.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              언제 여행을 떠나시나요? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  시작 날짜
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
                  종료 날짜
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
                총 {calculateDays()}일 여행
              </p>
            )}
          </div>

          {/* Travel Style */}
          <div className="mb-8">
            <label className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              어떤 여행을 원하시나요? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TRAVEL_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => handleStyleSelect(style.value)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    formData.travel_style === style.value
                      ? 'border-[#1392ec] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#101a22] hover:border-[#1392ec] hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <div className="text-3xl mb-2">{style.icon}</div>
                  <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {style.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {style.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mb-8">
            <label htmlFor="additional_info" className="block text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              추가로 원하는 사항이 있나요?
            </label>
            <textarea
              id="additional_info"
              name="additional_info"
              value={formData.additional_info}
              onChange={handleChange}
              placeholder="예: 애완동물과 함께 갈 수 있는 곳, 가족 단위 여행자에게 적합한 곳, 사진 찍기 좋은 곳 등"
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
              취소
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
                  AI가 여행 계획을 생성 중입니다...
                </span>
              ) : (
                'AI 추천 받기'
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
                <p className="font-semibold mb-1">AI 추천은 어떻게 동작하나요?</p>
                <ul className="list-disc list-inside space-y-1 text-purple-700 dark:text-purple-400">
                  <li>입력하신 정보를 바탕으로 AI가 최적의 여행 일정을 생성합니다</li>
                  <li>날짜별 방문 장소와 설명이 자동으로 추가됩니다</li>
                  <li>생성된 일정은 언제든지 수정할 수 있습니다</li>
                  <li>AI 생성에는 약 30초~1분 정도 소요됩니다</li>
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
