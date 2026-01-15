import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * 항공권 결제 실패 페이지
 * 토스페이먼츠 결제 실패시 리다이렉트되는 페이지
 *
 * 사용자가 결제를 취소하거나 결제 도중 오류가 발생한 경우 표시됩니다
 *
 * 사용 예시:
 * <Route path="/flights/payment/fail" element={<FlightPaymentFail />} />
 */
const FlightPaymentFail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * URL 쿼리 파라미터에서 에러 정보 추출
   * 토스페이먼츠가 리다이렉트하면서 자동으로 추가한 값들입니다
   */
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');

  /**
   * 에러 코드에 따른 사용자 친화적인 메시지 반환
   */
  const getErrorDescription = () => {
    switch (errorCode) {
      case 'USER_CANCEL':
        return '사용자가 결제를 취소했습니다.';
      case 'INVALID_CARD_COMPANY':
        return '유효하지 않은 카드사입니다.';
      case 'REJECT_CARD_COMPANY':
        return '결제가 거절되었습니다. 카드사에 문의해주세요.';
      case 'INVALID_CARD_NUMBER':
        return '잘못된 카드번호입니다.';
      case 'INVALID_UNREGISTERED_SUBMALL':
        return '등록되지 않은 서브몰입니다.';
      case 'INVALID_ACCOUNT_INFO':
        return '계좌 정보가 유효하지 않습니다.';
      case 'NOT_AVAILABLE_PAYMENT':
        return '현재 결제가 불가능합니다.';
      case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
        return '일일 결제 한도를 초과했습니다.';
      case 'EXCEED_MAX_ONE_TIME_PAYMENT_AMOUNT':
        return '1회 결제 한도를 초과했습니다.';
      case 'BELOW_MIN_PAYMENT_AMOUNT':
        return '최소 결제 금액 미만입니다.';
      case 'INVALID_CARD_INSTALLMENT_PLAN':
        return '유효하지 않은 할부 개월수입니다.';
      case 'COMMON_ERROR':
        return '결제 중 오류가 발생했습니다.';
      default:
        return errorMessage || '알 수 없는 오류가 발생했습니다.';
    }
  };

  /**
   * 다시 시도 버튼 클릭 핸들러
   * 이전 페이지(결제 페이지)로 돌아갑니다
   */
  const handleRetry = () => {
    navigate(-1);
  };

  /**
   * 처음부터 시작 버튼 클릭 핸들러
   * 항공권 검색 페이지로 이동합니다
   */
  const handleStartOver = () => {
    navigate('/reservations/flights');
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-surface-dark rounded-xl shadow-lg p-12 max-w-md w-full">
        {/* 에러 아이콘 */}
        <div className="bg-red-100 dark:bg-red-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-5xl">
            cancel
          </span>
        </div>

        {/* 제목 */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
          결제에 실패했습니다
        </h2>

        {/* 에러 메시지 */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300 text-center">
            {getErrorDescription()}
          </p>
        </div>

        {/* 에러 코드 (개발자용) */}
        {errorCode && (
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-6">
            오류 코드: {errorCode}
          </p>
        )}

        {/* 버튼 영역 */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            다시 시도
          </button>
          <button
            onClick={handleStartOver}
            className="w-full bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            처음부터 다시 시작
          </button>
        </div>

        {/* 안내 사항 */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
              info
            </span>
            결제 실패 안내
          </h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-7">
            <li>카드 한도를 확인해주세요</li>
            <li>카드사 승인이 필요할 수 있습니다</li>
            <li>다른 결제 수단을 사용해보세요</li>
            <li>문제가 계속되면 고객센터로 문의해주세요</li>
          </ul>
        </div>

        {/* 고객센터 버튼 */}
        <button
          onClick={() => navigate('/support')}
          className="w-full mt-4 text-primary hover:text-primary/80 transition-colors font-medium text-sm"
        >
          고객센터 문의하기
        </button>
      </div>
    </div>
  );
};

export default FlightPaymentFail;
