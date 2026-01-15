// src/pages/plans/PlanList.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';

const PlanList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlans();
      setPlans(response.data);
    } catch (err) {
      setError('여행 계획을 불러오는데 실패했습니다.');
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm('정말 이 여행 계획을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await plansService.plans.deletePlan(planId);
      setPlans(plans.filter(plan => plan.id !== planId));
    } catch (err) {
      alert('삭제하는데 실패했습니다.');
      console.error('Error deleting plan:', err);
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

  if (error) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            나의 여행 계획
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            나만의 특별한 여행을 계획하고 관리하세요
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/plans/ai-recommend')}
            className="h-12 px-6 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 hover:-translate-y-0.5 transition-all"
          >
            AI 추천받기
          </button>
          <button
            onClick={() => navigate('/plans/create')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
          >
            새 계획 만들기
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-400 dark:text-gray-600 mb-6">
            <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg text-gray-600 dark:text-gray-400">아직 여행 계획이 없습니다</p>
          </div>
          <button
            onClick={() => navigate('/plans/create')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
          >
            첫 번째 여행 계획 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/plans/${plan.id}`}
              className="group bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              {/* Plan Type Badge */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    plan.plan_type === 'ai_recommended'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {plan.plan_type === 'ai_recommended' ? 'AI 추천' : '직접 작성'}
                  </span>
                  {plan.is_public && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      공개
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#1392ec] dark:group-hover:text-[#1392ec] transition-colors">
                  {plan.title}
                </h3>
              </div>

              {/* Plan Details */}
              <div className="p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {plan.description || '설명이 없습니다.'}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(plan.start_date).toLocaleDateString('ko-KR')} ~ {new Date(plan.end_date).toLocaleDateString('ko-KR')}
                  </div>
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {Math.ceil((new Date(plan.end_date) - new Date(plan.start_date)) / (1000 * 60 * 60 * 24))}일 여행
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/plans/${plan.id}/edit`);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={(e) => handleDeletePlan(plan.id, e)}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanList;
