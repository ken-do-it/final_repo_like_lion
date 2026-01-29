import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import axios from '../../../api/axios';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 항공권 결제 페이지 컴포넌트
 * 토스페이먼츠를 사용한 결제 처리
 *
 * 보안 플로우:
 * 1. 백엔드에서 결제 생성 및 orderId 발급
 * 2. 프론트엔드에서 토스페이먼츠 위젯 호출
 * 3. 결제 성공 후 백엔드에서 승인 및 검증
 * 4. 백엔드 검증 통과 후 예약 완료
 *
 * 사용 예시:
 * <Route path="/flights/payment" element={<FlightPayment />} />
 */
const FlightPayment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  /**
   * 이전 페이지(FlightSeat)에서 전달받은 데이터 또는 localStorage에서 복원
   * flight - 선택한 항공편 정보
   * searchConditions - 검색 조건 (출발지, 도착지, 날짜, 승객수)
   * selectedClass - 선택한 좌석 등급 (economy 또는 business)
   * passengers - 승객 정보 배열
   * totalPrice - 총 결제 금액
   */
  const [reservationData, setReservationData] = useState(() => {
    // 초기값 설정: location.state가 있으면 사용
    if (location.state?.flight) {
      return location.state;
    }
    // 없으면 localStorage에서 복원
    try {
      const savedData = localStorage.getItem('flightPaymentData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // 복원 성공 시 localStorage 클리어
        localStorage.removeItem('flightPaymentData');
        return parsed;
      }
    } catch (e) {
      console.error('결제 정보 복원 실패:', e);
    }
    return {};
  });

  const { flight, searchConditions, selectedClass, passengers, totalPrice } = reservationData;

  /**
   * 결제 진행 상태
   * idle - 대기중
   * creating - 백엔드에 결제 생성 요청중
   * ready - 결제 준비 완료 (위젯 표시)
   * processing - 결제 진행중
   */
  const [paymentStatus, setPaymentStatus] = useState('idle');

  /**
   * 백엔드에서 받은 결제 정보
   * orderId - 주문 번호
   * clientKey - 토스페이먼츠 클라이언트 키
   * successUrl - 결제 성공시 리다이렉트 URL
   * failUrl - 결제 실패시 리다이렉트 URL
   */
  const [paymentData, setPaymentData] = useState(null);

  /**
   * 에러 메시지
   */
  const [error, setError] = useState(null);

  /**
   * 토스페이먼츠 위젯 인스턴스
   */
  const [tossPayments, setTossPayments] = useState(null);

  /**
   * 페이지 진입시 데이터 검증
   */
  useEffect(() => {
    if (!flight || !searchConditions || !selectedClass || !passengers || !totalPrice) {
      alert(t('alert_no_payment_info'));
      navigate('/reservations/flights');
    }
  }, [flight, searchConditions, selectedClass, passengers, totalPrice, navigate]);

  /**
   * 토스페이먼츠 SDK 동적 로드
   * index.html에 스크립트가 없으므로 동적으로 로드합니다
   */
  useEffect(() => {
    const loadSDK = () => {
      /**
       * 이미 로드되어 있는지 확인
       */
      if (window.TossPayments) {
        // 일반 결제용 테스트 키 (ck) - payment.requestPayment() 사용 시
        const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
        setTossPayments(window.TossPayments(clientKey));
        return;
      }

      /**
       * 스크립트가 아직 로드되지 않았으면 동적으로 추가
       */
      const script = document.createElement('script');
      script.src = 'https://js.tosspayments.com/v2/standard';
      script.async = true;

      /**
       * 스크립트 로드 성공시
       */
      script.onload = () => {
        if (window.TossPayments) {
          // 일반 결제용 테스트 키 (ck) - payment.requestPayment() 사용 시
          const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
          setTossPayments(window.TossPayments(clientKey));
        }
      };

      /**
       * 스크립트 로드 실패시
       */
      script.onerror = () => {
        console.error('토스페이먼츠 SDK 로드 실패');
        setError(t('alert_payment_create_fail'));
      };

      document.head.appendChild(script);
    };

    loadSDK();
  }, []);

  /**
   * 예약 생성 및 결제 준비
   * 1단계: 예약 생성 API 호출
   * 2단계: 결제 생성 API 호출 (토스페이먼츠 정보 받기)
   */
  const createPayment = async () => {
    setPaymentStatus('creating');
    setError(null);

    try {
      // 승객 정보를 백엔드 형식으로 변환
      const formattedPassengers = passengers.map(p => ({
        passengerType: 'ADT',  // 성인 기본값
        fullName: `${p.lastName} ${p.firstName}`,
        birthDate: p.dateOfBirth,
        passportNo: p.passportNumber,
      }));

      // 1단계: 예약 생성
      // [수정됨] flightData를 함께 보내서 실제 항공편 정보가 저장되도록 합니다!
      const reservationResponse = await axios.post('/v1/reservations/flight/', {
        offerId: flight.offerId || 'MOCK_OFFER_ID',
        tripType: searchConditions.tripType?.toUpperCase() || 'ONEWAY',
        cabinClass: selectedClass?.toUpperCase() || 'ECONOMY',
        passengers: formattedPassengers,
        contacts: {
          contactEmail: '',
          contactPhone: '',
        },
        // [중요] 실제 항공편 정보를 백엔드로 전달!
        // 이 정보가 있어야 마이페이지 예약상세에서 정확한 정보가 표시됩니다.
        flightData: {
          airlineName: flight.airlineName || flight.airlineNm || '',
          flightNumber: flight.flightNumber || flight.vihFlightNo || '',
          departureAirport: flight.departureAirport || '',
          arrivalAirport: flight.arrivalAirport || '',
          depAt: flight.depAt || '',
          arrAt: flight.arrAt || '',
          pricePerPerson: flight.pricePerPerson || flight.economyCharge || 0,
          totalPrice: totalPrice,
        },
      });

      const { reservationId } = reservationResponse.data;
      console.log('예약 생성 완료:', reservationId);

      // 2단계: 결제 생성 (토스페이먼츠용 정보 받기)
      const paymentResponse = await axios.post('/v1/payments/', {
        reservationId: reservationId,
        amount: totalPrice,
        orderName: `${flight.vihRouteName} 항공권`,
      });

      /**
       * 백엔드 응답:
       * - orderId: 주문 번호
       * - amount: 결제 금액
       * - orderName: 주문명
       * - clientKey: 토스페이먼츠 클라이언트 키
       * - successUrl: 결제 성공시 리다이렉트 URL
       * - failUrl: 결제 실패시 리다이렉트 URL
       */
      setPaymentData(paymentResponse.data);
      setPaymentStatus('ready');
    } catch (err) {
      console.error('결제 생성 실패:', err);
      if (err.response?.status === 401) {
        // 결제 정보를 localStorage에 저장
        try {
          const dataToSave = {
            flight,
            searchConditions,
            selectedClass,
            passengers,
            totalPrice
          };
          localStorage.setItem('flightPaymentData', JSON.stringify(dataToSave));
          console.log('결제 정보 저장 완료');
        } catch (e) {
          console.error('결제 정보 저장 실패:', e);
        }

        // 로그인 페이지로 리다이렉트 (현재 경로를 redirect 파라미터로 전달)
        setPaymentStatus('idle');
        alert(t('alert_login_required_payment'));
        window.location.href = `/login-page?redirect=${encodeURIComponent('/reservations/flights/payment')}`;
        return;
      } else {
        setError(t('alert_payment_create_fail'));
      }
      setPaymentStatus('idle');
    }
  };

  /**
   * 결제하기 버튼 클릭 핸들러
   * 토스페이먼츠 결제창을 띄웁니다
   */
  const handlePayment = async () => {
    if (!tossPayments || !paymentData) {
      alert(t('alert_payment_not_ready'));
      return;
    }

    setPaymentStatus('processing');

    try {
      /**
       * 토스페이먼츠 v2 SDK 결제 요청
       * customerKey: 고객 고유 식별자 (회원 ID 등)
       * 비회원의 경우 TossPayments.ANONYMOUS 사용 가능
       */
      const payment = tossPayments.payment({
        customerKey: 'GUEST_' + Date.now(),
      });

      /**
       * 결제 요청
       * method: 결제 수단 (CARD, VIRTUAL_ACCOUNT, TRANSFER 등)
       * amount: 결제 금액 (currency와 value 객체로 전달)
       * orderId: 주문 번호
       * orderName: 주문명
       * successUrl: 결제 성공시 리다이렉트 URL
       * failUrl: 결제 실패시 리다이렉트 URL
       * customerName: 고객 이름 (선택)
       */
      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: paymentData.amount,
        },
        orderId: paymentData.orderId,
        orderName: paymentData.orderName,
        successUrl: `${window.location.origin}/reservations/flights/payment/success`,
        failUrl: `${window.location.origin}/reservations/flights/payment/fail`,
        customerName: passengers[0] ? `${passengers[0].lastName} ${passengers[0].firstName}` : '고객',
      });

      /**
       * 주의: 이 코드는 실행되지 않습니다
       * 토스페이먼츠가 successUrl 또는 failUrl로 리다이렉트하기 때문입니다
       */
    } catch (err) {
      console.error('결제 요청 실패:', err);
      console.error('에러 코드:', err.code);
      console.error('에러 메시지:', err.message);
      console.error('전체 에러 객체:', JSON.stringify(err, null, 2));
      console.error('전체 에러 객체:', JSON.stringify(err, null, 2));
      setError(`${t('alert_payment_req_fail')} (${err.code || err.message || 'Error'})`);
      setPaymentStatus('ready');
    }
  };

  /**
   * 좌석 등급 한글 변환
   */
  const getSeatClassName = () => {
    return selectedClass === 'economy' ? t('class_economy') : t('class_business');
  };

  /**
   * 시간 포맷팅 함수
   *
   * [쉬운 설명]
   * 시간 데이터가 여러 형식으로 올 수 있어요:
   * - ISO 형식: "2026-01-27T15:00:00" (새 형식)
   * - 기존 형식: "202601271500" (YYYYMMDDHHMM)
   * 이 함수가 두 형식을 모두 처리해서 "15:00" 같은 형태로 만들어요.
   */
  const formatTime = (timeString) => {
    if (!timeString) return '';

    // ISO 형식 체크 (T나 -가 포함되어 있으면 ISO 형식)
    if (timeString.includes('T') || timeString.includes('-')) {
      try {
        const date = new Date(timeString);
        // "15:00" 형태로 반환
        return date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      } catch {
        return timeString;
      }
    }

    // 기존 형식 "202601271500" (하위 호환성)
    if (timeString.length >= 12) {
      const hours = timeString.substring(8, 10);
      const minutes = timeString.substring(10, 12);
      return `${hours}:${minutes}`;
    }

    return timeString;
  };

  /**
   * 날짜 포맷팅 함수
   *
   * [쉬운 설명]
   * 날짜 데이터도 여러 형식으로 올 수 있어요:
   * - ISO 형식: "2026-01-27T15:00:00" 또는 "2026-01-27" (새 형식)
   * - 기존 형식: "20260127" (YYYYMMDD)
   * 이 함수가 두 형식을 모두 처리해서 "2026년 1월 27일" 형태로 만들어요.
   */
  const formatDate = (dateString) => {
    if (!dateString) return '';

    // ISO 형식 체크 (T나 -가 포함되어 있으면 ISO 형식)
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

    // 기존 형식 "20260127" (하위 호환성)
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
   * 로딩 중이거나 데이터가 없으면 표시하지 않음
   */
  if (!flight || !searchConditions || !passengers) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* 왼쪽 영역: 결제 정보 */}
          <div className="lg:col-span-8 space-y-6">
            {/* 예약 정보 요약 카드 */}
            <SearchCard title={t('title_reservation_info')}>
              <div className="space-y-4">
                {/* 항공편 정보 */}
                {/* [수정됨] 새 형식(airlineName)과 기존 형식(airlineNm) 모두 지원 */}
                <div className="border-b dark:border-gray-700 pb-4">
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">
                    {t('title_flight_info')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('label_airline')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {/* 새 형식: airlineName, 기존 형식: airlineNm */}
                        {flight.airlineName || flight.airlineNm || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('label_route')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {/* 새 형식: departureAirport → arrivalAirport, 기존 형식: vihRouteName */}
                        {flight.vihRouteName ||
                          (flight.departureAirport && flight.arrivalAirport
                            ? `${flight.departureAirport} → ${flight.arrivalAirport}`
                            : '-')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('label_departure')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {/* 새 형식: depAt (ISO), 기존 형식: depPlandTime */}
                        {formatTime(flight.depAt || flight.depPlandTime) || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('label_arrival')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {/* 새 형식: arrAt (ISO), 기존 형식: arrPlandTime */}
                        {formatTime(flight.arrAt || flight.arrPlandTime) || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('label_date')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {/* 출발 시각에서 날짜 추출, 없으면 검색조건 사용 */}
                        {formatDate(flight.depAt || searchConditions.depDate) || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('title_select_class')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getSeatClassName()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 승객 정보 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">
                    {t('title_passenger_count_info').replace('{count}', passengers.length)}
                  </h3>
                  <div className="space-y-3">
                    {passengers.map((passenger, index) => (
                      <div
                        key={index}
                        className="bg-slate-50 dark:bg-gray-800 rounded-lg p-4"
                      >
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">{t('passenger_n').replace('{n}', index + 1)}</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {passenger.lastName} {passenger.firstName}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">{t('label_dob')}</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {passenger.dateOfBirth}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-600 dark:text-gray-400">{t('label_passport')}</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {passenger.passportNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SearchCard>

            {/* 결제 금액 카드 */}
            <SearchCard title={t('title_payment_amount')}>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('label_ticket_count').replace('{count}', searchConditions.passengers)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {totalPrice.toLocaleString()}{t('unit_krw')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('title_select_class')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getSeatClassName()}
                  </span>
                </div>
                <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('label_total_payment')}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {totalPrice.toLocaleString()}{t('unit_krw')}
                  </span>
                </div>
              </div>
            </SearchCard>

            {/* 에러 메시지 표시 */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400">
                    error
                  </span>
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* 결제 버튼 영역 */}
            <div className="space-y-4">
              {paymentStatus === 'idle' && (
                <button
                  onClick={createPayment}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors"
                >
                  {t('btn_prepare_payment')}
                </button>
              )}

              {paymentStatus === 'creating' && (
                <div className="w-full bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 py-4 rounded-lg font-semibold text-lg text-center">
                  {t('msg_payment_preparing')}
                </div>
              )}

              {paymentStatus === 'ready' && (
                <button
                  onClick={handlePayment}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">payment</span>
                  {t('btn_pay_amount').replace('{amount}', totalPrice.toLocaleString())}
                </button>
              )}

              {paymentStatus === 'processing' && (
                <div className="w-full bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 py-4 rounded-lg font-semibold text-lg text-center">
                  {t('msg_payment_processing')}
                </div>
              )}

              {/* 이전 단계로 돌아가기 버튼 */}
              <button
                onClick={() => navigate(-1)}
                disabled={paymentStatus === 'creating' || paymentStatus === 'processing'}
                className="w-full bg-white dark:bg-[#1e2b36] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('btn_back_step')}
              </button>
            </div>

            {/* 결제 안내 사항 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                  info
                </span>
                {t('title_payment_guide')}
              </h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-8">
                <li>{t('info_payment_1')}</li>
                <li>{t('info_payment_2')}</li>
                <li>{t('info_payment_3')}</li>
                <li>{t('info_payment_4')}</li>
              </ul>
            </div>
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

export default FlightPayment;
