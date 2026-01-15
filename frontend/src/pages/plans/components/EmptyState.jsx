// src/pages/plans/components/EmptyState.jsx

const EmptyState = ({ title, message, actionLabel, onAction, icon }) => {
  const defaultIcon = (
    <svg
      className="w-24 h-24 mx-auto mb-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );

  return (
    <div className="text-center py-20">
      <div className="text-gray-400 dark:text-gray-600 mb-6">
        {icon || defaultIcon}
        {title && (
          <p className="text-lg text-gray-600 dark:text-gray-400 font-semibold mb-2">
            {title}
          </p>
        )}
        {message && (
          <p className="text-gray-500 dark:text-gray-500">{message}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
