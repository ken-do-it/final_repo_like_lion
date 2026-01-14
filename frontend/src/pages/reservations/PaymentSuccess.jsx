import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import axios from '../../api/axios'

export default function PaymentSuccess() {
  const { search } = useLocation()
  const qs = new URLSearchParams(search)
  const paymentKey = qs.get('paymentKey')
  const orderId = qs.get('orderId')
  const amountRaw = qs.get('amount')
  const amount = amountRaw ? Number(amountRaw) : undefined

  const [verifying, setVerifying] = useState(true)
  const [ok, setOk] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const verify = async () => {
      setVerifying(true)
      setError(null)
      setOk(false)
      try {
        if (!paymentKey || !orderId || !amount) {
          throw new Error('결제 검증 파라미터가 부족합니다.')
        }
        const { data } = await axios.post('/v1/payments/confirm/', {
          paymentKey,
          orderId,
          amount,
        })
        if (data?.success) {
          setOk(true)
          setData(data?.data)
        } else {
          throw new Error(data?.error?.message || '승인 실패')
        }
      } catch (err) {
        setError(err?.response?.data?.error?.message || err?.message || '결제 승인 실패')
      } finally {
        setVerifying(false)
      }
    }
    verify()
  }, [paymentKey, orderId, amount])

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">결제 결과</h1>
      {verifying && <div className="text-gray-700 dark:text-gray-200">결제 승인 확인 중...</div>}
      {!verifying && ok && (
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
          <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-2">결제가 성공적으로 완료되었습니다.</div>
          <div className="text-sm text-gray-700 dark:text-gray-200">주문번호: {orderId}</div>
        </div>
      )}
      {!verifying && !ok && (
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
          <div className="text-red-600 dark:text-red-400 font-semibold mb-2">결제 확인에 실패했습니다.</div>
          <div className="text-sm text-gray-700 dark:text-gray-200">{String(error)}</div>
        </div>
      )}
    </div>
  )
}

