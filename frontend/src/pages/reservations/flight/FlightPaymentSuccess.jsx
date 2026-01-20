import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../../../api/axios';

/**
 * 항공권 결제 성공 페이지
 * 토스페이먼츠 결제 완료 후 리다이렉트되는 페이지
 *
 * 보안 플로우:
 * 1. URL에서 paymentKey, orderId, amount 추출
 * 2. 백엔드로 결제 승인 요청 (POST /api/v1/payments/confirm/)
 * 3. 백엔드가 토스페이먼츠 API로 실제 승인 및 금액 검증
 * 4. 백엔드 검증 성공시 예약 완료 페이지로 이동
 * 5. 실패시 에러 표시
 *
 * 주의사항:
 * - 프론트엔드는 절대 직접 결제를 승인하지 않습니다
 * - 모든 검증은 백엔드에서 수행됩니다
 * - 금액 조작을 방지하기 위해 백엔드에서 저장된 금액과 비교합니다
 *
 * 사용 예시:
 * <Route path="/flights/payment/success" element={<FlightPaymentSuccess />} />
 */
const FlightPaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * 결제 승인 상태
   * confirming - 백엔드에 승인 요청중
   * success - 승인 완료
   * error - 승인 실패
   */
  const [status, setStatus] = useState('confirming');

  /**
   * 백엔드 승인 응답 데이터
   */
  const [result, setResult] = useState(null);

  /**
   * 에러 메시지
   */
  const [error, setError] = useState(null);

  /**
   * 페이지 로드시 자동으로 백엔드에 승인 요청
   * 이 함수는 한 번만 실행되어야 합니다 (중복 승인 방지)
   */
  useEffect(() => {
    /**
     * 백엔드에 결제 승인 요청
     * 백엔드는 다음을 수행합니다:
     * 1. DB에서 orderId로 결제 정보 조회
     * 2. 저장된 금액과 URL 파라미터 금액 비교
     * 3. 토스페이먼츠 API로 승인 요청
     * 4. 승인 성공시 예약 상태 업데이트
     */
    const confirmPayment = async () => {
      /**
       * URL 쿼리 파라미터 추출
       * 토스페이먼츠가 리다이렉트하면서 자동으로 추가한 값들입니다
       */
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      /**
       * 필수 파라미터 검증
       */
      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 올바르지 않습니다.');
        setStatus('error');
        return;
      }

      try {
        /**
         * 백엔드 API 호출: POST /v1/payments/confirm/
         * 요청 데이터:
         * - paymentKey: 토스페이먼츠 결제 키
         * - orderId: 주문 번호
         * - amount: 결제 금액 (백엔드가 저장된 금액과 비교)
         */
        const response = await axios.post('/v1/payments/confirm/', {
          paymentKey,
          orderId,
          amount: parseInt(amount),
        });

        /**
         * 백엔드 응답:
         * - success: 승인 성공 여부
         * - data: 결제 상세 정보
         * - error: 에러 정보 (실패시)
         */
        if (response.data.success) {
          setResult(response.data.data);
          setStatus('success');

          /**
           * 3초 후 예약 완료 페이지로 이동
           * 예약 완료 페이지에서 예약 상세 정보를 표시합니다
           */
          setTimeout(() => {
            navigate('/reservations/flights/complete', {
              state: {
                orderId: orderId,
                paymentData: response.data.data,
              }
            });
          }, 3000);
        } else {
          setError(response.data.error?.message || '결제 승인에 실패했습니다.');
          setStatus('error');
        }
      } catch (err) {
        console.error('결제 승인 오류:', err);

        /**
         * 백엔드 에러 메시지 추출
         */
        const errorMessage = err.response?.data?.error?.message ||
                           err.response?.data?.message ||
                           '결제 승인 중 오류가 발생했습니다.';

        setError(errorMessage);
        setStatus('error');
      }
    };

    confirmPayment();
  }, [searchParams, navigate]);

  /**
   * 승인 진행중 화면
   */
  if (status === 'confirming') {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-12 max-w-md w-full text-center">
          {/* 로딩 스피너 */}
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            결제 승인 처리중
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            결제를 안전하게 처리하고 있습니다.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            잠시만 기다려주세요.
          </p>
        </div>
      </div>
    );
  }

  /**
   * 승인 성공 화면
   */
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-12 max-w-md w-full text-center">
          {/* 성공 아이콘 */}
          <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-5xl">
              check_circle
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            결제가 완료되었습니다
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            예약이 정상적으로 처리되었습니다.
          </p>

          {/* 결제 정보 */}
          {result && (
            <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-4 mb-6 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">주문번호</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {result.orderId}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">결제금액</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {result.totalAmount?.toLocaleString() || result.amount?.toLocaleString()}원
                </span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-500">
            곧 예약 완료 페이지로 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  /**
   * 승인 실패 화면
   */
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg p-12 max-w-md w-full text-center">
          {/* 에러 아이콘 */}
          <div className="bg-red-100 dark:bg-red-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-5xl">
              error
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            결제 승인 실패
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>

          {/* 버튼 영역 */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/reservations/flights')}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              처음부터 다시 시작
            </button>
            <button
              onClick={() => navigate('/support')}
              className="w-full bg-white dark:bg-[#1e2b36] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              고객센터 문의
            </button>
          </div>

          {/* 안내 메시지 */}
          <div className="mt-6 text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              결제 승인이 실패했지만 카드 승인이 이루어진 경우, 자동으로 취소 처리됩니다.
              영업일 기준 3-5일 내에 환불됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default FlightPaymentSuccess;
