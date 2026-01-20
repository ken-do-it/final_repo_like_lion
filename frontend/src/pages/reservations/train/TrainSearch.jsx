import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 기차 검색 페이지
 * 출발역, 도착역, 날짜, 열차종류를 선택하여 기차편을 검색합니다
 *
 * 사용 예시:
 * <Route path="/trains" element={<TrainSearch />} />
 */
const TrainSearch = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  /**
   * 폼 데이터 상태
   * depPlaceId - 출발역 ID
   * arrPlaceId - 도착역 ID
   * depDate - 출발 날짜 (YYYY-MM-DD)
   * trainGradeCode - 열차종류 코드 (선택사항)
   */
  const [formData, setFormData] = useState({
    depPlaceId: '',
    arrPlaceId: '',
    depDate: '',
    trainGradeCode: '',
  });

  /**
   * 검색 로딩 상태
   */
  const [searchLoading, setSearchLoading] = useState(false);

  /**
   * 주요 기차역 목록
   * nodeId - TAGO API의 역 ID
   * nodeName - 역 이름
   * region - 지역 (그룹핑용)
   */
  const stations = [
    { nodeId: 'NAT010000', nodeName: '서울', region: t('region_capital') },
    { nodeId: 'NAT010032', nodeName: '용산', region: t('region_capital') },
    { nodeId: 'NAT010107', nodeName: '영등포', region: t('region_capital') },
    { nodeId: 'NAT010415', nodeName: '수원', region: t('region_capital') },
    { nodeId: 'NAT010856', nodeName: '천안아산', region: t('region_chungcheong') },
    { nodeId: 'NAT011668', nodeName: '대전', region: t('region_chungcheong') },
    { nodeId: 'NAT013417', nodeName: '동대구', region: t('region_gyeongsang') },
    { nodeId: 'NAT013726', nodeName: '신경주', region: t('region_gyeongsang') },
    { nodeId: 'NAT013854', nodeName: '울산(통도사)', region: t('region_gyeongsang') },
    { nodeId: 'NAT014445', nodeName: '부산', region: t('region_gyeongsang') },
    { nodeId: 'NAT040407', nodeName: '광주송정', region: t('region_jeolla') },
    { nodeId: 'NAT030951', nodeName: '전주', region: t('region_jeolla') },
    { nodeId: 'NAT040883', nodeName: '목포', region: t('region_jeolla') },
    { nodeId: 'NAT041147', nodeName: '여수엑스포', region: t('region_jeolla') },
    { nodeId: 'NAT020393', nodeName: '강릉', region: t('region_gangwon') },
  ];

  /**
   * 열차종류 목록
   * code - TAGO API의 열차종류 코드
   * name - 열차종류 이름
   */
  const trainTypes = [
    { code: '', name: t('train_type_all') },
    { code: '00', name: 'KTX' },
    { code: '16', name: 'SRT' },
    { code: '08', name: 'ITX-새마을' },
    { code: '09', name: 'ITX-청춘' },
    { code: '01', name: '새마을호' },
    { code: '02', name: '무궁화호' },
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
      depPlaceId: prev.arrPlaceId,
      arrPlaceId: prev.depPlaceId,
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
    if (!formData.depPlaceId || !formData.arrPlaceId || !formData.depDate) {
      alert(t('alert_fill_all_train_search'));
      return;
    }

    /**
     * 출발역과 도착역이 같은지 확인
     */
    if (formData.depPlaceId === formData.arrPlaceId) {
      alert(t('alert_same_station'));
      return;
    }

    /**
     * 과거 날짜 선택 확인
     */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.depDate);
    if (selectedDate < today) {
      alert(t('alert_past_date'));
      return;
    }

    /**
     * 검색 결과 페이지로 이동
     * location.state로 검색 조건과 역 이름 전달
     */
    const depStation = stations.find(s => s.nodeId === formData.depPlaceId);
    const arrStation = stations.find(s => s.nodeId === formData.arrPlaceId);

    navigate('/reservations/trains/results', {
      state: {
        searchParams: formData,
        depStationName: depStation?.nodeName || '',
        arrStationName: arrStation?.nodeName || '',
      }
    });
  };

  /**
   * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
   */
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
            <SearchCard title={t('title_train_search')}>
              <form onSubmit={handleSearch} className="space-y-6">
                {/* 출발역 / 도착역 */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* 출발역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('label_dep_station')}
                    </label>
                    <select
                      name="depPlaceId"
                      value={formData.depPlaceId}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">{t('placeholder_select_dep_station')}</option>
                      {stations.map((station) => (
                        <option key={station.nodeId} value={station.nodeId}>
                          {station.nodeName}
                        </option>
                      ))}
                    </select>
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
                    <select
                      name="arrPlaceId"
                      value={formData.arrPlaceId}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">{t('placeholder_select_arr_station')}</option>
                      {stations.map((station) => (
                        <option key={station.nodeId} value={station.nodeId}>
                          {station.nodeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 날짜 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('label_date')}
                  </label>
                  <input
                    type="date"
                    name="depDate"
                    value={formData.depDate}
                    onChange={handleChange}
                    min={getTodayString()}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* 열차종류 선택 (선택사항) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('label_train_type')}
                  </label>
                  <select
                    name="trainGradeCode"
                    value={formData.trainGradeCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {trainTypes.map((type) => (
                      <option key={type.code} value={type.code}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('desc_train_type_all')}
                  </p>
                </div>

                {/* 검색 버튼 */}
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? t('btn_searching_train') : t('btn_search_train')}
                </button>
              </form>
            </SearchCard>

            {/* 안내 사항 */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                {t('title_train_guide')}
              </h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                <li className="text-amber-700 dark:text-amber-400 font-medium">{t('info_train_1')}</li>
                <li className="text-amber-700 dark:text-amber-400 font-medium">{t('info_train_2')}</li>
                <li>{t('info_train_3')}</li>
                <li>{t('info_train_4')}</li>
                <li>{t('info_train_5')}</li>
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

export default TrainSearch;
