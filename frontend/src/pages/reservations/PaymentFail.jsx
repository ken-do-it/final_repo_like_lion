import { useLocation } from 'react-router-dom'

export default function PaymentFail() {
  const { search } = useLocation()
  const qs = new URLSearchParams(search)
  const message = qs.get('message') || '결제가 실패했거나 취소되었습니다.'

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">결제 실패</h1>
      <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
        <div className="text-red-600 dark:text-red-400 font-semibold mb-2">결제 진행이 완료되지 않았습니다.</div>
        <div className="text-sm text-gray-700 dark:text-gray-200">{message}</div>
      </div>
    </div>
  )
}

