import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

/**
 * 공통 CTA 버튼 컴포넌트
 * - 예약/검색 등 주요 액션에 사용하는 강조 버튼
 *
 * Props:
 * - type: 'button' | 'submit' (기본: 'button')
 * - onClick: 클릭 핸들러
 * - loading: 로딩 상태 (스피너 표시, 비활성화)
 * - disabled: 비활성화 여부
 * - icon: Material Symbols 아이콘명 (로딩 아닐 때 표시)
 * - label: 버튼 텍스트 (children 대신 사용 가능)
 * - children: 버튼 내부 콘텐츠 (label 대신 커스텀 가능)
 * - fullWidth: 가로 전체 사용 (기본: true)
 * - className: 추가 클래스
 */
const CTAButton = ({
  type = 'button',
  onClick,
  loading = false,
  disabled = false,
  icon,
  label,
  children,
  fullWidth = true,
  className = '',
}) => {
  const { t } = useLanguage();
  const isDisabled = disabled || loading;
  const content = (
    <>
      {loading ? (
        <>
          <span className="material-symbols-rounded animate-spin">progress_activity</span>
          <span>{t('btn_processing')}</span>
        </>
      ) : (
        <>
          {icon && (
            <span className="material-symbols-rounded">{icon}</span>
          )}
          <span>{label || children}</span>
        </>
      )}
    </>
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        group ${fullWidth ? 'w-full' : ''} h-14
        bg-mint hover:bg-mint-dark text-white font-semibold
        rounded-xl transition-all duration-300
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {content}
    </button>
  );
};

export default CTAButton;

