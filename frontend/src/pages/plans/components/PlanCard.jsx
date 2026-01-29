// src/pages/plans/components/PlanCard.jsx
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

const PlanCard = ({ plan, onDelete, onEdit }) => {
  const { t } = useLanguage();
  const calculateDays = () => {
    return Math.ceil(
      (new Date(plan.end_date) - new Date(plan.start_date)) / (1000 * 60 * 60 * 24)
    );
  };

  return (
    <Link
      to={`/plans/${plan.id}`}
      className="group bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
    >
      {/* Plan Type Badge */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-start mb-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              plan.plan_type === 'ai_recommended'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            }`}
          >
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
          {plan.description || t('no_desc')}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {new Date(plan.start_date).toLocaleDateString('ko-KR')} ~{' '}
            {new Date(plan.end_date).toLocaleDateString('ko-KR')}
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {calculateDays()}일 여행
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.(plan.id);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            수정
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.(plan.id);
            }}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </Link>
  );
};

export default PlanCard;
