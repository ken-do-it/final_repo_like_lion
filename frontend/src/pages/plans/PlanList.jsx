// src/pages/plans/PlanList.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const PlanList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'public', 'mine'
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { language, t } = useLanguage();

  useEffect(() => {
    fetchPlans();
  }, [language]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlans({
        lang: API_LANG_CODES[language] || 'eng_Latn'
      });
      setPlans(response.data);
    } catch {
      setError(t('msg_load_fail'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(t('msg_confirm_delete'))) {
      return;
    }

    try {
      await plansService.plans.deletePlan(planId);
      setPlans(plans.filter(plan => plan.id !== planId));
    } catch (err) {
      alert(t('msg_delete_fail'));
      console.error('Error deleting plan:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">{t('loading')}</div>
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
            {t('plan_list_title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('plan_list_subtitle')}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => {
              if (!isAuthenticated) {
                alert(t('alert_login_required'));
                return;
              }
              navigate('/plans/ai-recommend');
            }}
            className="h-12 px-6 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 hover:-translate-y-0.5 transition-all"
          >
            {t('btn_ai_recommend')}
          </button>
          <button
            onClick={() => {
              if (!isAuthenticated) {
                alert(t('alert_login_required'));
                return;
              }
              navigate('/plans/create');
            }}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
          >
            {t('btn_create_new')}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${filter === 'all'
            ? 'bg-[#1392ec] text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
          {t('filter_all')}
        </button>
        <button
          onClick={() => setFilter('public')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${filter === 'public'
            ? 'bg-[#1392ec] text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
          {t('filter_public')}
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setFilter('mine')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${filter === 'mine'
              ? 'bg-[#1392ec] text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            {t('filter_mine')}
          </button>
        )}
      </div>

      {/* Plans Grid */}
      {(() => {
        // 먼저 비공개 일정 필터링 (본인 것만 볼 수 있음)
        const visiblePlans = plans.filter(plan =>
          plan.is_public || (isAuthenticated && user && plan.user === user.id)
        );

        // 그 다음 탭 필터 적용
        let filteredPlans = visiblePlans;
        if (filter === 'public') {
          filteredPlans = visiblePlans.filter(plan => plan.is_public);
        } else if (filter === 'mine') {
          filteredPlans = visiblePlans.filter(plan =>
            isAuthenticated && user && plan.user === user.id
          );
        }
        return filteredPlans.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 dark:text-gray-600 mb-6">
              <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg text-gray-600 dark:text-gray-400">{t('msg_no_plans')}</p>
            </div>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  alert(t('alert_login_required'));
                  return;
                }
                navigate('/plans/create');
              }}
              className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
            >
              {t('btn_create_first')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map((plan) => (
              <Link
                key={plan.id}
                to={`/plans/${plan.id}`}
                className="group bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                {/* Plan Type Badge */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${plan.plan_type === 'ai_recommended'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                      {plan.plan_type === 'ai_recommended' ? t('badge_ai') : t('badge_manual')}
                    </span>
                    {plan.is_public ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {t('badge_public')}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {t('badge_private')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#1392ec] dark:group-hover:text-[#1392ec] transition-colors">
                    {plan.title_translated || plan.title}
                  </h3>
                </div>

                {/* Plan Details */}
                <div className="p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {(plan.description_translated || plan.description) || t('no_desc')}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(plan.start_date).toLocaleDateString()} ~ {new Date(plan.end_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('trip_days').replace('{days}', Math.ceil((new Date(plan.end_date) - new Date(plan.start_date)) / (1000 * 60 * 60 * 24)))}
                    </div>
                  </div>

                  {/* Likes and Comments */}
                  <div className="flex items-center text-gray-600 dark:text-gray-400 mt-4">
                    <div className="flex items-center mr-4">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.667l1.318-1.35a4.5 4.5 0 016.364 6.364L12 20.333l-7.682-7.682a4.5 4.5 0 010-6.364z"></path>
                      </svg>
                      <span>{plan.like_count}</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                      </svg>
                      <span>{plan.comment_count}</span>
                    </div>
                  </div>

                  {/* Actions - 본인 일정일 때만 표시 */}
                  {isAuthenticated && user && plan.user === user.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/plans/${plan.id}/edit`);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t('btn_edit')}
                      </button>
                      <button
                        onClick={(e) => handleDeletePlan(plan.id, e)}
                        className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        {t('btn_delete')}
                      </button>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default PlanList;
