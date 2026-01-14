import { useState } from 'react'
import axios from '../../api/axios'

export default function FlightsSearchPage() {
  const [form, setForm] = useState({
    tripType: 'ONEWAY',
    from: 'GMP',
    to: 'CJU',
    departDate: '',
    returnDate: '',
    passengers: { adults: 1, children: 0, infants: 0 },
    cabinClass: 'ECONOMY',
    sort: '',
    filters: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onPassengersChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      passengers: { ...prev.passengers, [field]: Number(value) || 0 },
    }))
  }

  const search = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const payload = {
        tripType: form.tripType,
        from: form.from, // serializer uses source='from', key here must be 'from'
        to: form.to,
        departDate: form.departDate,
        returnDate: form.tripType === 'ROUNDTRIP' ? form.returnDate || null : null,
        passengers: form.passengers,
        cabinClass: form.cabinClass,
        sort: form.sort || null,
        filters: form.filters,
      }
      const { data } = await axios.post('/v1/transport/flights/search/', payload)
      setResults(Array.isArray(data?.results) ? data.results : [])
    } catch (err) {
      const msg = err?.response?.data?.error || '검색 중 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">항공편 검색</h1>

      <form onSubmit={search} className="grid grid-cols-12 gap-4 bg-white dark:bg-[#1e2b36] p-6 rounded-xl shadow-sm">
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">여정</label>
          <select name="tripType" value={form.tripType} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
            <option value="ONEWAY">편도</option>
            <option value="ROUNDTRIP">왕복</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발</label>
          <input name="from" value={form.from} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" placeholder="GMP" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">도착</label>
          <input name="to" value={form.to} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" placeholder="CJU" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발일</label>
          <input type="date" name="departDate" value={form.departDate} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        {form.tripType === 'ROUNDTRIP' && (
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">귀국일</label>
            <input type="date" name="returnDate" value={form.returnDate} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">좌석 등급</label>
          <select name="cabinClass" value={form.cabinClass} onChange={onChange} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
            <option>ECONOMY</option>
            <option>PREMIUM</option>
            <option>BUSINESS</option>
            <option>FIRST</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">성인</label>
          <input type="number" min="1" value={form.passengers.adults} onChange={(e) => onPassengersChange('adults', e.target.value)} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">소아</label>
          <input type="number" min="0" value={form.passengers.children} onChange={(e) => onPassengersChange('children', e.target.value)} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">유아</label>
          <input type="number" min="0" value={form.passengers.infants} onChange={(e) => onPassengersChange('infants', e.target.value)} className="w-full border rounded-lg h-12 px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>

        <div className="col-span-12 flex gap-3 mt-2">
          <button type="submit" className="h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition">검색</button>
          {loading && <span className="text-sm text-gray-500 dark:text-gray-300 self-center">검색 중...</span>}
          {error && <span className="text-sm text-red-500 self-center">{String(error)}</span>}
        </div>
      </form>

      <div className="mt-8 grid grid-cols-12 gap-4">
        {results.map((item) => (
          <FlightOfferCard key={item.offerId} offer={item} form={form} />
        ))}
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
function FlightOfferCard({ offer, form }) {
  const navigate = useNavigate()
  const goCheckout = () => {
    // Pass required params via querystring
    const params = new URLSearchParams({
      offerId: offer.offerId,
      tripType: offer.tripType || form.tripType,
      cabinClass: form.cabinClass,
      orderName: offer.airline ? `${offer.airline} 항공권` : '항공권',
      amount: String(offer.totalPrice || offer.pricePerPerson || 0),
    })
    navigate(`/reservations/flights/checkout?${params.toString()}`)
  }

  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-5 hover:-translate-y-1 transition">
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{offer.airline || '항공사'}</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">Offer: {offer.offerId}</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">총액: {offer.totalPrice} {offer.currency}</div>
      {offer.seatAvailabilityNote && (
        <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">{offer.seatAvailabilityNote}</div>
      )}
      <button onClick={goCheckout} className="mt-4 h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600">이 항공편 예약</button>
    </div>
  )
}

