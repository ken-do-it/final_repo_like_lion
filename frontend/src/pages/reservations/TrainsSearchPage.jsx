import { useState } from 'react'
import axios from '../../api/axios'

export default function TrainsSearchPage() {
  const [form, setForm] = useState({
    fromStation: '서울',
    toStation: '부산',
    departDate: '',
    departTime: '', // optional HH:MM
    passengers: 1,
    filters: { trainType: '' },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }
  const onFilterChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, filters: { ...prev.filters, [name]: value } }))
  }

  const swapStations = () => {
    setForm((prev) => ({ ...prev, fromStation: prev.toStation, toStation: prev.fromStation }))
  }

  const search = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const payload = {
        fromStation: form.fromStation,
        toStation: form.toStation,
        departDate: form.departDate,
        departTime: form.departTime || null,
        passengers: Number(form.passengers) || 1,
        filters: form.filters?.trainType ? { trainType: form.filters.trainType } : null,
      }
      const { data } = await axios.post('/v1/transport/trains/search/', payload)
      setResults(Array.isArray(data?.results) ? data.results : [])
    } catch (err) {
      const details = err?.response?.data?.details
      const msg = details ? JSON.stringify(details) : (err?.response?.data?.error || '검색 중 오류가 발생했습니다.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const openKorail = async (r) => {
    try {
      const params = new URLSearchParams({
        fromStation: form.fromStation,
        toStation: form.toStation,
        departDate: form.departDate,
        departTime: form.departTime || '',
        passengers: String(form.passengers || 1),
      })
      const { data } = await axios.get(`/v1/transport/trains/korail-link/?${params.toString()}`)
      if (data?.url) window.open(data.url, '_blank')
    } catch (err) {
      alert('코레일 링크 생성에 실패했습니다.')
    }
  }

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">기차 검색</h1>

      <form onSubmit={search} className="grid grid-cols-12 gap-4 bg-white dark:bg-[#1e2b36] p-6 rounded-xl shadow-sm">
        <div className="col-span-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발역</label>
          <input name="fromStation" value={form.fromStation} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-1 flex items-end">
          <button type="button" onClick={swapStations} className="w-full h-12 rounded-lg bg-gray-100 dark:bg-[#243140] dark:text-gray-100 hover:bg-gray-200">⇄</button>
        </div>
        <div className="col-span-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">도착역</label>
          <input name="toStation" value={form.toStation} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발일</label>
          <input type="date" name="departDate" value={form.departDate} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발 시간(선택)</label>
          <input name="departTime" placeholder="HH:MM" value={form.departTime} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">승객 수</label>
          <input type="number" min="1" name="passengers" value={form.passengers} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">차량 종류</label>
          <select name="trainType" value={form.filters.trainType} onChange={onFilterChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
            <option value="">전체</option>
            <option value="KTX">KTX</option>
            <option value="SRT">SRT</option>
            <option value="ITX">ITX</option>
            <option value="무궁화">무궁화</option>
          </select>
        </div>
        <div className="col-span-12 flex gap-3 mt-2">
          <button type="submit" className="h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600">검색</button>
          {loading && <span className="self-center text-sm text-gray-500 dark:text-gray-300">검색 중...</span>}
          {error && <span className="self-center text-sm text-red-500">{String(error)}</span>}
        </div>
      </form>

      <div className="mt-8 grid grid-cols-12 gap-4">
        {results.map((r, idx) => (
          <div key={idx} className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-5 hover:-translate-y-1 transition">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{r.trainType} #{r.trainNo}</div>
            <div className="text-sm text-gray-700 dark:text-gray-200">{r.departureStation} → {r.arrivalStation}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{r.departureTime} ~ {r.arrivalTime} ({r.duration})</div>
            <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">성인 운임: {r.adultFare?.toLocaleString?.() || r.adultFare}원</div>
            <button onClick={() => openKorail(r)} className="mt-4 h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600">코레일에서 예약</button>
          </div>
        ))}
      </div>
    </div>
  )
}

