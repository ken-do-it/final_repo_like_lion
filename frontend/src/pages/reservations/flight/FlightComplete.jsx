import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 항공권 예약 완료 페이지
 * 결제 승인 후 예약이 완료되었음을 표시하는 페이지
 *
 * FlightPaymentSuccess에서 리다이렉트되어 오는 페이지입니다
 *
 * 사용 예시:
 * <Route path="/flights/complete" element={<FlightComplete />} />
 */
const FlightComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * 이전 페이지(FlightPaymentSuccess)에서 전달받은 데이터
   * orderId - 주문 번호
   * paymentData - 결제 정보 (토스페이먼츠 API 응답)
   */
  const { orderId, paymentData } = location.state || {};

  /**
   * 데이터가 없으면 홈으로 리다이렉트
   */
  React.useEffect(() => {
    if (!orderId || !paymentData) {
      navigate('/');
    }
  }, [orderId, paymentData, navigate]);

  /**
   * 데이터가 없으면 아무것도 표시하지 않음
   */
  if (!orderId || !paymentData) {
    return null;
  }

  /**
   * 날짜 포맷팅 함수 (ISO 문자열 → YYYY년 MM월 DD일 HH:MM)
   */
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
  };

  /**
   * 결제 금액 추출
   * 토스페이먼츠 API 응답 구조에 따라 다를 수 있음
   */
  const getPaymentAmount = () => {
    return paymentData.totalAmount || paymentData.amount || 0;
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* 성공 메시지 카드 */}
        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-12 text-center mb-6">
          {/* 성공 아이콘 */}
          <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-6xl">
              check_circle
            </span>
          </div>

          {/* 제목 */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            예약이 완료되었습니다
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            항공권 예약이 성공적으로 완료되었습니다.
          </p>

          {/* 예약 정보 */}
          <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-6 mb-6 space-y-4">
            {/* 주문 번호 */}
            <div className="border-b dark:border-gray-700 pb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                예약 번호
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {orderId}
              </p>
            </div>

            {/* 결제 정보 */}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  결제 금액
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getPaymentAmount().toLocaleString()}원
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  결제 수단
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {paymentData.method || '카드'}
                </p>
              </div>
            </div>

            {/* 결제 일시 */}
            {paymentData.approvedAt && (
              <div className="text-left">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  결제 일시
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDateTime(paymentData.approvedAt)}
                </p>
              </div>
            )}

            {/* 영수증 URL */}
            {paymentData.receiptUrl && (
              <div className="text-left pt-3 border-t dark:border-gray-700">
                <a
                  href={paymentData.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-lg">
                    receipt_long
                  </span>
                  영수증 확인하기
                </a>
              </div>
            )}
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                info
              </span>
              예약 안내
            </h3>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-7">
              <li>예약 확인 이메일을 발송해드렸습니다</li>
              <li>탑승 시 신분증을 지참해주세요</li>
              <li>출발 2시간 전까지 공항에 도착해주세요</li>
              <li>예약 변경 및 취소는 마이페이지에서 가능합니다</li>
            </ul>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/my/reservations')}
            className="bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            내 예약 보기
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-4 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            홈으로 가기
          </button>
        </div>

        {/* 추가 버튼 */}
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/reservations/flights')}
            className="text-primary hover:text-primary/80 transition-colors font-medium text-sm"
          >
            다른 항공권 예약하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlightComplete;
