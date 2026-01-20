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

  // 외부 도메인 호출 없이 생성하는 SVG 플레이스홀더 (DNS 이슈 방지)
  const makePlaceholder = (label = 'Tripko', w = 600, h = 400) => {
    const bg = '#e2e8f0'; // slate-200
    const fg = '#334155'; // slate-700
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <rect width='100%' height='100%' fill='${bg}'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
            font-size='32' fill='${fg}'>${label}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };
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

  /**
   * 인기 여행지 목록
   * name - 여행지 이름
   * price - 최저 가격
   * image - 이미지 URL (현재는 placeholder 사용)
   */
  const popularDestinations = [
    {
      name: t('dest_jeju'),
      price: '65000',
      image: makePlaceholder('Jeju', 600, 400)
    },
    {
      name: t('dest_busan'),
      price: '55000',
      image: makePlaceholder('Busan', 600, 400)
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

      {/* 인기 여행지 카드 */}
      <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-lg">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
          {t('title_popular_dest')}
        </h3>

        <div className="space-y-4">
          {popularDestinations.map((destination, index) => (
            <div
              key={index}
              className="rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300"
            >
              {/* 여행지 이미지 */}
              <div className="relative h-32">
                <img
                  src={destination.image}
                  alt={destination.name}
                  className="w-full h-full object-cover"
                />

                {/* 그라데이션 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* 여행지 정보 */}
                <div className="absolute bottom-3 left-3 text-white">
                  <p className="font-bold text-lg">
                    {destination.name}
                  </p>
                  <p className="text-sm opacity-90">
                    {parseInt(destination.price).toLocaleString()}{t('unit_from')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
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
