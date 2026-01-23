import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 항공권 검색 페이지
 *
 * 기능:
 * - 출발/도착 공항 선택 (자동완성)
 * - 출발 날짜 선택
 * - 항공사 선택 (선택사항)
 * - 승객 수 및 좌석 등급 선택
 * - 검색 버튼 클릭 시 결과 페이지로 이동
 */
import { useLanguage } from '../../../context/LanguageContext';

const FlightSearch = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  /**
   * 검색 폼 상태 관리
   */
  const [formData, setFormData] = useState({
    depAirportId: '',      // 출발 공항 ID
    arrAirportId: '',      // 도착 공항 ID
    depDate: '',           // 출발 날짜
    retDate: '',           // 귀국 날짜 (왕복)
    tripType: 'oneway',    // 편도(oneway) / 왕복(roundtrip)
    airlineId: '',         // 항공사 ID (선택사항)
    // 승객 수 (성인/소아/유아)
    adults: 1,             // 성인 (만 12세 이상)
    children: 0,           // 소아 (만 2세~12세 미만)
    infants: 0,            // 유아 (만 2세 미만)
    seatClass: 'ECONOMY',  // 좌석 등급 (ECONOMY/PREMIUM/BUSINESS)
  });

  /**
   * UI 상태 관리
   */
  const [airports, setAirports] = useState([]);           // 공항 목록
  const [airlines, setAirlines] = useState([]);           // 항공사 목록
  const [loading, setLoading] = useState(false);          // 로딩 상태
  const [searchLoading, setSearchLoading] = useState(false); // 검색 중 상태

  /**
   * 자동완성 관련 상태
   */
  const [depSearchTerm, setDepSearchTerm] = useState('');     // 출발지 검색어
  const [arrSearchTerm, setArrSearchTerm] = useState('');     // 도착지 검색어
  const [showDepDropdown, setShowDepDropdown] = useState(false); // 출발지 드롭다운 표시
  const [showArrDropdown, setShowArrDropdown] = useState(false); // 도착지 드롭다운 표시

  /**
   * 국내 공항 빠른 선택 키워드 및 도우미
   * API 응답의 공항명과 매칭하여 안전하게 버튼을 구성합니다
   */
  const domesticNameKeywords = [
    '\uAE40\uD3EC', '\uC81C\uC8FC', '\uAE40\uD574', '\uC778\uCC9C', '\uB300\uAD6C', '\uCCAD\uC8FC', '\uAD11\uC8FC', '\uC6B8\uC0B0', '\uC5EC\uC218', '\uD3EC\uD56D', '\uAD70\uC0B0', '\uC591\uC591', '\uBB34\uC548', '\uC6D0\uC8FC', '\uC0AC\uCC9C', '\uC9C4\uC8FC', '\uBD80\uC0B0'
  ];

  /**
   * 언어에 따라 공항 이름 선택
   */
  const getAirportName = (airport) => {
    switch (language) {
      case 'English':
        return airport.nameEn || airport.nameKo;
      case '\u65E5\u672C\u8A9E':  // Japanese
        return airport.nameJa || airport.nameKo;
      case '\u4E2D\u6587':    // Chinese
        return airport.nameZh || airport.nameKo;
      case '\uD55C\uAD6D\uC5B4':  // Korean
        return airport.nameKo;
      default:
        return airport.nameKo;
    }
  };

  const getDomesticAirportsQuick = () => {
    const list = airports.filter(a =>
      typeof a.airportName === 'string' && domesticNameKeywords.some(k => a.airportName.includes(k))
    );
    const seen = new Set();
    const unique = [];
    for (const a of list) {
      if (!seen.has(a.airportName)) {
        seen.add(a.airportName);
        unique.push(a);
      }
    }
    unique.sort((a, b) => {
      const ia = domesticNameKeywords.findIndex(k => a.airportName.includes(k));
      const ib = domesticNameKeywords.findIndex(k => b.airportName.includes(k));
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return unique;
  };

  /**
   * 컴포넌트 마운트 시 공항 및 항공사 목록 불러오기
   */
  useEffect(() => {
    fetchAirports();
    fetchAirlines();
  }, []);

  /**
   * 공항 목록 API 호출
   */
  const fetchAirports = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/v1/transport/airports/');
      setAirports(response.data.airports || []);
    } catch (error) {
      console.error('공항 목록 로딩 실패:', error);
      // 에러 발생 시 사용자에게 알림 (실제 구현 시 Toast 등 사용)
      alert(t('flight_load_error'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 항공사 목록 API 호출
   */
  const fetchAirlines = async () => {
    try {
      const response = await axios.get('/v1/transport/airlines/');
      setAirlines(response.data.airlines || []);
    } catch (error) {
      console.error('항공사 목록 로딩 실패:', error);
    }
  };

  /**
   * 출발지/도착지 스왑 핸들러
   * 출발 공항과 도착 공항을 서로 바꿉니다
   */
  const handleSwapAirports = () => {
    setFormData(prev => ({
      ...prev,
      depAirportId: prev.arrAirportId,
      arrAirportId: prev.depAirportId,
    }));
    setDepSearchTerm(arrSearchTerm);
    setArrSearchTerm(depSearchTerm);
  };

  /**
   * 공항 선택 핸들러
   *
   * 매개변수:
   * airport - 선택된 공항 객체
   * type - 'departure' 또는 'arrival'
   */
  const handleAirportSelect = (airport, type) => {
    if (type === 'departure') {
      setFormData(prev => ({ ...prev, depAirportId: airport.iataCode }));
      setDepSearchTerm(getAirportName(airport));
      setShowDepDropdown(false);
    } else {
      setFormData(prev => ({ ...prev, arrAirportId: airport.iataCode }));
      setArrSearchTerm(getAirportName(airport));
      setShowArrDropdown(false);
    }
  };

  /**
   * 공항 검색 필터링
   * 검색어에 따라 공항 목록을 필터링합니다
   *
   * 매개변수:
   * searchTerm - 사용자가 입력한 검색어
   */
  const filterAirports = (searchTerm) => {
    if (!searchTerm) return airports;
    return airports.filter(airport =>
      airport.nameKo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      airport.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      airport.iataCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  /**
   * 검색 폼 제출 핸들러
   * 입력값 유효성 검사 후 결과 페이지로 이동
   */
  const handleSearch = (e) => {
    e.preventDefault();

    // 필수 입력값 검증
    if (!formData.depAirportId || !formData.arrAirportId || !formData.depDate) {
      alert(t('flight_alert_fill_all'));
      return;
    }

    // 같은 공항 선택 방지
    if (formData.depAirportId === formData.arrAirportId) {
      alert(t('flight_alert_same_airport'));
      return;
    }

    // 과거 날짜 선택 방지
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.depDate);
    if (selectedDate < today) {
      alert(t('flight_alert_past_date'));
      return;
    }

    // 왕복일 경우 귀국일 유효성 검사
    if (formData.tripType === 'roundtrip') {
      if (!formData.retDate) {
        alert(t('flight_alert_ret_req'));
        return;
      }
      const ret = new Date(formData.retDate);
      if (ret < selectedDate) {
        alert(t('flight_alert_ret_after'));
        return;
      }
    }

    setSearchLoading(true);

    // 검색 결과 페이지로 이동 (쿼리 파라미터로 검색 조건 전달)
    const searchParams = new URLSearchParams({
      depAirportId: formData.depAirportId,
      arrAirportId: formData.arrAirportId,
      depDate: formData.depDate,
      ...(formData.tripType && { tripType: formData.tripType }),
      ...(formData.tripType === 'roundtrip' && formData.retDate && { retDate: formData.retDate }),
      ...(formData.airlineId && { airlineId: formData.airlineId }),
      // 승객 정보 (성인/소아/유아)
      adults: formData.adults,
      children: formData.children,
      infants: formData.infants,
      seatClass: formData.seatClass,
    });

    navigate(`/reservations/flights/results?${searchParams.toString()}`);
  };

  /**
   * 오늘 날짜 (YYYY-MM-DD 형식)
   * date input의 min 속성에 사용
   */
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          {t('flight_title')}
        </h1>

        {/* 탭 네비게이션 */}
        <TransportTabs />

        {/* 메인 그리드: 12컬럼 (메인 8 + 사이드바 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 메인 콘텐츠 영역 */}
          <main className="lg:col-span-8 space-y-6">
            {/* 검색 폼 카드 */}
            <SearchCard title={t('flight_search_title')}>
              <form onSubmit={handleSearch} className="space-y-4">
                {/* 편도/왕복 선택 */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tripType: 'oneway', retDate: '' })}
                      className={`${formData.tripType === 'oneway' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-600 dark:text-slate-300'} px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                    >
                      {t('flight_oneway')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tripType: 'roundtrip' })}
                      className={`${formData.tripType === 'roundtrip' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-600 dark:text-slate-300'} px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                    >
                      {t('flight_roundtrip')}
                    </button>
                  </div>
                </div>
                {/* 출발지/도착지 입력 영역 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                  {/* 출발지 입력 */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('flight_dep')}
                    </label>
                    {/* 국내 공항 빠른 선택 (버튼) */}
                    <div className="mb-2">
                      <div className="flex gap-2 overflow-x-auto whitespace-nowrap py-1">
                        {getDomesticAirportsQuick().map((airport) => (
                          <button
                            key={`dep-${airport.iataCode}`}
                            type="button"
                            onClick={() => handleAirportSelect(airport, 'departure')}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${formData.depAirportId === airport.iataCode ? 'bg-mint text-white border-mint' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                            title={airport.iataCode}
                          >
                            {getAirportName(airport)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={depSearchTerm}
                        onChange={(e) => {
                          setDepSearchTerm(e.target.value);
                          setShowDepDropdown(true);
                        }}
                        onFocus={() => setShowDepDropdown(true)}
                        placeholder={t('flight_placeholder_dep')}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200
                                 dark:border-slate-600 dark:bg-slate-800 dark:text-white
                                 focus:ring-2 focus:ring-primary focus:border-transparent
                                 transition-all"
                        required
                      />
                    </div>

                    {/* 출발지 자동완성 드롭다운 */}
                    {showDepDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 max-h-60 overflow-y-auto">
                        {filterAirports(depSearchTerm).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {loading ? t('flight_searching') : t('flight_no_results')}
                          </div>
                        )}
                        {filterAirports(depSearchTerm).map((airport) => (
                          <button
                            key={airport.iataCode}
                            type="button"
                            onClick={() => handleAirportSelect(airport, 'departure')}
                            className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {getAirportName(airport)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {airport.iataCode}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 스왑 버튼 (출발↔도착 바꾸기) */}
                  <button
                    type="button"
                    onClick={handleSwapAirports}
                    className="
                      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                      w-10 h-10 bg-primary text-white rounded-full shadow-lg
                      hover:bg-primary-dark hover:rotate-180
                      transition-all duration-300
                      hidden md:flex items-center justify-center
                    "
                    title="출발지와 도착지 바꾸기"
                  >
                    <span className="material-symbols-outlined">swap_horiz</span>
                  </button>

                  {/* 도착지 입력 */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('flight_arr')}
                    </label>
                    {/* 국내 공항 빠른 선택 (버튼) */}
                    <div className="mb-2">
                      <div className="flex gap-2 overflow-x-auto whitespace-nowrap py-1">
                        {getDomesticAirportsQuick().map((airport) => (
                          <button
                            key={`arr-${airport.iataCode}`}
                            type="button"
                            onClick={() => handleAirportSelect(airport, 'arrival')}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${formData.arrAirportId === airport.iataCode ? 'bg-mint text-white border-mint' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                            title={airport.iataCode}
                          >
                            {getAirportName(airport)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={arrSearchTerm}
                        onChange={(e) => {
                          setArrSearchTerm(e.target.value);
                          setShowArrDropdown(true);
                        }}
                        onFocus={() => setShowArrDropdown(true)}
                        placeholder={t('flight_placeholder_arr')}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200
                                 dark:border-slate-600 dark:bg-slate-800 dark:text-white
                                 focus:ring-2 focus:ring-primary focus:border-transparent
                                 transition-all"
                        required
                      />
                    </div>

                    {/* 도착지 자동완성 드롭다운 */}
                    {showArrDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 max-h-60 overflow-y-auto">
                        {filterAirports(arrSearchTerm).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {loading ? t('flight_searching') : t('flight_no_results')}
                          </div>
                        )}
                        {filterAirports(arrSearchTerm).map((airport) => (
                          <button
                            key={airport.iataCode}
                            type="button"
                            onClick={() => handleAirportSelect(airport, 'arrival')}
                            className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {getAirportName(airport)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {airport.iataCode}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 날짜 및 옵션 선택 영역 */}
                <div className={`grid grid-cols-1 ${formData.tripType === 'roundtrip' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mt-4`}>
                  {/* 출발일 선택 */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('flight_dep_date')}
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.depDate}
                        onChange={(e) => setFormData({ ...formData, depDate: e.target.value })}
                        min={today}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200
                                 dark:border-slate-600 dark:bg-slate-800 dark:text-white
                                 focus:ring-2 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* 귀국일 선택 (왕복일 때만 표시) */}
                  {formData.tripType === 'roundtrip' && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('flight_ret_date')}
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={formData.retDate}
                          onChange={(e) => setFormData({ ...formData, retDate: e.target.value })}
                          min={formData.depDate || today}
                          className="w-full h-14 px-4 rounded-xl border border-slate-200
                                   dark:border-slate-600 dark:bg-slate-800 dark:text-white
                                   focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* 항공사 선택 (선택사항) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('flight_airline')}
                    </label>
                    <div className="relative">
                      <select
                        value={formData.airlineId}
                        onChange={(e) => setFormData({ ...formData, airlineId: e.target.value })}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200
                                 dark:border-slate-600 dark:bg-slate-800 dark:text-white appearance-none
                                 focus:ring-2 focus:ring-primary transition-all"
                      >
                        <option value="">{t('flight_airline_all')}</option>
                        {airlines.map((airline) => (
                          <option key={airline.code} value={airline.code}>
                            {airline.nameKo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                {/* 인원선택 섹션 */}
                <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {t('flight_passengers')}
                  </h3>

                  {/* 안내 문구 */}
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                    <p>· {t('flight_tip_1')}</p>
                    <p>· {t('flight_tip_2')}</p>
                    <p>· {t('flight_tip_3')}</p>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-600 mb-4" />

                  {/* 인원 선택 */}
                  <div className="space-y-4">
                    {/* 성인 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{t('flight_adult')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('flight_adult_desc')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            adults: Math.max(1, prev.adults - 1)
                          }))}
                          disabled={formData.adults <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium text-primary text-lg">{formData.adults}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            adults: Math.min(9 - prev.children - prev.infants, prev.adults + 1)
                          }))}
                          disabled={formData.adults + formData.children + formData.infants >= 9}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 소아 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{t('flight_child')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('flight_child_desc')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            children: Math.max(0, prev.children - 1)
                          }))}
                          disabled={formData.children <= 0}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium text-primary text-lg">{formData.children}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            children: Math.min(9 - prev.adults - prev.infants, prev.children + 1)
                          }))}
                          disabled={formData.adults + formData.children + formData.infants >= 9}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 유아 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{t('flight_infant')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('flight_infant_desc')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            infants: Math.max(0, prev.infants - 1)
                          }))}
                          disabled={formData.infants <= 0}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium text-primary text-lg">{formData.infants}</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            infants: Math.min(prev.adults, Math.min(9 - prev.adults - prev.children, prev.infants + 1))
                          }))}
                          disabled={formData.infants >= formData.adults || formData.adults + formData.children + formData.infants >= 9}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 검색 버튼 */}
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? t('flight_searching') : t('flight_search_btn')}
                </button>
              </form>
            </SearchCard>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">{t('flight_tip_title')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('flight_tip_1')}</li>
                    <li>{t('flight_tip_2')}</li>
                    <li>{t('flight_tip_3')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </main>

          {/* 사이드바 영역 */}
          <aside className="lg:col-span-4">
            <ReservationSidebar />
          </aside>
        </div>
      </div>

      {/* 드롭다운 닫기를 위한 오버레이 */}
      {(showDepDropdown || showArrDropdown) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowDepDropdown(false);
            setShowArrDropdown(false);
          }}
        />
      )}
    </div>
  );
};

export default FlightSearch;
