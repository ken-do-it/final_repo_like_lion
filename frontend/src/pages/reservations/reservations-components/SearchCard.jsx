import React from 'react';

/**
 * 검색 폼을 감싸는 카드 래퍼 컴포넌트
 * 일관된 카드 스타일을 제공합니다
 *
 * Props:
 * title - 카드 상단에 표시될 제목 (선택사항)
 * children - 카드 안에 들어갈 내용 (검색 폼 등)
 * className - 추가 CSS 클래스 (선택사항)
 *
 * 사용 예시:
 * <SearchCard title="항공편 검색">
 *   <form>...</form>
 * </SearchCard>
 */
const SearchCard = ({ title, children, className = '' }) => {
  return (
    <div
      className={`
        bg-white dark:bg-surface-dark
        rounded-xl shadow-lg
        p-6
        transition-all duration-300
        ${className}
      `}
    >
      {/* 카드 제목 영역 */}
      {title && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
      )}

      {/* 카드 내용 영역 */}
      <div>
        {children}
      </div>
    </div>
  );
};

export default SearchCard;
