import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  /**
   * 이전 페이지에서 전달받은 데이터
   * flight - 선택한 항공편 정보
   * searchConditions - 검색 조건 (승객 수 등)
   */
  const { flight, searchConditions } = location.state || {};

  /**
   * 선택된 좌석 등급 상태
   * economy - 일반석
   * business - 비즈니스석
   */
  const [selectedClass, setSelectedClass] = useState('economy');

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
    if (!flight || !searchConditions) return null;
    const flightKey = `${flight.flightNumber || 'UNKNOWN'}-${flight.depPlandTime || ''}`;
    return `flightSeatPassengers:${flightKey}:${searchConditions.passengers}`;
  }, [flight, searchConditions]);

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
    } catch {}
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
      { length: searchConditions.passengers },
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
  }, [flight, searchConditions, navigate, storageKey]);

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
   * "202501151430" -> "14:30"
   */
  const formatTime = (timeString) => {
    if (!timeString || timeString.length < 12) return timeString;
    const hours = timeString.substring(8, 10);
    const minutes = timeString.substring(10, 12);
    return `${hours}:${minutes}`;
  };

  /**
   * 날짜 포맷팅 함수
   * "202501151430" -> "2025년 1월 15일"
   */
  const formatDate = (dateString) => {
    if (!dateString || dateString.length < 8) return dateString;
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
  };

  /**
   * 좌석 등급별 총 가격 계산
   */
  const calculateTotalPrice = (seatClass) => {
    if (!flight) return 0;
    const pricePerPerson = seatClass === 'economy'
      ? flight.economyCharge
      : flight.prestigeCharge;
    return pricePerPerson * searchConditions.passengers;
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
      alert('모든 탑승자 정보를 입력해주세요.');
      return;
    }

    // 결제 페이지로 이동
    navigate('/reservations/flights/payment', {
      state: {
        flight,
        searchConditions,
        selectedClass,
        passengers,
        totalPrice: calculateTotalPrice(selectedClass),
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
          좌석 선택
        </h1>

        {/* 탭 네비게이션 */}
        <TransportTabs />

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* 메인 콘텐츠 영역 */}
          <main className="lg:col-span-8 space-y-6">
            {/* 선택한 항공편 정보 카드 */}
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                선택한 항공편
              </h2>

              <div className="space-y-4">
                {/* 항공사 및 편명 */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      airlines
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg dark:text-white">
                      {flight.airlineName}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {flight.flightNumber}
                    </p>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-slate-200 dark:border-slate-700"></div>

                {/* 출발/도착 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 출발 정보 */}
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      출발
                    </p>
                    <p className="text-2xl font-bold dark:text-white">
                      {formatTime(flight.depPlandTime)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {flight.departureAirport}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(flight.depPlandTime)}
                    </p>
                  </div>

                  {/* 도착 정보 */}
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      도착
                    </p>
                    <p className="text-2xl font-bold dark:text-white">
                      {formatTime(flight.arrPlandTime)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {flight.arrivalAirport}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(flight.arrPlandTime)}
                    </p>
                  </div>
                </div>

                {/* 승객 수 */}
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xl">
                    person
                  </span>
                  <span>
                    승객 {searchConditions.passengers}명
                  </span>
                </div>
              </div>
            </div>

            {/* 좌석 등급 선택 카드 */}
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                좌석 등급 선택
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 일반석 카드 */}
                <div
                  onClick={() => handleSelectClass('economy')}
                  className={`
                    border-2 rounded-xl p-6 cursor-pointer transition-all duration-300
                    ${selectedClass === 'economy'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  {/* 체크 아이콘 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-3xl text-slate-600 dark:text-slate-400">
                        airline_seat_recline_normal
                      </span>
                      <h3 className="text-lg font-semibold dark:text-white">
                        일반석
                      </h3>
                    </div>
                    {selectedClass === 'economy' && (
                      <span className="material-symbols-outlined text-primary text-2xl">
                        check_circle
                      </span>
                    )}
                  </div>

                  {/* 혜택 목록 */}
                  <ul className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>기내식 제공</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>수하물 15kg</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>좌석 지정</span>
                    </li>
                  </ul>

                  {/* 가격 */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      1인당
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {flight.economyCharge.toLocaleString()}원
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      총 {calculateTotalPrice('economy').toLocaleString()}원
                      <span className="text-xs ml-1">
                        ({searchConditions.passengers}명)
                      </span>
                    </p>
                  </div>
                </div>

                {/* 비즈니스석 카드 */}
                <div
                  onClick={() => handleSelectClass('business')}
                  className={`
                    border-2 rounded-xl p-6 cursor-pointer transition-all duration-300
                    ${selectedClass === 'business'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  {/* 체크 아이콘 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-3xl text-primary">
                        airline_seat_flat
                      </span>
                      <h3 className="text-lg font-semibold dark:text-white">
                        비즈니스석
                      </h3>
                    </div>
                    {selectedClass === 'business' && (
                      <span className="material-symbols-outlined text-primary text-2xl">
                        check_circle
                      </span>
                    )}
                  </div>

                  {/* 혜택 목록 */}
                  <ul className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>프리미엄 기내식</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>수하물 30kg</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>라운지 이용</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>우선 탑승</span>
                    </li>
                  </ul>

                  {/* 가격 */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      1인당
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {flight.prestigeCharge.toLocaleString()}원
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      총 {calculateTotalPrice('business').toLocaleString()}원
                      <span className="text-xs ml-1">
                        ({searchConditions.passengers}명)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 탑승자 정보 입력 폼 (조건부 표시) */}
            {showPassengerForm && (
              <div id="passenger-form" className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">
                탑승자 정보
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
                        탑승자 {index + 1}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 성 (영문) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            성 (영문) <span className="text-red-500">*</span>
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
                            이름 (영문) <span className="text-red-500">*</span>
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
                            생년월일 <span className="text-red-500">*</span>
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
                            여권번호 <span className="text-red-500">*</span>
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
                      <p className="font-medium mb-1">탑승자 정보 입력 안내</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>여권에 기재된 영문 이름을 정확히 입력해주세요</li>
                        <li>이름과 여권번호 불일치 시 탑승이 거부될 수 있습니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 결제하기 버튼 */}
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    총 결제 금액
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {calculateTotalPrice(selectedClass).toLocaleString()}원
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedClass === 'economy' ? '일반석' : '비즈니스석'} · {searchConditions.passengers}명
                  </p>
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
                  {showPassengerForm ? '결제하기' : '다음 단계 (탑승자 정보 입력)'}
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
