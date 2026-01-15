// src/pages/plans/components/LoadingSpinner.jsx

const LoadingSpinner = ({ message = '로딩 중...' }) => {
  return (
    <div className="flex flex-col justify-center items-center min-h-[400px]">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-[#1392ec] rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
};

export default LoadingSpinner;
