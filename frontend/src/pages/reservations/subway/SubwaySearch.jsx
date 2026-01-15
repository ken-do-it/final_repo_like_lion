import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 지하철 경로 검색 페이지
 * 출발역과 도착역을 입력하여 최적 경로를 검색합니다
 *
 * 주의사항:
 * - 예약/결제 기능 없음 (정보 제공만)
 * - ODsay API를 통해 경로 정보 제공
 * - 카카오맵 연동으로 상세 경로 확인
 *
 * 사용 예시:
 * <Route path="/subway" element={<SubwaySearch />} />
 */
const SubwaySearch = () => {
  const navigate = useNavigate();

  /**
   * 폼 데이터 상태
   * fromStation - 출발역 이름
   * toStation - 도착역 이름
   * option - 검색 옵션 (FAST/FEW_TRANSFER/CHEAP)
   */
  const [formData, setFormData] = useState({
    fromStation: '',
    toStation: '',
    option: 'FAST',
  });

  /**
   * 검색 옵션 목록
   * FAST - 최단시간
   * FEW_TRANSFER - 최소환승
   * CHEAP - 최소비용
   */
  const searchOptions = [
    { value: 'FAST', label: '최단시간', icon: 'schedule' },
    { value: 'FEW_TRANSFER', label: '최소환승', icon: 'sync_alt' },
    { value: 'CHEAP', label: '최소비용', icon: 'savings' },
  ];

  /**
   * 주요 지하철역 목록 (자동완성용)
   * 서울 지하철 주요역
   */
  const popularStations = [
    '강남', '신논현', '역삼', '선릉', '삼성',
    '서울역', '시청', '종각', '종로3가', '을지로입구',
    '동대문', '동대문역사문화공원', '신당', '상왕십리', '왕십리',
    '건대입구', '구의', '강변', '잠실', '잠실새내',
    '홍대입구', '신촌', '이대', '아현', '충정로',
    '사당', '교대', '서초', '방배', '이수',
    '수원', '인천', '부평', '부천', '안양',
  ];

  /**
   * 입력 필드 변경 핸들러
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * 출발역과 도착역 교환
   */
  const handleSwap = () => {
    setFormData(prev => ({
      ...prev,
      fromStation: prev.toStation,
      toStation: prev.fromStation,
    }));
  };

  /**
   * 검색 옵션 변경 핸들러
   */
  const handleOptionChange = (option) => {
    setFormData(prev => ({
      ...prev,
      option: option
    }));
  };

  /**
   * 검색 폼 제출 핸들러
   */
  const handleSearch = (e) => {
    e.preventDefault();

    /**
     * 필수 필드 검증
     */
    if (!formData.fromStation || !formData.toStation) {
      alert('출발역과 도착역을 모두 입력해주세요.');
      return;
    }

    /**
     * 출발역과 도착역이 같은지 확인
     */
    if (formData.fromStation === formData.toStation) {
      alert('출발역과 도착역이 같을 수 없습니다.');
      return;
    }

    /**
     * 검색 결과 페이지로 이동
     * location.state로 검색 조건 전달
     */
    navigate('/reservations/subway/route', {
      state: {
        searchParams: formData
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          교통
        </h1>

        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* 왼쪽 영역: 검색 폼 */}
          <div className="col-span-8">
            <SearchCard title="지하철 경로 검색">
              <form onSubmit={handleSearch} className="space-y-6">
                {/* 출발역 / 도착역 */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* 출발역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      출발역
                    </label>
                    <input
                      type="text"
                      name="fromStation"
                      value={formData.fromStation}
                      onChange={handleChange}
                      placeholder="출발역 이름 입력"
                      required
                      list="from-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="from-stations">
                      {popularStations.map((station) => (
                        <option key={station} value={station} />
                      ))}
                    </datalist>
                  </div>

                  {/* 교환 버튼 */}
                  <div className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSwap}
                      className="p-3 bg-slate-100 dark:bg-gray-800 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                      title="출발역과 도착역 교환"
                    >
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </button>
                  </div>

                  {/* 도착역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      도착역
                    </label>
                    <input
                      type="text"
                      name="toStation"
                      value={formData.toStation}
                      onChange={handleChange}
                      placeholder="도착역 이름 입력"
                      required
                      list="to-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="to-stations">
                      {popularStations.map((station) => (
                        <option key={station} value={station} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 검색 옵션 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    검색 옵션
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {searchOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOptionChange(option.value)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.option === option.value
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className={`material-symbols-outlined block text-3xl mb-2 ${
                          formData.option === option.value
                            ? 'text-primary'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {option.icon}
                        </span>
                        <span className={`text-sm font-medium ${
                          formData.option === option.value
                            ? 'text-primary'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 검색 버튼 */}
                <button
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  경로 검색
                </button>
              </form>
            </SearchCard>

            {/* 안내 사항 */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                지하철 경로 검색 안내
              </h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                <li>서울, 부산, 대구, 광주, 대전 지하철 경로를 검색할 수 있습니다</li>
                <li>최대 3개의 최적 경로를 제공합니다</li>
                <li>소요시간, 환승 횟수, 요금 정보를 확인하세요</li>
                <li>카카오맵으로 상세한 경로를 확인할 수 있습니다</li>
                <li>실시간 도착 정보는 역 안내판을 참고해주세요</li>
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

export default SubwaySearch;
