import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

/**
 * 예약 페이지 사이드바 컴포넌트
 * 혜택 안내, 고객 지원 정보를 표시합니다
 *
 * 사용 예시:
 * <ReservationSidebar />
 */
const ReservationSidebar = () => {
  const { t } = useLanguage();

  /**
   * Tripko 혜택 목록
   * icon - Material Symbols 아이콘 이름
   * text - 혜택 설명
   */
  const benefits = [
    {
      icon: 'support_agent',
      text: t('benefit_support')
    },
    {
      icon: 'verified',
      text: t('benefit_guarantee')
    },
    {
      icon: 'lock',
      text: t('benefit_secure')
    },
    {
      icon: 'sync',
      text: t('benefit_cancel')
    },
  ];

  return (
    <aside className="space-y-6">
      {/* 혜택 안내 카드 */}
      <div className="bg-slate-50 dark:bg-[#1e2b36] rounded-xl p-6">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
          {t('title_benefits')}
        </h3>

        <ul className="space-y-3">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-center gap-3">
              {/* 혜택 아이콘 */}
              <span className="material-symbols-outlined text-primary text-xl">
                {benefit.icon}
              </span>

              {/* 혜택 설명 */}
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {benefit.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 고객 지원 카드 */}
      <div className="bg-primary text-white rounded-xl p-6">
        <div className="flex items-start gap-3">
          {/* 지원 아이콘 */}
          <span className="material-symbols-outlined text-3xl">
            headset_mic
          </span>

          {/* 지원 정보 */}
          <div>
            <h3 className="font-semibold mb-2">
              {t('title_need_help')}
            </h3>
            <p className="text-sm opacity-90 mb-3">
              {t('desc_need_help')}
            </p>
            <button className="bg-white text-primary px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors">
              {t('btn_contact_support')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ReservationSidebar;
