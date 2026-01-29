import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';
import { API_LANG_CODES } from '../../../constants/translations';

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
  const { t, language } = useLanguage();

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
   * 헤더(출발/도착역) 번역 상태
   */
  const [translatedHeader, setTranslatedHeader] = useState({
    from: searchParams?.fromStation || '',
    to: searchParams?.toStation || ''
  });

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

    translateHeader();
    fetchRoutes();
  }, [searchParams, navigate, language]);

  /**
   * 헤더(출발/도착역) 번역
   */
  const translateHeader = async () => {
    const targetLang = API_LANG_CODES[language] || 'eng_Latn';

    // 한국어면 원본 유지
    if (targetLang === 'kor_Hang') {
      setTranslatedHeader({
        from: searchParams?.fromStation || '',
        to: searchParams?.toStation || ''
      });
      return;
    }

    const texts = [];
    if (searchParams?.fromStation) texts.push(searchParams.fromStation);
    if (searchParams?.toStation) texts.push(searchParams.toStation);

    if (texts.length === 0) return;

    const getEntityId = (value) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };

    const payload = {
      source_lang: 'kor_Hang',
      target_lang: targetLang,
      items: texts.map((text) => ({
        text,
        entity_type: 'raw',
        entity_id: getEntityId(text),
        field: 'text'
      }))
    };

    try {
      const response = await axios.post('/translations/batch/', payload);
      const results = response.data?.results || {};

      const translatedMap = new Map(
        texts.map((text, idx) => [text, results[idx] || text])
      );

      setTranslatedHeader({
        from: translatedMap.get(searchParams?.fromStation) || searchParams?.fromStation,
        to: translatedMap.get(searchParams?.toStation) || searchParams?.toStation
      });
    } catch (err) {
      console.warn('Header translation failed:', err);
      setTranslatedHeader({
        from: searchParams?.fromStation || '',
        to: searchParams?.toStation || ''
      });
    }
  };

  /**
   * 백엔드 API로 지하철 경로 검색
   * GET /api/v1/transport/subway/route
   */
  const translateRoutesIfNeeded = async (routes) => {
    const targetLang = API_LANG_CODES[language] || 'eng_Latn';

    // 한국어면 원본 유지
    if (targetLang === 'kor_Hang') {
      return routes;
    }

    const getEntityId = (value) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };

    const texts = [];
    const textToIndex = new Map();
    const addText = (text) => {
      if (!text || textToIndex.has(text)) return;
      textToIndex.set(text, texts.length);
      texts.push(text);
    };

    // 2. 경로 내 역이름/호선 추가
    routes.forEach((route) => {
      route.steps?.forEach((step) => {
        addText(step.line);
        addText(step.from);
        addText(step.to);
      });
    });

    if (texts.length === 0) return routes;

    const payload = {
      source_lang: 'kor_Hang',
      target_lang: targetLang,
      items: texts.map((text) => ({
        text,
        entity_type: 'raw',
        entity_id: getEntityId(text),
        field: 'text'
      }))
    };

    try {
      const response = await axios.post('/translations/batch/', payload);
      const results = response.data?.results || {};
      const translatedMap = new Map(
        texts.map((text, idx) => [text, results[idx] || text])
      );

      return routes.map((route) => ({
        ...route,
        steps: route.steps?.map((step) => ({
          ...step,
          line_translated: translatedMap.get(step.line) || step.line,
          from_translated: translatedMap.get(step.from) || step.from,
          to_translated: translatedMap.get(step.to) || step.to
        }))
      }));
    } catch (err) {
      console.warn('Route translation failed, using original:', err);
      return routes;
    }
  };

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
      const baseRoutes = response.data.routes || [];
      const translatedRoutes = await translateRoutesIfNeeded(baseRoutes);
      setRoutes(translatedRoutes);

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
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">
                    {translatedHeader.from}
                  </div>
                  <span className="material-symbols-outlined text-gray-400 flex-shrink-0">
                    arrow_forward
                  </span>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[120px]">
                    {translatedHeader.to}
                  </div>
                  <div className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full whitespace-nowrap flex-shrink-0">
                    {getOptionLabel(searchParams.option)}
                  </div>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0"
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
                  className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6 break-words"
                >
                  {/* 경로 헤더 */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl font-bold text-primary">
                        {t('label_route_n').replace('{n}', index + 1)}
                      </span>
                      {index === 0 && (
                        <span className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                          {t('badge_recommend')}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 w-full sm:w-auto text-sm">
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
                      <div key={stepIndex} className="flex items-start gap-3">
                        {/* 노선 표시 */}
                        <div className="flex-shrink-0 w-28 sm:w-32">
                          <div
                            className="px-2 py-1 rounded-lg text-white text-xs sm:text-sm font-semibold text-center leading-tight break-words"
                            style={{ backgroundColor: step.lineColor || '#666' }}
                          >
                            {step.line_translated || step.line}
                          </div>
                        </div>

                        {/* 역 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate max-w-[100px] sm:max-w-[150px]">
                              {step.from_translated || step.from}
                            </span>
                            <span className="material-symbols-outlined text-gray-400 text-sm flex-shrink-0">
                              arrow_forward
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate max-w-[100px] sm:max-w-[150px]">
                              {step.to_translated || step.to}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
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
              <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-12 text-center">
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
                <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-4 text-center">
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
