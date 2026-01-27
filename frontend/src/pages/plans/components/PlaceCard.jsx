// src/pages/plans/components/PlaceCard.jsx
import { useLanguage } from '../../../context/LanguageContext';

const PlaceCard = ({ detail, index, onEdit, onDelete }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Order Number */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1392ec] text-white flex items-center justify-center font-bold">
              {index + 1}
            </div>

            {/* Place Info */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {detail.place?.place_name || t('default_place_name')}
              </h3>

              {detail.place?.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-start">
                  <svg
                    className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {detail.place.address}
                </p>
              )}

              {detail.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {detail.description}
                </p>
              )}

              {detail.place?.category_main && (
                <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                  {detail.place.category_main}
                </span>
              )}

              {/* Images */}
              {detail.images && detail.images.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {detail.images.map((image) => (
                    <img
                      key={image.id}
                      src={image.image}
                      alt={`장소 이미지 ${image.order_index}`}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => onEdit?.(detail.id)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="수정"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => onDelete?.(detail.id)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="삭제"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceCard;
