import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  /**
   * 이전 페이지(FlightSeat)에서 전달받은 데이터
   * flight - 선택한 항공편 정보
   * searchConditions - 검색 조건 (출발지, 도착지, 날짜, 승객수)
   * selectedClass - 선택한 좌석 등급 (economy 또는 business)
   * passengers - 승객 정보 배열
   * totalPrice - 총 결제 금액
   */
  const { flight, searchConditions, selectedClass, passengers, totalPrice } = location.state || {};

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
      alert('결제 정보가 없습니다. 처음부터 다시 진행해주세요.');
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
        const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
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
          const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
          setTossPayments(window.TossPayments(clientKey));
        }
      };

      /**
       * 스크립트 로드 실패시
       */
      script.onerror = () => {
        console.error('토스페이먼츠 SDK 로드 실패');
        setError('결제 시스템을 불러올 수 없습니다.');
      };

      document.head.appendChild(script);
    };

    loadSDK();
  }, []);

  /**
   * 백엔드에 결제 생성 요청
   * 백엔드는 orderId를 생성하고 DB에 결제 정보를 저장합니다
   * 이렇게 하면 프론트엔드에서 금액을 조작할 수 없습니다
   */
  const createPayment = async () => {
    setPaymentStatus('creating');
    setError(null);

    try {
      /**
       * 백엔드 API 호출: POST /v1/payments/
       * 요청 데이터:
       * - amount: 결제 금액
       * - orderName: 주문명
       * - flight: 항공편 정보 (예약 생성에 필요)
       * - passengers: 승객 정보
       * - selectedClass: 좌석 등급
       */
      const response = await axios.post('/v1/payments/', {
        amount: totalPrice,
        orderName: `${flight.vihRouteName} 항공권`,
        flight: {
          airlineNm: flight.airlineNm,
          depPlandTime: flight.depPlandTime,
          arrPlandTime: flight.arrPlandTime,
          vihRouteName: flight.vihRouteName,
        },
        passengers,
        selectedClass,
      });

      /**
       * 백엔드 응답:
       * - orderId: 주문 번호 (백엔드에서 생성)
       * - amount: 결제 금액 (백엔드에서 저장한 값)
       * - orderName: 주문명
       * - clientKey: 토스페이먼츠 클라이언트 키
       * - successUrl: 결제 성공시 리다이렉트 URL
       * - failUrl: 결제 실패시 리다이렉트 URL
       */
      setPaymentData(response.data);
      setPaymentStatus('ready');
    } catch (err) {
      console.error('결제 생성 실패:', err);
      setError('결제 생성에 실패했습니다. 다시 시도해주세요.');
      setPaymentStatus('idle');
    }
  };

  /**
   * 결제하기 버튼 클릭 핸들러
   * 토스페이먼츠 결제창을 띄웁니다
   */
  const handlePayment = async () => {
    if (!tossPayments || !paymentData) {
      alert('결제 준비가 완료되지 않았습니다.');
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
      setError('결제 요청에 실패했습니다.');
      setPaymentStatus('ready');
    }
  };

  /**
   * 좌석 등급 한글 변환
   */
  const getSeatClassName = () => {
    return selectedClass === 'economy' ? '일반석' : '비즈니스석';
  };

  /**
   * 시간 포맷팅 함수 (YYYYMMDDHHMM → HH:MM)
   */
  const formatTime = (timeString) => {
    if (!timeString || timeString.length < 12) return '';
    const hours = timeString.substring(8, 10);
    const minutes = timeString.substring(10, 12);
    return `${hours}:${minutes}`;
  };

  /**
   * 날짜 포맷팅 함수 (YYYYMMDD → YYYY년 MM월 DD일)
   */
  const formatDate = (dateString) => {
    if (!dateString || dateString.length !== 8) return '';
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}년 ${month}월 ${day}일`;
  };

  /**
   * 로딩 중이거나 데이터가 없으면 표시하지 않음
   */
  if (!flight || !searchConditions || !passengers) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-bg-dark">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* 왼쪽 영역: 결제 정보 */}
          <div className="col-span-8 space-y-6">
            {/* 예약 정보 요약 카드 */}
            <SearchCard title="예약 정보">
              <div className="space-y-4">
                {/* 항공편 정보 */}
                <div className="border-b dark:border-gray-700 pb-4">
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">
                    항공편 정보
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">항공사</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {flight.airlineNm}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">노선</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {flight.vihRouteName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">출발</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatTime(flight.depPlandTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">도착</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatTime(flight.arrPlandTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">날짜</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(searchConditions.depDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">좌석 등급</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getSeatClassName()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 승객 정보 */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">
                    승객 정보 ({passengers.length}명)
                  </h3>
                  <div className="space-y-3">
                    {passengers.map((passenger, index) => (
                      <div
                        key={index}
                        className="bg-slate-50 dark:bg-gray-800 rounded-lg p-4"
                      >
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">승객 {index + 1}</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {passenger.lastName} {passenger.firstName}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">생년월일</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {passenger.dateOfBirth}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-600 dark:text-gray-400">여권 번호</p>
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
            <SearchCard title="결제 금액">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    항공권 ({searchConditions.passengers}명)
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {totalPrice.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">좌석 등급</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getSeatClassName()}
                  </span>
                </div>
                <div className="border-t dark:border-gray-700 pt-3 flex justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    총 결제 금액
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {totalPrice.toLocaleString()}원
                  </span>
                </div>
              </div>
            </SearchCard>

            {/* 에러 메시지 표시 */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-red-600 dark:text-red-400">
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
                  결제 준비하기
                </button>
              )}

              {paymentStatus === 'creating' && (
                <div className="w-full bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 py-4 rounded-lg font-semibold text-lg text-center">
                  결제 준비중...
                </div>
              )}

              {paymentStatus === 'ready' && (
                <button
                  onClick={handlePayment}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-rounded">payment</span>
                  {totalPrice.toLocaleString()}원 결제하기
                </button>
              )}

              {paymentStatus === 'processing' && (
                <div className="w-full bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 py-4 rounded-lg font-semibold text-lg text-center">
                  결제 진행중...
                </div>
              )}

              {/* 이전 단계로 돌아가기 버튼 */}
              <button
                onClick={() => navigate(-1)}
                disabled={paymentStatus === 'creating' || paymentStatus === 'processing'}
                className="w-full bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전 단계로
              </button>
            </div>

            {/* 결제 안내 사항 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="material-symbols-rounded text-blue-600 dark:text-blue-400">
                  info
                </span>
                결제 안내
              </h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-8">
                <li>결제는 토스페이먼츠를 통해 안전하게 처리됩니다</li>
                <li>결제 정보는 암호화되어 전송됩니다</li>
                <li>결제 후 예약 확정까지 최대 5분이 소요될 수 있습니다</li>
                <li>결제 문제 발생시 고객센터로 문의해주세요</li>
              </ul>
            </div>
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

export default FlightPayment;
