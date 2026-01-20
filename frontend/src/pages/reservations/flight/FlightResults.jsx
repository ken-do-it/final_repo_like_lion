import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from '../../../api/axios';
import { useLanguage } from '../../../context/LanguageContext';
import { TransportTabs, ReservationSidebar } from '../reservations-components';

/**
 * 항공권 검색 결과 페이지
 *
 * 기능:
 * - 편도: 항공편 목록 표시 및 선택
 * - 왕복: 가는편 선택 → 오는편 선택 2단계 방식
 */
const FlightResults = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
    adults: parseInt(searchParams.get('adults')) || 1,
    children: parseInt(searchParams.get('children')) || 0,
    infants: parseInt(searchParams.get('infants')) || 0,
    seatClass: searchParams.get('seatClass') || 'ECONOMY',
  };

  const isRoundTrip = searchConditions.tripType === 'roundtrip';

  /**
   * 상태 관리
   */
  const [outboundFlights, setOutboundFlights] = useState([]); // 가는편 목록
  const [inboundFlights, setInboundFlights] = useState([]);   // 오는편 목록
  const [selectedOutbound, setSelectedOutbound] = useState(null); // 선택한 가는편
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 필터 및 정렬 상태
   */
  const [sortBy, setSortBy] = useState('price');
  const [selectedAirline, setSelectedAirline] = useState('');

  /**
   * 컴포넌트 마운트 시 항공편 검색
   */
  useEffect(() => {
    if (!searchConditions.depAirportId || !searchConditions.arrAirportId) {
      navigate('/reservations/flights');
      return;
    }
    fetchFlights();
  }, []);

  /**
   * 항공편 검색 API 호출
   */
  const fetchFlights = async () => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        tripType: searchConditions.tripType?.toUpperCase() || 'ONEWAY',
        from_airport: searchConditions.depAirportId,
        to: searchConditions.arrAirportId,
        departDate: searchConditions.depDate,
        ...(isRoundTrip && searchConditions.retDate && {
          returnDate: searchConditions.retDate
        }),
        passengers: {
          adults: searchConditions.adults,
          children: searchConditions.children,
          infants: searchConditions.infants
        },
        cabinClass: searchConditions.seatClass || 'ECONOMY',
        ...(searchConditions.airlineId && {
          filters: { airline: searchConditions.airlineId }
        }),
      };

      const response = await axios.post('/v1/transport/flights/search/', requestBody);
      const results = response.data.results || [];

      if (isRoundTrip) {
        // 왕복: outbound와 inbound 분리
        const outbound = [];
        const inbound = [];

        results.forEach(offer => {
          // 왕복 응답은 outbound/inbound가 있음
          if (offer.outbound) {
            outbound.push(mapFlightData(offer.outbound, 'outbound'));
          }
          if (offer.inbound) {
            inbound.push(mapFlightData(offer.inbound, 'inbound'));
          }
        });

        // 중복 제거 (offerId 기준)
        const uniqueOutbound = removeDuplicates(outbound);
        const uniqueInbound = removeDuplicates(inbound);

        setOutboundFlights(uniqueOutbound);
        setInboundFlights(uniqueInbound);
      } else {
        // 편도: 전체 목록을 outboundFlights에 저장
        const mappedFlights = results.map(offer => mapFlightData(offer, 'outbound'));
        setOutboundFlights(mappedFlights);
      }
    } catch (err) {
      console.error('항공편 검색 실패:', err);
      setError('항공편을 불러오는데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * API 응답을 프론트엔드 형식으로 변환
   */
  const mapFlightData = (offer, direction) => ({
    offerId: offer.offerId,
    airlineName: offer.airline,
    flightNumber: offer.flightNo,
    depAt: offer.depAt,
    arrAt: offer.arrAt,
    durationMin: offer.durationMin,
    totalPrice: offer.totalPrice,
    pricePerPerson: offer.pricePerPerson,
    currency: offer.currency || 'KRW',
    seatAvailabilityNote: offer.seatAvailabilityNote,
    direction: direction,
    // 출발/도착 공항 설정
    departureAirport: direction === 'outbound' ? searchConditions.depAirportId : searchConditions.arrAirportId,
    arrivalAirport: direction === 'outbound' ? searchConditions.arrAirportId : searchConditions.depAirportId,
  });

  /**
   * 중복 제거 함수
   */
  const removeDuplicates = (flights) => {
    const seen = new Set();
    return flights.filter(flight => {
      if (seen.has(flight.offerId)) return false;
      seen.add(flight.offerId);
      return true;
    });
  };

  /**
   * 항공편 정렬 함수
   */
  const sortFlights = (flights) => {
    let filtered = [...flights];

    // 항공사 필터
    if (selectedAirline) {
      filtered = filtered.filter(f => f.airlineName === selectedAirline);
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.totalPrice || 0) - (b.totalPrice || 0);
        case 'departure':
          return (a.depAt || '').localeCompare(b.depAt || '');
        case 'time':
          return (a.durationMin || 0) - (b.durationMin || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  /**
   * 항공사 목록 추출
   */
  const getUniqueAirlines = (flights) => {
    const airlines = flights.map(f => f.airlineName).filter(Boolean);
    return [...new Set(airlines)];
  };

  /**
   * 시간 포맷팅 (ISO -> HH:MM)
   */
  /**
   * 시간 포맷팅 (ISO -> HH:MM)
   */
  const formatTime = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return isoString;
    }
  };

  /**
   * 날짜 포맷팅 (ISO -> M.DD(요일))
   */
  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const weekdays = [t('weekday_sun'), t('weekday_mon'), t('weekday_tue'), t('weekday_wed'), t('weekday_thu'), t('weekday_fri'), t('weekday_sat')];
      return `${date.getMonth() + 1}.${date.getDate()}(${weekdays[date.getDay()]})`;
    } catch {
      return '';
    }
  };

  /**
   * 소요시간 포맷팅
   */
  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}${t('unit_hour')} ${mins}${t('unit_min')}`;
  };

  /**
   * 가는편 선택 핸들러
   */
  const handleSelectOutbound = (flight) => {
    if (isRoundTrip) {
      setSelectedOutbound(flight);
    } else {
      // 편도: 바로 다음 페이지로
      handleProceedToSeat(flight, null);
    }
  };

  /**
   * 오는편 선택 핸들러 (왕복만)
   */
  const handleSelectInbound = (flight) => {
    handleProceedToSeat(selectedOutbound, flight);
  };

  /**
   * 좌석 선택 페이지로 이동
   */
  const handleProceedToSeat = (outbound, inbound) => {
    navigate('/reservations/flights/seat', {
      state: {
        outboundFlight: outbound,
        inboundFlight: inbound,
        searchConditions,
        isRoundTrip,
      }
    });
  };

  /**
   * 선택한 가는편 변경 (다시 선택)
   */
  const handleChangeOutbound = () => {
    setSelectedOutbound(null);
  };

  /**
   * 검색 조건 수정
   */
  const handleModifySearch = () => {
    navigate('/reservations/flights');
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            {t('flight_searching_best')}
          </p>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
            <p className="text-red-800 dark:text-red-300 mb-4">{error || t('flight_load_error_retry')}</p>
            <button onClick={handleModifySearch} className="px-6 py-3 bg-primary text-white rounded-xl">
              {t('btn_retry_search')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sortedOutbound = sortFlights(outboundFlights);
  const sortedInbound = sortFlights(inboundFlights);
  const currentFlights = isRoundTrip && selectedOutbound ? sortedInbound : sortedOutbound;
  const allAirlines = getUniqueAirlines(currentFlights);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">{t('flight_search_results_title')}</h1>

        {/* 탭 */}
        <TransportTabs />

        {/* 검색 조건 요약 */}
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-4 shadow-md mt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">flight_takeoff</span>
              <span className="font-medium dark:text-white">{searchConditions.depAirportId}</span>
            </div>
            <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">flight_land</span>
              <span className="font-medium dark:text-white">{searchConditions.arrAirportId}</span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {searchConditions.depDate}
              {isRoundTrip && ` ~ ${searchConditions.retDate}`}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {searchConditions.adults + searchConditions.children + searchConditions.infants}명
            </span>
            {isRoundTrip && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">{t('flight_roundtrip_badge')}</span>
            )}
          </div>
          <button onClick={handleModifySearch} className="px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors">
            {t('btn_modify_search')}
          </button>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 왼쪽: 필터 */}
          <aside className="lg:col-span-3">
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-lg sticky top-8">
              <h3 className="font-semibold text-lg mb-4 dark:text-white">{t('filter_title')}</h3>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sort_by')}</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg">
                  <option value="price">{t('sort_price')}</option>
                  <option value="departure">{t('sort_departure')}</option>
                  <option value="time">{t('sort_duration')}</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('flight_airline_label')}</label>
                <select value={selectedAirline} onChange={(e) => setSelectedAirline(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg">
                  <option value="">{t('filter_all')}</option>
                  {allAirlines.map((airline) => (
                    <option key={airline} value={airline}>{airline}</option>
                  ))}
                </select>
              </div>

              <button onClick={() => { setSortBy('price'); setSelectedAirline(''); }} className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                {t('btn_reset_filter')}
              </button>
            </div>
          </aside>

          {/* 오른쪽: 항공편 목록 */}
          <main className="lg:col-span-9">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">

                {/* 왕복: 선택한 가는편 표시 */}
                {isRoundTrip && selectedOutbound && (
                  <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-md border-2 border-primary">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('selected_outbound')}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary">airlines</span>
                        </div>
                        <div>
                          <p className="font-medium dark:text-white">{selectedOutbound.airlineName} {selectedOutbound.flightNumber}</p>
                          <p className="text-sm text-gray-500">{formatDate(selectedOutbound.depAt)}</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold dark:text-white">{formatTime(selectedOutbound.depAt)} - {formatTime(selectedOutbound.arrAt)}</p>
                        <p className="text-sm text-gray-500">{formatDuration(selectedOutbound.durationMin)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{(selectedOutbound.totalPrice || 0).toLocaleString()}{t('unit_krw')}</p>
                      </div>
                    </div>
                    <button onClick={handleChangeOutbound} className="mt-4 w-full py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-slate-700">
                      {t('btn_change_flight')}
                    </button>
                  </div>
                )}

                {/* 섹션 제목 */}
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-primary">
                    {isRoundTrip
                      ? (selectedOutbound ? t('msg_select_inbound') : t('msg_select_outbound'))
                      : t('msg_select_flight')
                    }
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {isRoundTrip && !selectedOutbound && `${formatDate(searchConditions.depDate)}, `}
                    {isRoundTrip && selectedOutbound && `${formatDate(searchConditions.retDate)}, `}
                    {currentFlights.length}{t('flight_price_info_suffix')}
                  </p>
                </div>

                {/* 항공편 목록 */}
                {currentFlights.length === 0 ? (
                  <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-8 text-center">
                    <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">flight</span>
                    <p className="text-gray-600 dark:text-gray-400">{t('msg_no_flights_found')}</p>
                  </div>
                ) : (
                  currentFlights.map((flight, index) => (
                    <div
                      key={flight.offerId || index}
                      className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-md p-5 hover:shadow-lg transition-all cursor-pointer border border-transparent hover:border-primary"
                      onClick={() => isRoundTrip && selectedOutbound ? handleSelectInbound(flight) : handleSelectOutbound(flight)}
                    >
                      <div className="flex items-center justify-between">
                        {/* 항공사 로고 & 정보 */}
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-sm">airlines</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{flight.airlineName}</p>
                          </div>
                        </div>

                        {/* 시간 정보 */}
                        <div className="flex items-center gap-4 flex-1 justify-center">
                          <div className="text-center">
                            <p className="text-lg font-bold dark:text-white">{formatTime(flight.depAt)}</p>
                            <p className="text-xs text-gray-500">{flight.departureAirport}</p>
                          </div>
                          <div className="flex flex-col items-center px-4">
                            <p className="text-xs text-gray-400 mb-1">{formatDuration(flight.durationMin)}</p>
                            <div className="w-20 h-px bg-slate-300 dark:bg-slate-600 relative">
                              <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-primary text-xs">flight</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{t('flight_direct')}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold dark:text-white">{formatTime(flight.arrAt)}</p>
                            <p className="text-xs text-gray-500">{flight.arrivalAirport}</p>
                          </div>
                        </div>

                        {/* 가격 */}
                        <div className="text-right min-w-[100px]">
                          <p className="text-xl font-bold text-primary">{(flight.pricePerPerson || flight.totalPrice || 0).toLocaleString()}{t('unit_krw')}</p>
                          {flight.seatAvailabilityNote && (
                            <p className="text-xs text-mint mt-1">{flight.seatAvailabilityNote}</p>
                          )}
                        </div>
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
