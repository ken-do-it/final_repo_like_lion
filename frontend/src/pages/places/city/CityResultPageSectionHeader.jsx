export const SectionHeader = ({ title, icon, onSeeMore, moreText }) => (
    <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center space-x-2">
            <span className="text-2xl">{icon}</span>
            <h2 className="text-xl md:text-2xl font-bold dark:text-white text-slate-900">{title}</h2>
        </div>
        {onSeeMore && (
            <button
                onClick={onSeeMore}
                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-[#1392ec] hover:text-white dark:hover:bg-[#1392ec] dark:hover:text-white font-medium flex items-center transition-all duration-200"
            >
                {moreText} <span className="ml-1 text-xs">➜</span>
            </button>
        )}
    </div>
);
