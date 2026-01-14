import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from '../../api/axios'

export default function FlightsCheckoutPage() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const qs = useMemo(() => new URLSearchParams(search), [search])

  const offerId = qs.get('offerId') || ''
  const tripType = qs.get('tripType') || 'ONEWAY'
  const cabinClass = qs.get('cabinClass') || 'ECONOMY'
  const defaultOrderName = qs.get('orderName') || '항공권'
  const defaultAmount = Number(qs.get('amount') || 0)

  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [errorDetail, setErrorDetail] = useState(null)

  const [passengers, setPassengers] = useState([
    { passengerType: 'ADT', fullName: '', birthDate: '', passportNo: '' },
  ])
  const [contacts, setContacts] = useState({ contactEmail: '', contactPhone: '' })
  const [requests, setRequests] = useState({ specialRequest: '' })
  const [seatSelections, setSeatSelections] = useState([])

  const [creating, setCreating] = useState(false)
  const [reservation, setReservation] = useState(null)
  const [createError, setCreateError] = useState(null)

  const [paymentReady, setPaymentReady] = useState(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState(null)

  useEffect(() => {
    if (!offerId) return
    const load = async () => {
      setLoadingDetail(true)
      setErrorDetail(null)
      try {
        const { data } = await axios.get(`/v1/transport/flights/${offerId}/`)
        setDetail(data)
      } catch (err) {
        setErrorDetail(err?.response?.data?.error || '항공편 상세 로드 실패')
      } finally {
        setLoadingDetail(false)
      }
    }
    load()
  }, [offerId])

  const updatePassenger = (idx, field, value) => {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  const addPassenger = () => setPassengers((prev) => [...prev, { passengerType: 'ADT', fullName: '', birthDate: '', passportNo: '' }])
  const removePassenger = (idx) => setPassengers((prev) => prev.filter((_, i) => i !== idx))

  const createReservation = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const payload = {
        offerId,
        tripType,
        cabinClass,
        passengers: passengers.map((p) => ({
          passengerType: p.passengerType,
          fullName: p.fullName,
          birthDate: p.birthDate || null,
          passportNo: p.passportNo || null,
        })),
        contacts: {
          contactEmail: contacts.contactEmail || null,
          contactPhone: contacts.contactPhone || null,
        },
        requests: { specialRequest: requests.specialRequest || null },
        seatSelections: seatSelections.length ? seatSelections : null,
      }
      const { data } = await axios.post('/v1/reservations/flight/', payload)
      setReservation(data)
    } catch (err) {
      setCreateError(err?.response?.data?.error || '예약 생성 실패')
    } finally {
      setCreating(false)
    }
  }

  const createPayment = async () => {
    if (!reservation) return
    setPaymentLoading(true)
    setPaymentError(null)
    try {
      const { data } = await axios.post('/v1/payments/', {
        reservationId: reservation.reservationId,
        amount: defaultAmount > 0 ? defaultAmount : 1000,
        orderName: defaultOrderName,
      })
      setPaymentReady(data)
    } catch (err) {
      setPaymentError(err?.response?.data?.error || '결제 생성 실패')
    } finally {
      setPaymentLoading(false)
    }
  }

  const goManualSuccess = () => navigate('/reservations/payment/success')
  const goManualFail = () => navigate('/reservations/payment/fail')

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">항공 예약</h1>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
          <SectionTitle>승객 정보</SectionTitle>
          {passengers.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">구분</label>
                <select value={p.passengerType} onChange={(e) => updatePassenger(idx, 'passengerType', e.target.value)} className="w-full h-11 border rounded-lg px-2 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
                  <option>ADT</option>
                  <option>CHD</option>
                  <option>INF</option>
                </select>
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">이름</label>
                <input value={p.fullName} onChange={(e) => updatePassenger(idx, 'fullName', e.target.value)} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">생년월일</label>
                <input type="date" value={p.birthDate} onChange={(e) => updatePassenger(idx, 'birthDate', e.target.value)} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">여권번호</label>
                <input value={p.passportNo} onChange={(e) => updatePassenger(idx, 'passportNo', e.target.value)} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={addPassenger} className="h-12 px-5 rounded-lg bg-gray-100 dark:bg-[#243140] dark:text-gray-100 hover:bg-gray-200">승객 추가</button>
            {passengers.length > 1 && (
              <button type="button" onClick={() => removePassenger(passengers.length - 1)} className="h-12 px-5 rounded-lg bg-gray-100 dark:bg-[#243140] dark:text-gray-100 hover:bg-gray-200">마지막 승객 제거</button>
            )}
          </div>

          <SectionTitle className="mt-8">연락처 / 요청사항</SectionTitle>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">이메일</label>
              <input value={contacts.contactEmail} onChange={(e) => setContacts((s) => ({ ...s, contactEmail: e.target.value }))} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div className="col-span-6">
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">전화번호</label>
              <input value={contacts.contactPhone} onChange={(e) => setContacts((s) => ({ ...s, contactPhone: e.target.value }))} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div className="col-span-12">
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">특별 요청</label>
              <input value={requests.specialRequest} onChange={(e) => setRequests({ specialRequest: e.target.value })} className="w-full h-11 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button disabled={creating} onClick={createReservation} className="h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">예약 생성</button>
            {creating && <span className="self-center text-sm text-gray-500 dark:text-gray-300">처리 중...</span>}
            {createError && <span className="self-center text-sm text-red-500">{String(createError)}</span>}
          </div>

          {reservation && (
            <div className="mt-8 p-4 border rounded-xl dark:border-gray-700">
              <div className="text-gray-900 dark:text-gray-100 font-semibold">예약 생성 완료</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Reservation ID: {reservation.reservationId}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">OrderNo: {reservation.testOrderNo}</div>

              <div className="mt-4 flex gap-3">
                <button disabled={paymentLoading} onClick={createPayment} className="h-12 px-6 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">결제 시작</button>
                {paymentLoading && <span className="self-center text-sm text-gray-500 dark:text-gray-300">결제 준비 중...</span>}
                {paymentError && <span className="self-center text-sm text-red-500">{String(paymentError)}</span>}
              </div>

              {paymentReady && (
                <div className="mt-4 text-sm text-gray-700 dark:text-gray-200">
                  <div>orderId: {paymentReady.orderId}</div>
                  <div>amount: {paymentReady.amount}</div>
                  <div>orderName: {paymentReady.orderName}</div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">결제 위젯/리다이렉트는 공통 영역에서 처리합니다. 아래 버튼으로 테스트 페이지 라우트로 이동할 수 있습니다.</div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={goManualSuccess} className="h-10 px-4 rounded-lg bg-gray-100 dark:bg-[#243140] dark:text-gray-100 hover:bg-gray-200">성공 페이지로</button>
                    <button onClick={goManualFail} className="h-10 px-4 rounded-lg bg-gray-100 dark:bg-[#243140] dark:text-gray-100 hover:bg-gray-200">실패 페이지로</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
            <SectionTitle>예약 요약</SectionTitle>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <div>Offer: {offerId || '-'}</div>
              <div>여정: {tripType}</div>
              <div>좌석: {cabinClass}</div>
            </div>
            {loadingDetail && <div className="mt-2 text-sm text-gray-500 dark:text-gray-300">상세 불러오는 중...</div>}
            {errorDetail && <div className="mt-2 text-sm text-red-500">{String(errorDetail)}</div>}
            {detail && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                <div>구간 수: {detail.segments?.length || 0}</div>
                {detail.baggageInfo && <div>수하물: {detail.baggageInfo}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{children}</div>
}

