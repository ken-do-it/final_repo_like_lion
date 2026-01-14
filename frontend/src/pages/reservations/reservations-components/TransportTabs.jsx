import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 교통 수단 탭 네비게이션 컴포넌트
 * 항공, 기차, 지하철 페이지를 전환하는 탭 UI
 *
 * 사용 예시:
 * <TransportTabs />
 */
const TransportTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * 현재 활성화된 탭 결정 함수
   * URL 경로를 보고 어떤 탭이 활성화되어야 하는지 판단합니다
   *
   * 반환값:
   * 0 - 항공 탭
   * 1 - 기차 탭
   * 2 - 지하철 탭
   */
  const getActiveTab = () => {
    if (location.pathname.includes('/flights')) return 0;
    if (location.pathname.includes('/trains')) return 1;
    if (location.pathname.includes('/subway')) return 2;
    return 0;
  };

  const activeTab = getActiveTab();

  /**
   * 탭 정보 배열
   * 각 탭의 표시 이름, 아이콘, 이동할 경로를 정의합니다
   */
  const tabs = [
    {
      label: '항공',
      icon: 'flight',
      path: '/reservations/flights'
    },
    {
      label: '기차',
      icon: 'train',
      path: '/reservations/trains/search'
    },
    {
      label: '지하철',
      icon: 'subway',
      path: '/reservations/subway/search'
    },
  ];

  /**
   * 탭 클릭 핸들러
   * 클릭한 탭의 검색 페이지로 이동합니다
   *
   * 매개변수:
   * index - 클릭한 탭의 인덱스 (0, 1, 2)
   */
  const handleTabClick = (index) => {
    navigate(tabs[index].path);
  };

  return (
    <div className="flex border-b border-slate-200 dark:border-slate-700">
      {tabs.map((tab, index) => (
        <button
          key={tab.label}
          onClick={() => handleTabClick(index)}
          className={`
            px-6 py-4 font-medium transition-all duration-300
            flex items-center gap-2
            ${
              activeTab === index
                ? 'text-primary border-b-[3px] border-primary'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }
          `}
        >
          {/* Material Symbols 아이콘 */}
          <span className="material-symbols-rounded text-xl">
            {tab.icon}
          </span>

          {/* 탭 이름 */}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TransportTabs;
