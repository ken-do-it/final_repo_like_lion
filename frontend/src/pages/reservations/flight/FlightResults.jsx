import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from '../../../api/axios';
import { TransportTabs, ReservationSidebar } from '../reservations-components';

/**
 * 항공권 검색 결과 페이지
 *
 * 기능:
 * - URL 쿼리 파라미터로부터 검색 조건 읽기
 * - 항공편 목록 API 호출 및 표시
 * - 가격/시간/항공사 필터링
 * - 정렬 기능 (최저가, 최단시간, 출발시간)
 * - 항공편 선택 시 좌석 선택 페이지로 이동
 */
const FlightResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * 검색 조건 (URL 파라미터에서 가져옴)
   */
  const searchConditions = {
    depAirportId: searchParams.get('depAirportId'),
    arrAirportId: searchParams.get('arrAirportId'),
    depDate: searchParams.get('depDate'),
    retDate: searchParams.get('retDate') || '',
    tripType: searchParams.get('tripType') || 'oneway',
    airlineId: searchParams.get('airlineId') || '',
    passengers: parseInt(searchParams.get('passengers')) || 1,
    seatClass: searchParams.get('seatClass') || 'economy',
  };

  /**
   * 상태 관리
   */
  const [flights, setFlights] = useState([]);           // 항공편 목록
  const [filteredFlights, setFilteredFlights] = useState([]); // 필터링된 항공편
  const [loading, setLoading] = useState(true);         // 로딩 상태
  const [error, setError] = useState(null);             // 에러 상태

  /**
   * 필터 및 정렬 상태
   */
  const [sortBy, setSortBy] = useState('price');        // 정렬 기준 (price/time/departure)
  const [selectedAirline, setSelectedAirline] = useState(''); // 선택된 항공사
  const [priceRange, setPriceRange] = useState([0, 500000]); // 가격 범위

  /**
   * 컴포넌트 마운트 시 항공편 검색
   */
  useEffect(() => {
    if (!searchConditions.depAirportId || !searchConditions.arrAirportId) {
      // 필수 검색 조건이 없으면 검색 페이지로 리다이렉트
      navigate('/reservations/flights');
      return;
    }
    fetchFlights();
  }, []);

  /**
   * 필터 또는 정렬 조건 변경 시 재적용
   */
  useEffect(() => {
    applyFiltersAndSort();
  }, [flights, sortBy, selectedAirline, priceRange]);

  /**
   * 항공편 검색 API 호출
   */
  const fetchFlights = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        depAirportId: searchConditions.depAirportId,
        arrAirportId: searchConditions.arrAirportId,
        depDate: searchConditions.depDate,
        ...(searchConditions.airlineId && { airlineId: searchConditions.airlineId }),
      };

      const response = await axios.get('/v1/transport/flights/search/', { params });

      // API 응답 구조: { flights: [], pagination: {} }
      setFlights(response.data.flights || []);
    } catch (err) {
      console.error('항공편 검색 실패:', err);
      setError('항공편을 불러오는데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 필터 및 정렬 적용 함수
   */
  const applyFiltersAndSort = () => {
    let filtered = [...flights];

    // 1. 항공사 필터
    if (selectedAirline) {
      filtered = filtered.filter(flight => flight.airlineName === selectedAirline);
    }

    // 2. 가격 필터
    filtered = filtered.filter(flight => {
      const price = searchConditions.seatClass === 'economy'
        ? flight.economyCharge
        : flight.prestigeCharge;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // 3. 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          // 가격순 정렬 (저렴한 순)
          const priceA = searchConditions.seatClass === 'economy'
            ? a.economyCharge
            : a.prestigeCharge;
          const priceB = searchConditions.seatClass === 'economy'
            ? b.economyCharge
            : b.prestigeCharge;
          return priceA - priceB;

        case 'time':
          // 소요시간순 정렬 (짧은 순)
          return (a.arrPlandTime - a.depPlandTime) - (b.arrPlandTime - b.depPlandTime);

        case 'departure':
          // 출발시간순 정렬 (이른 순)
          return a.depPlandTime.localeCompare(b.depPlandTime);

        default:
          return 0;
      }
    });

    setFilteredFlights(filtered);
  };

  /**
   * 항공사 목록 추출 (중복 제거)
   */
  const getUniqueAirlines = () => {
    const airlines = flights.map(flight => flight.airlineName);
    return [...new Set(airlines)];
  };

  /**
   * 시간 포맷팅 함수
   * "202501151430" -> "14:30"
   */
  const formatTime = (timeString) => {
    if (!timeString || timeString.length < 12) return timeString;
    const hours = timeString.substring(8, 10);
    const minutes = timeString.substring(10, 12);
    return `${hours}:${minutes}`;
  };

  /**
   * 소요시간 계산 함수
   */
  const calculateDuration = (depTime, arrTime) => {
    if (!depTime || !arrTime) return '-';

    const depHour = parseInt(depTime.substring(8, 10));
    const depMin = parseInt(depTime.substring(10, 12));
    const arrHour = parseInt(arrTime.substring(8, 10));
    const arrMin = parseInt(arrTime.substring(10, 12));

    let totalMinutes = (arrHour * 60 + arrMin) - (depHour * 60 + depMin);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}시간 ${minutes}분`;
  };

  /**
   * 항공편 선택 핸들러
   * 좌석 선택 페이지로 이동
   */
  const handleSelectFlight = (flight) => {
    // 선택한 항공편 정보를 state로 전달하며 좌석 선택 페이지로 이동
    navigate('/reservations/flights/seat', {
      state: {
        flight,
        searchConditions,
      }
    });
  };

  /**
   * 검색 조건 수정 버튼 핸들러
   */
  const handleModifySearch = () => {
    navigate('/reservations/flights');
  };

  /**
   * 로딩 중 화면
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-rounded text-6xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            최적의 항공편을 찾고 있습니다...
          </p>
        </div>
      </div>
    );
  }

  /**
   * 에러 화면
   */
  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-background-dark">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <span className="material-symbols-rounded text-6xl text-red-500 mb-4">
              error
            </span>
            <p className="text-red-800 dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={handleModifySearch}
              className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors"
            >
              다시 검색하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          항공편 검색 결과
        </h1>

        {/* 탭 네비게이션 */}
        <TransportTabs />

        {/* 검색 조건 요약 카드 */}
        <div className="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-md mt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-primary">
                flight_takeoff
              </span>
              <span className="font-medium dark:text-white">
                {searchConditions.depAirportId}
              </span>
            </div>

            <span className="material-symbols-rounded text-slate-400">
              arrow_forward
            </span>

            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-primary">
                flight_land
              </span>
              <span className="font-medium dark:text-white">
                {searchConditions.arrAirportId}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-slate-400">
                calendar_today
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {searchConditions.depDate}
              </span>
            </div>

            {searchConditions.tripType === 'roundtrip' && searchConditions.retDate && (
              <>
                <span className="material-symbols-rounded text-slate-400">arrow_forward</span>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-slate-400">calendar_today</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {searchConditions.retDate}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-slate-400">
                person
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {searchConditions.passengers}명
              </span>
            </div>
          </div>

          <button
            onClick={handleModifySearch}
            className="px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
          >
            검색 조건 수정
          </button>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 왼쪽: 필터 영역 */}
          <aside className="lg:col-span-3">
            <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-lg sticky top-8">
              <h3 className="font-semibold text-lg mb-4 dark:text-white">
                필터
              </h3>

              {/* 정렬 옵션 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  정렬 기준
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg"
                >
                  <option value="price">최저가순</option>
                  <option value="time">최단시간순</option>
                  <option value="departure">출발시간순</option>
                </select>
              </div>

              {/* 항공사 필터 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  항공사
                </label>
                <select
                  value={selectedAirline}
                  onChange={(e) => setSelectedAirline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg"
                >
                  <option value="">전체</option>
                  {getUniqueAirlines().map((airline) => (
                    <option key={airline} value={airline}>
                      {airline}
                    </option>
                  ))}
                </select>
              </div>

              {/* 필터 초기화 버튼 */}
              <button
                onClick={() => {
                  setSortBy('price');
                  setSelectedAirline('');
                  setPriceRange([0, 500000]);
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          </aside>

          {/* 오른쪽: 검색 결과 및 사이드바 */}
          <main className="lg:col-span-9">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 항공편 목록 */}
              <div className="lg:col-span-2 space-y-4">
                {/* 결과 수 표시 */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    총 <span className="font-semibold text-primary">{filteredFlights.length}</span>개의 항공편
                  </p>
                </div>

                {/* 항공편 카드 목록 */}
                {filteredFlights.length === 0 ? (
                  <div className="bg-white dark:bg-surface-dark rounded-xl p-8 text-center">
                    <span className="material-symbols-rounded text-6xl text-gray-300 dark:text-gray-600 mb-4">
                      flight
                    </span>
                    <p className="text-gray-600 dark:text-gray-400">
                      검색 조건에 맞는 항공편이 없습니다.
                    </p>
                  </div>
                ) : (
                  filteredFlights.map((flight, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-surface-dark rounded-xl shadow-md p-6
                               hover:shadow-lg transition-all duration-300 cursor-pointer"
                      onClick={() => handleSelectFlight(flight)}
                    >
                      {/* 항공사 정보 */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-rounded text-primary">
                              airlines
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold dark:text-white">
                              {flight.airlineName}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {flight.flightNumber}
                            </p>
                          </div>
                        </div>

                        {/* 최저가 뱃지 (첫 번째 항목에만) */}
                        {index === 0 && (
                          <span className="px-3 py-1 bg-mint/10 text-mint text-sm font-medium rounded-full">
                            최저가
                          </span>
                        )}
                      </div>

                      {/* 시간 정보 */}
                      <div className="flex items-center justify-between mb-4">
                        {/* 출발 정보 */}
                        <div className="text-center">
                          <p className="text-2xl font-bold dark:text-white">
                            {formatTime(flight.depPlandTime)}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {flight.departureAirport}
                          </p>
                        </div>

                        {/* 비행 정보 */}
                        <div className="flex-1 mx-4 flex flex-col items-center">
                          <p className="text-xs text-slate-400 mb-1">
                            {calculateDuration(flight.depPlandTime, flight.arrPlandTime)}
                          </p>
                          <div className="w-full h-px bg-slate-300 dark:bg-slate-600 relative">
                            <span className="material-symbols-rounded absolute left-1/2 -translate-x-1/2 -top-2 text-primary text-sm">
                              flight
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">직항</p>
                        </div>

                        {/* 도착 정보 */}
                        <div className="text-center">
                          <p className="text-2xl font-bold dark:text-white">
                            {formatTime(flight.arrPlandTime)}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {flight.arrivalAirport}
                          </p>
                        </div>
                      </div>

                      {/* 가격 정보 */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {searchConditions.seatClass === 'economy' ? '일반석' : '비즈니스석'}
                          </p>
                          <p className="text-xl font-bold text-primary">
                            {(searchConditions.seatClass === 'economy'
                              ? flight.economyCharge
                              : flight.prestigeCharge
                            ).toLocaleString()}원
                          </p>
                        </div>
                        <button
                          className="px-6 py-2 bg-primary hover:bg-primary-dark text-white
                                   rounded-xl font-medium transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectFlight(flight);
                          }}
                        >
                          선택하기
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 사이드바 */}
              <div className="lg:col-span-1">
                <ReservationSidebar />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default FlightResults;
