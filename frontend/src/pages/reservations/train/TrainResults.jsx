import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';
import { API_LANG_CODES } from '../../../constants/translations';

/**
 * 기차 검색 결과 페이지
 * 검색된 기차편 목록을 표시하고 외부 예매 사이트로 연결합니다
 *
 * 주의사항:
 * - 자체 예약/결제 기능 없음 (코레일/SRT로 리다이렉트)
 * - DB에 저장하지 않음 (Stateless)
 *
 * 사용 예시:
 * <Route path="/trains/results" element={<TrainResults />} />
 */
const TrainResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  /**
   * 이전 페이지(TrainSearch)에서 전달받은 검색 조건
   * searchParams - 검색 파라미터 (depPlaceId, arrPlaceId, depDate, trainGradeCode)
   * depStationName - 출발역 이름
   * arrStationName - 도착역 이름
   */
  const { searchParams, depStationName, arrStationName } = location.state || {};

  /**
   * 검색 결과 데이터
   */
  const [trains, setTrains] = useState([]);
  const [translatedStations, setTranslatedStations] = useState(null);

  /**
   * 로딩 상태
   */
  const [loading, setLoading] = useState(true);

  /**
   * 에러 메시지
   */
  const [error, setError] = useState(null);

  /**
   * 페이지 로드시 기차편 검색
   */
  useEffect(() => {
    /**
     * 검색 조건이 없으면 검색 페이지로 리다이렉트
     */
    if (!searchParams) {
      navigate('/reservations/trains');
      return;
    }

    fetchTrains();
  }, [searchParams, navigate, language]);

  /**
   * 백엔드 API로 기차편 검색
   * GET /api/v1/transport/trains/search
   */
  const translateTrainsIfNeeded = async (trainList) => {
    const targetLang = API_LANG_CODES[language] || 'eng_Latn';
    if (targetLang === 'kor_Hang') {
      setTranslatedStations(null);
      return trainList;
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

    addText(depStationName);
    addText(arrStationName);
    trainList.forEach((train) => {
      addText(train.departureStation);
      addText(train.arrivalStation);
    });

    if (texts.length === 0) {
      setTranslatedStations(null);
      return trainList;
    }

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

      setTranslatedStations({
        dep: translatedMap.get(depStationName) || depStationName,
        arr: translatedMap.get(arrStationName) || arrStationName
      });

      return trainList.map((train) => ({
        ...train,
        departureStation_translated: translatedMap.get(train.departureStation) || train.departureStation,
        arrivalStation_translated: translatedMap.get(train.arrivalStation) || train.arrivalStation
      }));
    } catch (err) {
      console.warn('Train translation failed, using original:', err);
      setTranslatedStations(null);
      return trainList;
    }
  };

  const fetchTrains = async () => {
    setLoading(true);
    setError(null);

    try {
      /**
       * 쿼리 파라미터 구성
       * 백엔드는 역 이름을 기대합니다
       */
      const params = {
        fromStation: depStationName,
        toStation: arrStationName,
        departDate: searchParams.depDate,
        passengers: 1,
      };

      /**
       * API 호출
       */
      const response = await axios.get('/v1/transport/trains/search/', { params });

      /**
       * 검색 결과 저장
       * 백엔드 응답: { results: [...], totalCount: n }
       */
      const baseTrains = response.data.results || [];
      const translatedTrains = await translateTrainsIfNeeded(baseTrains);
      setTrains(translatedTrains);

      /**
       * 결과가 없으면 안내 메시지 표시
       */
      if (!response.data.results || response.data.results.length === 0) {
        setError(t('msg_no_trains_found'));
      }
    } catch (err) {
      console.error('기차편 검색 오류:', err);

      /**
       * 백엔드 에러 메시지 처리
       */
      const errorMsg = err.response?.data?.error || t('msg_train_search_error');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 예매하기 버튼 클릭 핸들러
   * 열차 종류에 따라 코레일 또는 SRT 홈페이지로 이동
   */
  const handleBooking = (train) => {
    /**
     * 열차종류에 따라 예매 사이트 결정
     * SRT는 SRT 홈페이지, 나머지는 코레일 홈페이지
     */
    const isSRT = train.trainType && train.trainType.includes('SRT');
    const bookingUrl = isSRT
      ? 'https://etk.srail.kr'
      : 'https://www.korail.com/intro';

    /**
     * 새 창으로 예매 사이트 열기
     */
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * 날짜 포맷팅 함수 (YYYY-MM-DD → YYYY년 MM월 DD일)
   */
  const formatDate = (dateString) => {
    if (!dateString || dateString.length !== 10) return dateString;
    const year = dateString.substring(0, 4);
    const month = dateString.substring(5, 7);
    const day = dateString.substring(8, 10);
    return `${year}년 ${month}월 ${day}일`;
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
            <p className="text-gray-600 dark:text-gray-400">{t('msg_searching_trains')}</p>
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
          {/* 왼쪽 영역: 검색 결과 */}
          <div className="lg:col-span-8">
            {/* 검색 조건 표시 */}
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-4 mb-6">
              {/* 상단: 출발역 → 도착역 */}
              <div className="flex items-center justify-center gap-4 mb-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {translatedStations?.dep || depStationName}
                </span>
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {translatedStations?.arr || arrStationName}
                </span>
              </div>
              {/* 하단: 날짜 + 조건변경 버튼 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(searchParams.depDate)}</span>
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
            {trains.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('title_search_results_count').replace('{count}', trains.length)}
                </h2>
              </div>
            )}

            {/* 기차편 목록 */}
            <div className="space-y-4">
              {trains.map((train, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm hover:shadow-md transition-shadow p-5"
                >
                  {/* 열차 종류 및 번호 - 첫 번째 줄 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* 열차 종류 배지 */}
                      <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${train.trainType && train.trainType.includes('KTX')
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : train.trainType && train.trainType.includes('SRT')
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}>
                        {train.trainType}
                      </span>
                      {/* 열차 번호 */}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {train.trainNo}
                      </span>
                    </div>
                    {/* 요금 표시 */}
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('label_adult_fare')}</p>
                      <p className="text-xl font-bold text-primary">{train.adultFare?.toLocaleString()}원</p>
                    </div>
                  </div>

                  {/* 시간 정보 - 두 번째 줄 (중앙 정렬) */}
                  <div className="flex items-center justify-center gap-6 mb-3">
                    {/* 출발 */}
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{train.departureTime}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {train.departureStation_translated || train.departureStation}
                      </p>
                    </div>
                    {/* 화살표 및 소요시간 */}
                    <div className="flex flex-col items-center">
                      <p className="text-xs text-gray-400 mb-1">{train.duration}</p>
                      <div className="w-16 h-px bg-slate-300 dark:bg-slate-600 relative">
                        <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-primary text-sm">train</span>
                      </div>
                    </div>
                    {/* 도착 */}
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{train.arrivalTime}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {train.arrivalStation_translated || train.arrivalStation}
                      </p>
                    </div>
                  </div>

                  {/* 예매 버튼 - 세 번째 줄 */}
                  <button
                    onClick={() => handleBooking(train)}
                    className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>{t('btn_book_ticket')}</span>
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                </div>
              ))}
            </div>

            {/* 결과가 없을 때 */}
            {trains.length === 0 && !error && (
              <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-12 text-center">
                <span className="material-symbols-outlined text-gray-400 text-6xl mb-4 block">
                  search_off
                </span>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('msg_no_trains_empty')}
                </p>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {t('btn_search_other_conditions')}
                </button>
              </div>
            )}

            {/* 예매 안내 */}
            {trains.length > 0 && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                    info
                  </span>
                  {t('title_booking_guide')}
                </h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                  <li>{t('info_booking_1')}</li>
                  <li>{t('info_booking_2')}</li>
                  <li>{t('info_booking_3')}</li>
                  <li>{t('info_booking_4')}</li>
                  <li>{t('info_booking_5')}</li>
                </ul>
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

export default TrainResults;
