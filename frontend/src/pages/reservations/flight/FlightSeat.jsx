import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { TransportTabs, ReservationSidebar } from '../reservations-components';

/**
 * 항공권 좌석 선택 페이지
 *
 * 기능:
 * - 선택한 항공편 정보 표시
 * - 일반석/비즈니스석 선택
 * - 좌석 등급별 가격 비교
 * - 탑승자 정보 입력 준비
 * - 결제 페이지로 이동
 */
const FlightSeat = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const location = useLocation();

  /**
   * 이전 페이지에서 전달받은 데이터
   * - 새 형식: outboundFlight, inboundFlight, searchConditions, isRoundTrip
   * - 기존 형식: flight, searchConditions (하위 호환성 유지)
   */
  const locationState = location.state || {};

  // 새 형식과 기존 형식 모두 지원
  const outboundFlight = locationState.outboundFlight || locationState.flight;
  const inboundFlight = locationState.inboundFlight || null;
  const searchConditions = locationState.searchConditions || {};
  const isRoundTrip = locationState.isRoundTrip || false;

  // 기존 코드 호환성을 위해 flight 변수 유지
  const flight = outboundFlight;

  // 승객 유형별 인원수
  const adults = searchConditions.adults || 1;
  const children = searchConditions.children || 0;
  const infants = searchConditions.infants || 0;
  const totalPassengers = searchConditions.passengers || (adults + children + infants);

  /**
   * 선택된 좌석 등급 상태
   * ECONOMY - 일반석
   * PREMIUM - 프리미엄 일반석
   * BUSINESS - 비즈니스석
   */
  const [selectedClass, setSelectedClass] = useState('ECONOMY');

  /**
   * 좌석 등급별 가격 배수
   * - ECONOMY: 1.0배
   * - PREMIUM: 1.5배
   * - BUSINESS: 2.0배
   */
  const getSeatClassMultiplier = () => {
    switch (selectedClass) {
      case 'PREMIUM': return 1.5;
      case 'BUSINESS': return 2.0;
      case 'ECONOMY':
      default: return 1.0;
    }
  };

  /**
   * 좌석 등급 정보
   */
  const seatClassOptions = [
    { value: 'ECONOMY', label: t('class_economy'), multiplier: 1.0, description: t('class_desc_economy') },
    { value: 'PREMIUM', label: t('class_premium'), multiplier: 1.5, description: t('class_desc_premium') },
    { value: 'BUSINESS', label: t('class_business'), multiplier: 2.0, description: t('class_desc_business') },
  ];

  /**
   * 할인율 적용 총 가격 계산
   * - 좌석 등급: ECONOMY 1배, PREMIUM 1.5배, BUSINESS 2배
   * - 성인: 100%
   * - 소아 (2-11세): 75%
   * - 유아 (0-1세): 10%
   */
  const calculateDiscountedTotal = (pricePerPerson) => {
    const seatMultiplier = getSeatClassMultiplier();
    const adjustedPrice = pricePerPerson * seatMultiplier;

    const adultPrice = adjustedPrice * adults * 1.0;      // 성인 100%
    const childPrice = adjustedPrice * children * 0.75;   // 소아 75%
    const infantPrice = adjustedPrice * infants * 0.1;    // 유아 10%
    return Math.round(adultPrice + childPrice + infantPrice);
  };

  /**
   * 탑승자 정보 입력 표시 상태
   */
  const [showPassengerForm, setShowPassengerForm] = useState(false);

  /**
   * 탑승자 정보 배열
   * 승객 수만큼 초기화
   */
  const [passengers, setPassengers] = useState([]);

  /**
   * 로컬스토리지 키 생성 (항공편/날짜/승객수 기반)
   */
  const storageKey = useMemo(() => {
    if (!flight) return null;
    const flightKey = `${flight.flightNumber || 'UNKNOWN'}-${flight.depAt || flight.depPlandTime || ''}`;
    return `flightSeatPassengers:${flightKey}:${totalPassengers}`;
  }, [flight, totalPassengers]);

  // 자동완성(히스토리) 상태 및 유틸
  const [lastNameHistory, setLastNameHistory] = useState([]);
  const [firstNameHistory, setFirstNameHistory] = useState([]);
  const [passportHistory, setPassportHistory] = useState([]);

  const historyKey = (field) => `flightSeatHistory:${field}`;
  const getHistory = (field) => {
    try {
      const raw = localStorage.getItem(historyKey(field));
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };
  const setHistory = (field, arr) => {
    try {
      localStorage.setItem(historyKey(field), JSON.stringify(arr));
    } catch { }
  };
  const addToHistory = (field, value) => {
    const v = (value || '').trim();
    if (!v) return;
    const minLen = field === 'passportNumber' ? 3 : 2;
    if (v.length < minLen) return;
    const current = getHistory(field);
    const next = [v, ...current.filter((x) => x !== v)].slice(0, 10);
    setHistory(field, next);
    if (field === 'lastName') setLastNameHistory(next);
    if (field === 'firstName') setFirstNameHistory(next);
    if (field === 'passportNumber') setPassportHistory(next);
  };

  /**
   * 컴포넌트 마운트 시 데이터 검증 및 초기화
   */
  useEffect(() => {
    // 필수 데이터가 없으면 검색 페이지로 리다이렉트
    if (!flight || !searchConditions) {
      navigate('/reservations/flights/search');
      return;
    }

    // 탑승자 정보 배열 초기화 (저장된 값이 있으면 복원)
    const initialPassengers = Array.from(
      { length: totalPassengers },
      (_, index) => ({
        id: index + 1,
        lastName: '',
        firstName: '',
        dateOfBirth: '',
        passportNumber: '',
      })
    );

    // 저장된 값 복원
    try {
      if (storageKey) {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const merged = initialPassengers.map((p, i) => ({
              ...p,
              ...(parsed[i] || {}),
            }));
            setPassengers(merged);
          } else {
            setPassengers(initialPassengers);
          }
        } else {
          setPassengers(initialPassengers);
        }
      } else {
        setPassengers(initialPassengers);
      }
    } catch (e) {
      setPassengers(initialPassengers);
    }

    // 검색 시 선택한 좌석 등급을 기본값으로 설정
    if (searchConditions.seatClass) {
      setSelectedClass(searchConditions.seatClass);
    }
  }, [flight, totalPassengers, navigate, storageKey]);

  // 자동완성 히스토리 로드 (최초 마운트 시)
  useEffect(() => {
    setLastNameHistory(getHistory('lastName'));
    setFirstNameHistory(getHistory('firstName'));
    setPassportHistory(getHistory('passportNumber'));
  }, []);

  /**
   * 탑승자 입력값이 변경될 때 로컬스토리지에 임시 저장
   * 모두 빈 값이면 저장하지 않음
   */
  useEffect(() => {
    if (!storageKey) return;
    const hasAnyValue = passengers?.some(
      (p) => (p?.lastName || p?.firstName || p?.dateOfBirth || p?.passportNumber)
    );
    try {
      if (hasAnyValue) {
        localStorage.setItem(storageKey, JSON.stringify(passengers));
      }
    } catch (_) {
      // 저장 실패는 무시 (스토리지 용량 등)
    }
  }, [passengers, storageKey]);

  /**
   * 시간 포맷팅 함수
   * ISO 형식 "2026-01-25T06:05:00" 또는 기존 형식 "202501151430" 지원
   */
  const formatTime = (timeString) => {
    if (!timeString) return '-';
    // ISO 형식 체크
    if (timeString.includes('T') || timeString.includes('-')) {
      try {
        const date = new Date(timeString);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        return timeString;
      }
    }
    // 기존 형식 "202501151430"
    if (timeString.length >= 12) {
      const hours = timeString.substring(8, 10);
      const minutes = timeString.substring(10, 12);
      return `${hours}:${minutes}`;
    }
    return timeString;
  };

  /**
   * 항공사 이름 다국어 매핑 (FlightResults.jsx와 동일)
   */
  const airlineNames = {
    '이스타항공': { en: 'Eastar Jet', ja: 'イースター航空', zh: '易斯达航空' },
    '제주항공': { en: 'Jeju Air', ja: 'チェジュ航空', zh: '济州航空' },
    '진에어': { en: 'Jin Air', ja: 'ジンエアー', zh: '真航空' },
    '에어서울': { en: 'Air Seoul', ja: 'エアソウル', zh: '首尔航空' },
    '티웨이항공': { en: 'T\'way Air', ja: 'ティーウェイ航空', zh: 'T\'way航空' },
    '대한항공': { en: 'Korean Air', ja: '大韓航空', zh: '大韩航空' },
    '아시아나항공': { en: 'Asiana Airlines', ja: 'アシアナ航空', zh: '韩亚航空' },
  };

  /**
   * 언어에 따라 항공사 이름 선택
   */
  const getAirlineName = (koreanName) => {
    if (!koreanName) return '';

    const airline = airlineNames[koreanName];
    if (!airline) return koreanName; // 매핑 없으면 원문 반환

    switch (language) {
      case 'English':
        return airline.en;
      case '日本語':
        return airline.ja;
      case '中文':
        return airline.zh;
      case '한국어':
        return koreanName;
      default:
        return koreanName;
    }
  };

  /**
   * 날짜 포맷팅 함수
   * ISO 형식 또는 기존 형식 지원
   */
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // ISO 형식 체크
    if (dateString.includes('T') || dateString.includes('-')) {
      try {
        const date = new Date(dateString);
        return t('date_format_ymd')
          .replace('{year}', date.getFullYear())
          .replace('{month}', date.getMonth() + 1)
          .replace('{day}', date.getDate());
      } catch {
        return dateString;
      }
    }
    // 기존 형식 "202501151430"
    if (dateString.length >= 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return t('date_format_ymd')
        .replace('{year}', year)
        .replace('{month}', parseInt(month))
        .replace('{day}', parseInt(day));
    }
    return dateString;
  };

  /**
   * 좌석 등급별 총 가격 계산
   */
  const calculateTotalPrice = (seatClass) => {
    if (!flight) return 0;
    // 기존 형식: economyCharge / prestigeCharge
    if (flight.economyCharge || flight.prestigeCharge) {
      const pricePerPerson = seatClass === 'economy' ? flight.economyCharge : flight.prestigeCharge;
      return (pricePerPerson || 0) * totalPassengers;
    }
    // 새 형식: totalPrice 또는 pricePerPerson (비즈니스석은 2배)
    const basePrice = flight.pricePerPerson || flight.totalPrice || 0;
    const multiplier = seatClass === 'economy' ? 1 : 2;
    return basePrice * multiplier * totalPassengers;
  };

  /**
   * 좌석 등급 선택 핸들러
   */
  const handleSelectClass = (seatClass) => {
    setSelectedClass(seatClass);
  };

  /**
   * 탑승자 정보 입력 값 변경 핸들러
   */
  const handlePassengerChange = (index, field, value) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index][field] = value;
    setPassengers(updatedPassengers);
  };

  /**
   * 결제하기 버튼 핸들러
   * 탑승자 정보 입력 폼을 먼저 표시하고, 입력 완료 후 결제 페이지로 이동
   */
  const handleProceedToPayment = () => {
    if (!showPassengerForm) {
      // 첫 번째 클릭: 탑승자 정보 입력 폼 표시
      setShowPassengerForm(true);
      // 폼 위치로 스크롤
      setTimeout(() => {
        document.getElementById('passenger-form')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
      return;
    }

    // 두 번째 클릭: 탑승자 정보 유효성 검증
    const isValid = passengers.every(passenger =>
      passenger.lastName.trim() &&
      passenger.firstName.trim() &&
      passenger.dateOfBirth &&
      passenger.passportNumber.trim()
    );

    if (!isValid) {
      alert(t('alert_fill_all_passengers'));
      return;
    }

    // 총 가격 계산 (가는편 + 오는편) - 소아/유아 할인 적용
    const totalPrice = calculateDiscountedTotal(outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0) +
      (isRoundTrip && inboundFlight ? calculateDiscountedTotal(inboundFlight?.pricePerPerson || inboundFlight?.totalPrice || 0) : 0);

    // 결제 페이지로 이동
    navigate('/reservations/flights/payment', {
      state: {
        flight: outboundFlight,
        outboundFlight,
        inboundFlight,
        isRoundTrip,
        searchConditions,
        selectedClass,  // 사용자가 선택한 좌석 등급
        passengers,
        totalPrice,
      }
    });
  };

  /**
   * 데이터 로딩 중이거나 없을 때
   */
  if (!flight || !searchConditions) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          {t('title_select_seat')}
        </h1>

        {/* 탭 네비게이션 */}
        <TransportTabs />

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 메인 콘텐츠 영역 */}
          <main className="lg:col-span-8 space-y-6">
            {/* 선택한 항공편 정보 카드 */}
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                {t('subtitle_selected_flights')} {isRoundTrip && <span className="text-sm font-normal text-primary ml-2">{t('flight_roundtrip_badge')}</span>}
              </h2>

              <div className="space-y-4">
                {/* 가는편 */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  {/* 헤더: Outbound 라벨 */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">flight_takeoff</span>
                    <span className="font-semibold text-primary">{t('label_outbound')}</span>
                  </div>

                  {/* 항공사 정보 - 첫 번째 줄 */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary">airlines</span>
                    </div>
                    <div>
                      <p className="font-medium dark:text-white">{outboundFlight?.airlineName}</p>
                      <p className="text-xs text-slate-500">{outboundFlight?.flightNumber}</p>
                    </div>
                  </div>

                  {/* 시간 정보 - 두 번째 줄 */}
                  <div className="flex items-center justify-center gap-6 mb-3">
                    <div className="text-center">
                      <p className="text-xl font-bold dark:text-white">{formatTime(outboundFlight?.depAt)}</p>
                      <p className="text-sm text-slate-500">{outboundFlight?.departureAirport}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-px bg-slate-300 dark:bg-slate-600 relative">
                        <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-primary text-sm">flight</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold dark:text-white">{formatTime(outboundFlight?.arrAt)}</p>
                      <p className="text-sm text-slate-500">{outboundFlight?.arrivalAirport}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">airlines</span>
                      </div>
                      <div>
                        <p className="font-medium dark:text-white">{getAirlineName(outboundFlight?.airlineName)}</p>
                        <p className="text-xs text-slate-500">{outboundFlight?.flightNumber}</p>
                      </div>
                    </div>
                    <div className="text-center flex-1 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold dark:text-white">{formatTime(outboundFlight?.depAt)}</p>
                          <p className="text-xs text-slate-500">{outboundFlight?.departureAirport}</p>
                        </div>
                        <div className="flex flex-col items-center px-3">
                          <div className="w-16 h-px bg-slate-300 dark:bg-slate-600 relative">
                            <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-primary text-xs">flight</span>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-bold dark:text-white">{formatTime(outboundFlight?.arrAt)}</p>
                          <p className="text-xs text-slate-500">{outboundFlight?.arrivalAirport}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(outboundFlight?.depAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        {(outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0).toLocaleString()}{t('unit_krw')}
                      </p>
                    </div>
                  </div>

                  {/* 날짜 - 세 번째 줄 */}
                  <p className="text-center text-sm text-slate-400 mb-3">{formatDate(outboundFlight?.depAt)}</p>

                  {/* 가격 - 네 번째 줄 */}
                  <div className="text-center pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xl font-bold text-primary">
                      {(outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0).toLocaleString()}원
                    </p>
                  </div>
                </div>

                {/* 오는편 (왕복일 때만) */}
                {isRoundTrip && inboundFlight && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    {/* 헤더: Inbound 라벨 */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-mint">flight_land</span>
                      <span className="font-semibold text-mint">{t('label_inbound')}</span>
                    </div>

                    {/* 항공사 정보 - 첫 번째 줄 */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-mint">airlines</span>
                      </div>
                      <div>
                        <p className="font-medium dark:text-white">{inboundFlight?.airlineName}</p>
                        <p className="text-xs text-slate-500">{inboundFlight?.flightNumber}</p>
                      </div>
                    </div>

                    {/* 시간 정보 - 두 번째 줄 */}
                    <div className="flex items-center justify-center gap-6 mb-3">
                      <div className="text-center">
                        <p className="text-xl font-bold dark:text-white">{formatTime(inboundFlight?.depAt)}</p>
                        <p className="text-sm text-slate-500">{inboundFlight?.departureAirport}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-px bg-slate-300 dark:bg-slate-600 relative">
                          <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-mint text-sm">flight</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold dark:text-white">{formatTime(inboundFlight?.arrAt)}</p>
                        <p className="text-sm text-slate-500">{inboundFlight?.arrivalAirport}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-mint">airlines</span>
                        </div>
                        <div>
                          <p className="font-medium dark:text-white">{getAirlineName(inboundFlight?.airlineName)}</p>
                          <p className="text-xs text-slate-500">{inboundFlight?.flightNumber}</p>
                        </div>
                      </div>
                      <div className="text-center flex-1 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="text-right">
                            <p className="text-lg font-bold dark:text-white">{formatTime(inboundFlight?.depAt)}</p>
                            <p className="text-xs text-slate-500">{inboundFlight?.departureAirport}</p>
                          </div>
                          <div className="flex flex-col items-center px-3">
                            <div className="w-16 h-px bg-slate-300 dark:bg-slate-600 relative">
                              <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-2 text-mint text-xs">flight</span>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-lg font-bold dark:text-white">{formatTime(inboundFlight?.arrAt)}</p>
                            <p className="text-xs text-slate-500">{inboundFlight?.arrivalAirport}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(inboundFlight?.depAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-mint">
                          {(inboundFlight?.pricePerPerson || inboundFlight?.totalPrice || 0).toLocaleString()}{t('unit_krw')}
                        </p>
                      </div>
                    </div>

                    {/* 날짜 - 세 번째 줄 */}
                    <p className="text-center text-sm text-slate-400 mb-3">{formatDate(inboundFlight?.depAt)}</p>

                    {/* 가격 - 네 번째 줄 */}
                    <div className="text-center pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xl font-bold text-mint">
                        {(inboundFlight?.pricePerPerson || inboundFlight?.totalPrice || 0).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                )}

                {/* 구분선 */}
                <div className="border-t border-slate-200 dark:border-slate-700"></div>

                {/* 승객 수, 좌석 등급, 총 항공료 */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="material-symbols-outlined text-xl">person</span>
                      <span>{t('passenger_count_fmt').replace('{count}', totalPassengers)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-xl text-slate-400">airline_seat_recline_normal</span>
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded font-medium">
                        {selectedClass === 'ECONOMY' && t('class_economy')}
                        {selectedClass === 'PREMIUM' && t('class_premium')}
                        {selectedClass === 'BUSINESS' && t('class_business')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">
                      {t('total_fare_breakdown').replace('{a}', adults).replace('{c}', children).replace('{i}', infants)}
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {(
                        calculateDiscountedTotal(outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0) +
                        (isRoundTrip && inboundFlight ? calculateDiscountedTotal(inboundFlight?.pricePerPerson || inboundFlight?.totalPrice || 0) : 0)
                      ).toLocaleString()}{t('unit_krw')}
                    </p>
                    {(children > 0 || infants > 0) && (
                      <p className="text-xs text-slate-400 mt-1">{t('discount_applied_desc')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 좌석 등급 선택 카드 */}
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                {t('title_select_class')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {seatClassOptions.map((option) => {
                  const basePrice = outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0;
                  const optionPrice = Math.round(basePrice * option.multiplier);
                  const isSelected = selectedClass === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedClass(option.value)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary">check_circle</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{option.description}</p>
                      <p className={`text-lg font-bold ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                        {optionPrice.toLocaleString()}{t('unit_krw')}
                        <span className="text-xs font-normal text-slate-400 ml-1">{t('per_person')}</span>
                      </p>
                      {option.multiplier > 1 && (
                        <p className="text-xs text-slate-400 mt-1">{t('surcharge_desc').replace('{percent}', ((option.multiplier - 1) * 100).toFixed(0))}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 탑승자 정보 입력 폼 (조건부 표시) */}
            {showPassengerForm && (
              <div id="passenger-form" className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 dark:text-white">
                  {t('title_passenger_info')}
                </h2>

                {/* 자동완성용 datalist (공유) */}
                <datalist id="lastNameSuggestions">
                  {lastNameHistory.map((v, i) => (
                    <option key={`ln-${i}`} value={v} />
                  ))}
                </datalist>
                <datalist id="firstNameSuggestions">
                  {firstNameHistory.map((v, i) => (
                    <option key={`fn-${i}`} value={v} />
                  ))}
                </datalist>
                <datalist id="passportSuggestions">
                  {passportHistory.map((v, i) => (
                    <option key={`pp-${i}`} value={v} />
                  ))}
                </datalist>

                <div className="space-y-6">
                  {passengers.map((passenger, index) => (
                    <div key={passenger.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                      <h3 className="font-medium text-lg mb-4 dark:text-white">
                        {t('passenger_n').replace('{n}', index + 1)}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 성 (영문) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('label_lastname')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={passenger.lastName}
                            onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                            onBlur={(e) => addToHistory('lastName', e.target.value)}
                            placeholder="KIM"
                            list="lastNameSuggestions"
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary"
                            required
                          />
                        </div>

                        {/* 이름 (영문) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('label_firstname')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={passenger.firstName}
                            onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                            onBlur={(e) => addToHistory('firstName', e.target.value)}
                            placeholder="MINSOO"
                            list="firstNameSuggestions"
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary"
                            required
                          />
                        </div>

                        {/* 생년월일 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('label_dob')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={passenger.dateOfBirth}
                            onChange={(e) => handlePassengerChange(index, 'dateOfBirth', e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary"
                            required
                          />
                        </div>

                        {/* 여권번호 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('label_passport')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={passenger.passportNumber}
                            onChange={(e) => handlePassengerChange(index, 'passportNumber', e.target.value)}
                            onBlur={(e) => addToHistory('passportNumber', e.target.value)}
                            placeholder="M12345678"
                            list="passportSuggestions"
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 안내 메시지 */}
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                      info
                    </span>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">{t('info_passenger_title')}</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>{t('info_passenger_1')}</li>
                        <li>{t('info_passenger_2')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 결제하기 버튼 */}
            <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('label_total_payment')} ({t('passenger_count_fmt').replace('{count}', totalPassengers)})
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {(
                      calculateDiscountedTotal(outboundFlight?.pricePerPerson || outboundFlight?.totalPrice || 0) +
                      (isRoundTrip && inboundFlight ? calculateDiscountedTotal(inboundFlight?.pricePerPerson || inboundFlight?.totalPrice || 0) : 0)
                    ).toLocaleString()}{t('unit_krw')}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedClass === 'ECONOMY' && t('class_economy')}
                    {selectedClass === 'PREMIUM' && t('class_premium')}
                    {selectedClass === 'BUSINESS' && t('class_business')}
                    {' · '}{totalPassengers}{t('unit_people')}{isRoundTrip && ` · ${t('flight_roundtrip_badge')}`}
                  </p>
                  {(children > 0 || infants > 0) && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ {t('discount_applied')}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleProceedToPayment}
                className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">
                  {showPassengerForm ? 'payment' : 'arrow_forward'}
                </span>
                <span>
                  {showPassengerForm ? t('btn_payment') : t('btn_next_passenger_input')}
                </span>
              </button>
            </div>
          </main>

          {/* 사이드바 영역 */}
          <aside className="lg:col-span-4">
            <ReservationSidebar />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default FlightSeat;
