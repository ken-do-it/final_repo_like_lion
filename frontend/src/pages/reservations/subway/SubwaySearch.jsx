import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
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
  const { t, language } = useLanguage();

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
   * 검색 로딩 상태
   */
  const [searchLoading, setSearchLoading] = useState(false);

  /**
   * 검색 옵션 목록
   * FAST - 최단시간
   * FEW_TRANSFER - 최소환승
   * CHEAP - 최소비용
   */
  const searchOptions = [
    { value: 'FAST', label: t('option_fast'), icon: 'schedule' },
    { value: 'FEW_TRANSFER', label: t('option_few_transfer'), icon: 'sync_alt' },
    { value: 'CHEAP', label: t('option_cheap'), icon: 'savings' },
  ];

  /**
   * 주요 지하철역 목록 (자동완성용)
   * 서울 지하철 주요역 + 다국어 지원
   */
  const popularStations = [
    { nameKo: '강남', nameEn: 'Gangnam', nameJa: '江南', nameZh: '江南' },
    { nameKo: '신논현', nameEn: 'Sinnonhyeon', nameJa: '新論嶽', nameZh: '新论峙' },
    { nameKo: '역삼', nameEn: 'Yeoksam', nameJa: '役三', nameZh: '役三' },
    { nameKo: '선릉', nameEn: 'Seolleung', nameJa: '宣陵', nameZh: '宣陵' },
    { nameKo: '삼성', nameEn: 'Samsung', nameJa: '三成', nameZh: '三成' },
    { nameKo: '서울역', nameEn: 'Seoul Station', nameJa: 'ソウル駅', nameZh: '首尔站' },
    { nameKo: '시청', nameEn: 'City Hall', nameJa: '市庁', nameZh: '市厅' },
    { nameKo: '종각', nameEn: 'Jonggak', nameJa: '鐘閣', nameZh: '钟阁' },
    { nameKo: '종로3가', nameEn: 'Jongno 3-ga', nameJa: '鐘路3街', nameZh: '钟路3街' },
    { nameKo: '을지로입구', nameEn: 'Euljiro 1-ga', nameJa: '乙支路入口', nameZh: '乙支路入口' },
    { nameKo: '동대문', nameEn: 'Dongdaemun', nameJa: '東大門', nameZh: '东大门' },
    { nameKo: '동대문역사문화공원', nameEn: 'DDP', nameJa: '東大門歴史文化公園', nameZh: '东大门历史文化公园' },
    { nameKo: '신당', nameEn: 'Sindang', nameJa: '新堂', nameZh: '新堂' },
    { nameKo: '상왕십리', nameEn: 'Sangwangsimni', nameJa: '往十里', nameZh: '往十里' },
    { nameKo: '왕십리', nameEn: 'Wangsimni', nameJa: '往十里', nameZh: '往十里' },
    { nameKo: '건대입구', nameEn: 'Konkuk Univ.', nameJa: '建大入口', nameZh: '建大入口' },
    { nameKo: '구의', nameEn: 'Guui', nameJa: '九义', nameZh: '九义' },
    { nameKo: '강변', nameEn: 'Gangbyeon', nameJa: '江辺', nameZh: '江边' },
    { nameKo: '잠실', nameEn: 'Jamsil', nameJa: '蚕室', nameZh: '蚕室' },
    { nameKo: '잠실새내', nameEn: 'Jamsil Saenae', nameJa: '蚕室セネ', nameZh: '蚕室新内' },
    { nameKo: '홍대입구', nameEn: 'Hongik Univ.', nameJa: '弘大入口', nameZh: '弘大入口' },
    { nameKo: '신촌', nameEn: 'Sinchon', nameJa: '新村', nameZh: '新村' },
    { nameKo: '이대', nameEn: 'Ewha Womans Univ.', nameJa: '梨大', nameZh: '梨大' },
    { nameKo: '아현', nameEn: 'Ahyeon', nameJa: '阿現', nameZh: '阿现' },
    { nameKo: '충정로', nameEn: 'Chungjeongno', nameJa: '忠正路', nameZh: '忠正路' },
    { nameKo: '사당', nameEn: 'Sadang', nameJa: '舎堂', nameZh: '舍堂' },
    { nameKo: '교대', nameEn: 'Gyodae', nameJa: '教大', nameZh: '教大' },
    { nameKo: '서초', nameEn: 'Seocho', nameJa: '瑞草', nameZh: '瑞草' },
    { nameKo: '방배', nameEn: 'Bangbae', nameJa: '方背', nameZh: '方背' },
    { nameKo: '이수', nameEn: 'Isu', nameJa: '二水', nameZh: '二水' },
    { nameKo: '수원', nameEn: 'Suwon', nameJa: '水原', nameZh: '水原' },
    { nameKo: '인천', nameEn: 'Incheon', nameJa: '仁川', nameZh: '仁川' },
    { nameKo: '부평', nameEn: 'Bupyeong', nameJa: '富平', nameZh: '富平' },
    { nameKo: '부천', nameEn: 'Bucheon', nameJa: '富川', nameZh: '富川' },
    { nameKo: '안양', nameEn: 'Anyang', nameJa: '安養', nameZh: '安养' },
  ];

  /**
   * 언어에 따라 역 이름 선택
   */
  const getStationName = (station) => {
    switch (language) {
      case 'English':
        return station.nameEn || station.nameKo;
      case '日本語':
        return station.nameJa || station.nameKo;
      case '中文':
        return station.nameZh || station.nameKo;
      case '한국어':
        return station.nameKo;
      default:
        return station.nameKo;
    }
  };

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
      alert(t('alert_fill_all_subway_search'));
      return;
    }

    /**
     * 출발역과 도착역이 같은지 확인
     */
    if (formData.fromStation === formData.toStation) {
      alert(t('alert_same_station'));
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
          {t('title_transport')}
        </h1>

        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* 왼쪽 영역: 검색 폼 */}
          <div className="lg:col-span-8">
            <SearchCard title={t('title_subway_search')}>
              <form onSubmit={handleSearch} className="space-y-6">
                {/* 출발역 / 도착역 */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* 출발역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('label_dep_station')}
                    </label>
                    <input
                      type="text"
                      name="fromStation"
                      value={formData.fromStation}
                      onChange={handleChange}
                      placeholder={t('placeholder_input_dep_station')}
                      required
                      list="from-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="from-stations">
                      {popularStations.map((station) => (
                        <option key={station.nameKo} value={getStationName(station)} />
                      ))}
                    </datalist>
                  </div>

                  {/* 교환 버튼 */}
                  <div className="col-span-2 flex justify-center items-center">
                    <button
                      type="button"
                      onClick={handleSwap}
                      className="w-10 h-10 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark hover:rotate-180 transition-all duration-300 flex items-center justify-center"
                      title="출발역과 도착역 교환"
                    >
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </button>
                  </div>

                  {/* 도착역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('label_arr_station')}
                    </label>
                    <input
                      type="text"
                      name="toStation"
                      value={formData.toStation}
                      onChange={handleChange}
                      placeholder={t('placeholder_input_arr_station')}
                      required
                      list="to-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="to-stations">
                      {popularStations.map((station) => (
                        <option key={station.nameKo} value={getStationName(station)} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 검색 옵션 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('label_search_option')}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {searchOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOptionChange(option.value)}
                        className={`p-4 rounded-lg border-2 transition-all ${formData.option === option.value
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                      >
                        <span className={`material-symbols-outlined block text-3xl mb-2 ${formData.option === option.value
                          ? 'text-primary'
                          : 'text-gray-400 dark:text-gray-500'
                          }`}>
                          {option.icon}
                        </span>
                        <span className={`text-sm font-medium ${formData.option === option.value
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
                  disabled={searchLoading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? t('btn_searching_train') : t('btn_search_route')}
                </button>
              </form>
            </SearchCard>

            {/* 안내 사항 */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                {t('title_subway_guide')}
              </h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                <li>{t('info_subway_1')}</li>
                <li>{t('info_subway_2')}</li>
                <li>{t('info_subway_3')}</li>
                <li>{t('info_subway_4')}</li>
                <li>{t('info_subway_5')}</li>
              </ul>
            </div>
          </div>

          {/* 오른쪽 영역: 사이드바 */}
          <div className="lg:col-span-4">
            <ReservationSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubwaySearch;
