import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 지하철 경로 결과 페이지
 * 검색된 최적 경로를 표시하고 카카오맵으로 연결합니다
 *
 * 주의사항:
 * - 예약/결제 기능 없음 (정보 제공만)
 * - 최대 3개 경로 표시
 * - 카카오맵 길찾기 연동
 *
 * 사용 예시:
 * <Route path="/subway/route" element={<SubwayRoute />} />
 */
const SubwayRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  /**
   * 이전 페이지(SubwaySearch)에서 전달받은 검색 조건
   * searchParams - 검색 파라미터 (fromStation, toStation, option)
   */
  const { searchParams } = location.state || {};

  /**
   * 검색 결과 데이터 (최대 3개 경로)
   */
  const [routes, setRoutes] = useState([]);

  /**
   * 로딩 상태
   */
  const [loading, setLoading] = useState(true);

  /**
   * 에러 메시지
   */
  const [error, setError] = useState(null);

  /**
   * 페이지 로드시 경로 검색
   */
  useEffect(() => {
    /**
     * 검색 조건이 없으면 검색 페이지로 리다이렉트
     */
    if (!searchParams) {
      navigate('/reservations/subway');
      return;
    }

    fetchRoutes();
  }, [searchParams, navigate]);

  /**
   * 백엔드 API로 지하철 경로 검색
   * GET /api/v1/transport/subway/route
   */
  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);

    try {
      /**
       * 쿼리 파라미터 구성
       */
      const params = {
        fromStation: searchParams.fromStation,
        toStation: searchParams.toStation,
        option: searchParams.option,
      };

      /**
       * API 호출
       */
      const response = await axios.get('/v1/transport/subway/route/', { params });

      /**
       * 검색 결과 저장
       */
      setRoutes(response.data.routes || []);

      /**
       * 결과가 없으면 안내 메시지 표시
       */
      if (!response.data.routes || response.data.routes.length === 0) {
        setError(t('msg_no_route_found_detail'));
      }
    } catch (err) {
      console.error('지하철 경로 검색 오류:', err);

      /**
       * 백엔드 에러 메시지 처리
       */
      if (err.response?.data?.error) {
        const errorMsg = err.response.data.error.message || t('msg_subway_search_error');
        setError(errorMsg);
      } else {
        setError(t('msg_subway_search_error'));
      }
    } finally {
      setLoading(false);
    }
  };


  /**
   * 검색 옵션 한글 변환
   */
  const getOptionLabel = (option) => {
    switch (option) {
      case 'FAST': return t('option_fast');
      case 'FEW_TRANSFER': return t('option_few_transfer');
      case 'CHEAP': return t('option_cheap');
      default: return option;
    }
  };

  /**
   * 로딩 중 화면
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <TransportTabs />
          <div className="mt-6 text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('msg_searching_route')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* 왼쪽 영역: 경로 결과 */}
          <div className="lg:col-span-8">
            {/* 검색 조건 표시 */}
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {searchParams.fromStation}
                  </div>
                  <span className="material-symbols-outlined text-gray-400">
                    arrow_forward
                  </span>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {searchParams.toStation}
                  </div>
                  <div className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full">
                    {getOptionLabel(searchParams.option)}
                  </div>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  {t('btn_change_conditions')}
                </button>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400">
                    info
                  </span>
                  <p className="text-yellow-700 dark:text-yellow-300">{error}</p>
                </div>
              </div>
            )}

            {/* 검색 결과 헤더 */}
            {routes.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('title_recommend_routes').replace('{count}', routes.length)}
                </h2>
              </div>
            )}

            {/* 경로 목록 */}
            <div className="space-y-4">
              {routes.map((route, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-6"
                >
                  {/* 경로 헤더 */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-primary">
                        {t('label_route_n').replace('{n}', index + 1)}
                      </span>
                      {index === 0 && (
                        <span className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                          {t('badge_recommend')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-400">{t('label_duration')}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {route.duration}{t('unit_min')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-400">{t('label_transfers')}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {route.transfers}{t('unit_times')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-400">{t('label_fare')}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {route.fare?.card?.toLocaleString()}{t('unit_krw')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 경로 상세 */}
                  <div className="space-y-4">
                    {route.steps?.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-start gap-4">
                        {/* 노선 표시 */}
                        <div className="flex-shrink-0 w-24">
                          <div
                            className="px-3 py-1 rounded-lg text-white text-sm font-semibold text-center"
                            style={{ backgroundColor: step.lineColor || '#666' }}
                          >
                            {step.line}
                          </div>
                        </div>

                        {/* 역 정보 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {step.from}
                            </span>
                            <span className="material-symbols-outlined text-gray-400 text-sm">
                              arrow_forward
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {step.to}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('desc_route_step').replace('{stations}', step.stations).replace('{duration}', step.duration)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 결과가 없을 때 */}
            {routes.length === 0 && !error && (
              <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-12 text-center">
                <span className="material-symbols-outlined text-gray-400 text-6xl mb-4 block">
                  search_off
                </span>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('msg_no_route_found')}
                </p>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {t('btn_search_again')}
                </button>
              </div>
            )}

            {/* 안내 사항 */}
            {routes.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                      info
                    </span>
                    {t('title_usage_guide')}
                  </h3>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                    <li>{t('info_route_1')}</li>
                    <li>{t('info_route_2')}</li>
                    <li>{t('info_route_3')}</li>
                    <li>{t('info_route_4')}</li>
                  </ul>
                </div>

                {/* ODsay 크레딧 표시 */}
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('label_provider')} <a href="https://www.odsay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ODsay.com</a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽 영역: 사이드바 */}
          <div className="lg:col-span-4">
            <ReservationSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubwayRoute;
