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
const FlightSearch = () => {
  const navigate = useNavigate();

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
    passengers: 1,         // 승객 수
    seatClass: 'economy',  // 좌석 등급 (economy/business)
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
    '김포', '제주', '김해', '인천', '대구', '청주', '광주', '울산', '여수', '포항',
    '군산', '양양', '무안', '원주', '사천', '진주', '부산'
  ];

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
      alert('공항 목록을 불러오는데 실패했습니다.');
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
      setDepSearchTerm(airport.nameKo);
      setShowDepDropdown(false);
    } else {
      setFormData(prev => ({ ...prev, arrAirportId: airport.iataCode }));
      setArrSearchTerm(airport.nameKo);
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
      alert('출발지, 도착지, 날짜를 모두 선택해주세요.');
      return;
    }

    // 같은 공항 선택 방지
    if (formData.depAirportId === formData.arrAirportId) {
      alert('출발지와 도착지는 달라야 합니다.');
      return;
    }

    // 과거 날짜 선택 방지
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.depDate);
    if (selectedDate < today) {
      alert('과거 날짜는 선택할 수 없습니다.');
      return;
    }

    // 왕복일 경우 귀국일 유효성 검사
    if (formData.tripType === 'roundtrip') {
      if (!formData.retDate) {
        alert('왕복을 선택하셨습니다. 귀국일을 선택해주세요.');
        return;
      }
      const ret = new Date(formData.retDate);
      if (ret < selectedDate) {
        alert('귀국일은 출발일 이후여야 합니다.');
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
      passengers: formData.passengers,
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
          교통 
        </h1>

        {/* 탭 네비게이션 */}
        <TransportTabs />

        {/* 메인 그리드: 12컬럼 (메인 8 + 사이드바 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 메인 콘텐츠 영역 */}
          <main className="lg:col-span-8 space-y-6">
            {/* 검색 폼 카드 */}
            <SearchCard title="항공권 검색">
              <form onSubmit={handleSearch} className="space-y-4">
                {/* 편도/왕복 선택 */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tripType: 'oneway', retDate: '' })}
                      className={`${formData.tripType === 'oneway' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-600 dark:text-slate-300'} px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                    >
                      편도
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tripType: 'roundtrip' })}
                      className={`${formData.tripType === 'roundtrip' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-600 dark:text-slate-300'} px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                    >
                      왕복
                    </button>
                  </div>
                </div>
                {/* 출발지/도착지 입력 영역 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                  {/* 출발지 입력 */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      출발지
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
                            {airport.nameKo}
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
                        placeholder="출발 공항을 선택하세요"
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
                            {loading ? '공항 목록을 불러오는 중...' : '일치하는 공항이 없습니다.'}
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
                              {airport.nameKo}
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
                      도착지
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
                            {airport.nameKo}
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
                        placeholder="도착 공항을 선택하세요"
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
                            {loading ? '공항 목록을 불러오는 중...' : '일치하는 공항이 없습니다.'}
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
                              {airport.nameKo}
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
                      출발일
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
                        귀국일
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
                      항공사 (선택사항)
                    </label>
                    <div className="relative">
                      <select
                        value={formData.airlineId}
                        onChange={(e) => setFormData({ ...formData, airlineId: e.target.value })}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200
                                 dark:border-slate-600 dark:bg-slate-800 dark:text-white appearance-none
                                 focus:ring-2 focus:ring-primary transition-all"
                      >
                        <option value="">전체 항공사</option>
                        {airlines.map((airline) => (
                          <option key={airline.code} value={airline.code}>
                            {airline.nameKo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 승객 수 선택 (버튼 카운터) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      승객 수
                    </label>
                    <div className="flex items-center h-14 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, passengers: Math.max(1, (prev.passengers || 1) - 1) }))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="성인 인원 감소"
                      >
                        −
                      </button>
                      <div className="flex-1 text-center font-medium">
                        성인 {formData.passengers}명
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, passengers: Math.min(9, (prev.passengers || 1) + 1) }))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="성인 인원 증가"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 검색 버튼 */}
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? '검색 중...' : '항공편 검색하기'}
                </button>
              </form>
            </SearchCard>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">검색 팁</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>출발 7일 전 예약 시 최대 30% 할인</li>
                    <li>주중 항공편이 주말보다 저렴합니다</li>
                    <li>새벽/심야 시간대 항공편 특가 확인하세요</li>
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
