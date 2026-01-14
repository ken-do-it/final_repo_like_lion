import { useState } from 'react'
import axios from '../../api/axios'

const CITY_OPTIONS = ['SEOUL', 'BUSAN', 'DAEGU', 'GWANGJU', 'DAEJEON']
const ROUTE_OPTIONS = [
  { value: 'FAST', label: '최단시간' },
  { value: 'FEW_TRANSFER', label: '최소환승' },
  { value: 'CHEAP', label: '최저요금' },
]

export default function SubwayMetaPage() {
  const [form, setForm] = useState({
    fromStation: '강남',
    toStation: '홍대입구',
    option: 'FAST',
    includeStops: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [routes, setRoutes] = useState([])

  const [city, setCity] = useState('SEOUL')
  const [mapMeta, setMapMeta] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState(null)

  const onChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const fetchRoutes = async (e) => {
    e?.preventDefault?.()
    setLoading(true)
    setError(null)
    setRoutes([])
    try {
      const params = new URLSearchParams({
        fromStation: form.fromStation,
        toStation: form.toStation,
        option: form.option,
      })
      if (form.includeStops) params.set('include', 'stops')
      const { data } = await axios.get(`/v1/transport/subway/route/?${params.toString()}`)
      setRoutes(Array.isArray(data?.routes) ? data.routes : [])
    } catch (err) {
      const svc = err?.response?.data
      const msg = svc?.error?.message || svc?.error || '경로 조회 중 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchMapMeta = async () => {
    setMapLoading(true)
    setMapError(null)
    setMapMeta(null)
    try {
      const { data } = await axios.get(`/v1/transport/subway/map-meta/`, { params: { city } })
      setMapMeta(data)
    } catch (err) {
      const svc = err?.response?.data
      const msg = svc?.error?.message || svc?.error || '노선도 정보 조회 실패'
      setMapError(msg)
    } finally {
      setMapLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">지하철 경로/노선도</h1>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Route Search */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">경로 검색</div>
          <form onSubmit={fetchRoutes} className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">출발역</label>
              <input name="fromStation" value={form.fromStation} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div className="col-span-4">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">도착역</label>
              <input name="toStation" value={form.toStation} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div className="col-span-3">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">옵션</label>
              <select name="option" value={form.option} onChange={onChange} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
                {ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-12 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" name="includeStops" checked={form.includeStops} onChange={onChange} />
                정거장 좌표(stops) 포함
              </label>
              <button type="submit" className="h-12 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600">경로 조회</button>
              {loading && <span className="text-sm text-gray-500 dark:text-gray-300">조회 중...</span>}
              {error && <span className="text-sm text-red-500">{String(error)}</span>}
            </div>
          </form>

          {/* Routes result */}
          <div className="mt-6 space-y-4">
            {routes.map((r, idx) => (
              <div key={idx} className="border rounded-xl dark:border-gray-700 p-4">
                <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
                  <span>소요: {r.duration}분</span>
                  <span>환승: {r.transfers}회</span>
                  <span>요금: 카드 {r.fare?.card?.toLocaleString?.()}원 / 현금 {r.fare?.cash?.toLocaleString?.()}원</span>
                </div>
                <div className="mt-3 space-y-2">
                  {r.steps?.map((s, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-[#243140] rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <div className="text-gray-800 dark:text-gray-100">{s.line} ({s.from} → {s.to})</div>
                        <div className="text-gray-600 dark:text-gray-300">{s.stations}정거장 · {s.duration}분</div>
                      </div>
                      {Array.isArray(s.stops) && s.stops.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">정거장 수: {s.stops.length}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Map Meta */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm p-6">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">노선도 메타</div>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8">
                <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-12 border rounded-lg px-3 dark:bg-[#1e2b36] dark:border-gray-700 dark:text-gray-100">
                  {CITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <button onClick={fetchMapMeta} className="w-full h-12 rounded-lg bg-blue-500 text-white hover:bg-blue-600">조회</button>
              </div>
            </div>
            {mapLoading && <div className="mt-3 text-sm text-gray-500 dark:text-gray-300">조회 중...</div>}
            {mapError && <div className="mt-3 text-sm text-red-500">{String(mapError)}</div>}
            {mapMeta && (
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-200">
                <div>버전: {mapMeta.version}</div>
                <a className="text-blue-600 hover:underline" href={mapMeta.mapUrl} target="_blank" rel="noreferrer">노선도 페이지로 이동</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

