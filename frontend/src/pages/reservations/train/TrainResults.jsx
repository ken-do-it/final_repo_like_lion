import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

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
  }, [searchParams, navigate]);

  /**
   * 백엔드 API로 기차편 검색
   * GET /api/v1/transport/trains/search
   */
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
      setTrains(response.data.results || []);

      /**
       * 결과가 없으면 안내 메시지 표시
       */
      if (!response.data.results || response.data.results.length === 0) {
        setError('검색된 기차편이 없습니다. 다른 조건으로 검색해주세요.');
      }
    } catch (err) {
      console.error('기차편 검색 오류:', err);

      /**
       * 백엔드 에러 메시지 처리
       */
      const errorMsg = err.response?.data?.error || '기차편 검색 중 오류가 발생했습니다.';
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
      : 'https://www.letskorail.com';

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
            <p className="text-gray-600 dark:text-gray-400">기차편을 검색하고 있습니다...</p>
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
        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* 왼쪽 영역: 검색 결과 */}
          <div className="col-span-8">
            {/* 검색 조건 표시 */}
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {depStationName}
                  </div>
                  <span className="material-symbols-outlined text-gray-400">
                    arrow_forward
                  </span>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {arrStationName}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(searchParams.depDate)}
                  </div>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  검색 조건 변경
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
                  검색 결과 ({trains.length}개)
                </h2>
              </div>
            )}

            {/* 기차편 목록 */}
            <div className="space-y-4">
              {trains.map((train, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-surface-dark rounded-xl shadow-sm hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-center justify-between">
                    {/* 왼쪽: 열차 정보 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        {/* 열차 종류 배지 */}
                        <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                          train.trainType && train.trainType.includes('KTX')
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

                      {/* 출발/도착 정보 */}
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* 출발 */}
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {train.departureTime}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {train.departureStation}
                          </p>
                        </div>

                        {/* 화살표 및 소요시간 */}
                        <div className="text-center">
                          <span className="material-symbols-outlined text-gray-400">
                            arrow_forward
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {train.duration}
                          </p>
                        </div>

                        {/* 도착 */}
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {train.arrivalTime}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {train.arrivalStation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 요금 및 예매 버튼 */}
                    <div className="ml-6 text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        어른 요금
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        {train.adultFare?.toLocaleString()}원
                      </p>
                      <button
                        onClick={() => handleBooking(train)}
                        className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                      >
                        <span>예매하기</span>
                        <span className="material-symbols-outlined text-sm">
                          open_in_new
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 결과가 없을 때 */}
            {trains.length === 0 && !error && (
              <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-12 text-center">
                <span className="material-symbols-outlined text-gray-400 text-6xl mb-4 block">
                  search_off
                </span>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  검색된 기차편이 없습니다
                </p>
                <button
                  onClick={() => navigate(-1)}
                  className="text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  다른 조건으로 검색하기
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
                  예매 안내
                </h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                  <li>예매하기 버튼을 클릭하면 외부 예매 사이트로 이동합니다</li>
                  <li>KTX, ITX, 새마을호, 무궁화호는 코레일 홈페이지에서 예매하세요</li>
                  <li>SRT는 SRT 홈페이지에서만 예매 가능합니다</li>
                  <li>예매 사이트에서 열차편과 좌석을 선택하여 예매를 완료하세요</li>
                  <li>결제는 외부 사이트에서 진행됩니다</li>
                </ul>
              </div>
            )}
          </div>

          {/* 오른쪽 영역: 사이드바 */}
          <div className="col-span-4">
            <ReservationSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainResults;
