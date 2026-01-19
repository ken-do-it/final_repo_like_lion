// src/pages/plans/PlanEdit.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';

const PlanEdit = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_public: true,
  });

  // 로그인 체크
  useEffect(() => {
    if (!isAuthenticated) {
      alert('로그인이 필요한 서비스입니다.');
      navigate(-1); // 이전 페이지로 돌아가기
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlan();
    }
  }, [planId, isAuthenticated]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlanById(planId);
      const planData = response.data;
      setPlan(planData);

      setFormData({
        title: planData.title,
        description: planData.description || '',
        start_date: planData.start_date,
        end_date: planData.end_date,
        is_public: planData.is_public,
      });
    } catch (err) {
      setError('여행 계획을 불러오는데 실패했습니다.');
      console.error('Error fetching plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      alert('여행 날짜를 입력해주세요.');
      return;
    }

    if (formData.end_date < formData.start_date) {
      alert('종료일은 시작일보다 이후여야 합니다.');
      return;
    }

    try {
      setSubmitting(true);
      await plansService.plans.patchPlan(planId, formData);
      navigate(`/plans/${planId}`);
    } catch (err) {
      console.error('Error updating plan:', err);
      alert(err.response?.data?.detail || err.response?.data?.error || '여행 계획을 수정하는데 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || '계획을 찾을 수 없습니다.'}</div>
          <button
            onClick={() => navigate('/plans')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] transition-all"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
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
            뒤로 가기
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            여행 계획 수정
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            여행 계획의 기본 정보를 수정합니다
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="space-y-6">
            {/* Plan Type (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                계획 유형
              </label>
              <div className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  plan.plan_type === 'ai_recommended'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                  {plan.plan_type === 'ai_recommended' ? 'AI 추천' : '직접 작성'}
                </span>
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                제목 *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="여행 계획 제목을 입력하세요"
                className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                설명
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="여행 계획에 대한 설명을 입력하세요 (선택사항)"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent resize-none"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  시작일 *
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="end_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  종료일 *
                </label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f1921] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Public Toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-[#1392ec] focus:ring-2 focus:ring-[#1392ec] focus:ring-offset-0"
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  공개 여행 계획으로 설정
                </span>
              </label>
              <p className="mt-2 ml-8 text-sm text-gray-500 dark:text-gray-400">
                공개로 설정하면 다른 사용자들이 이 여행 계획을 볼 수 있습니다
              </p>
            </div>

            {/* Warning for dates with existing places */}
            {plan.details && plan.details.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      날짜 변경 시 주의사항
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      이 계획에는 이미 {plan.details.length}개의 장소가 추가되어 있습니다. 날짜를 변경하면 기존 장소의 날짜가 계획 범위를 벗어날 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={() => navigate(`/plans/${planId}`)}
              className="flex-1 h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanEdit;
