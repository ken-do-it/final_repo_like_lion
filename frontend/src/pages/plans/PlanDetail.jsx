// src/pages/plans/PlanDetail.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // 본인 일정인지 확인
  const isOwner = isAuthenticated && plan && user && plan.user === user.id;

  // Kakao Map refs - 각 장소별 지도 컨테이너
  const mapRefs = useRef({});
  const mapsInitialized = useRef({});

  useEffect(() => {
    fetchPlanDetail();
  }, [planId]);

  const fetchPlanDetail = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlanById(planId);
      setPlan(response.data);
      // Set first date as default selected date
      if (response.data.details && response.data.details.length > 0) {
        setSelectedDate(response.data.details[0].date);
      }
      // Reset map initialization status when plan changes
      mapsInitialized.current = {};
    } catch (err) {
      // 403 에러 (비공개 일정) 처리
      if (err.response?.status === 403) {
        setError(err.response?.data?.error || '공개되지 않은 일정입니다.');
      } else if (err.response?.status === 404) {
        setError('일정을 찾을 수 없습니다.');
      } else {
        setError('여행 계획을 불러오는데 실패했습니다.');
      }
      console.error('Error fetching plan:', err);
    } finally {
      setLoading(false);
    }
  };

  // 단일 지도 초기화 함수
  const initializeMap = useCallback((detailId, latitude, longitude, placeName) => {
    if (!mapRefs.current[detailId]) return;
    if (mapsInitialized.current[detailId]) return;
    if (!window.kakao || !window.kakao.maps) return;

    window.kakao.maps.load(() => {
      const container = mapRefs.current[detailId];
      if (!container) return;

      const options = {
        center: new window.kakao.maps.LatLng(latitude, longitude),
        level: 3
      };

      const map = new window.kakao.maps.Map(container, options);

      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(latitude, longitude)
      });
      marker.setMap(map);

      mapsInitialized.current[detailId] = true;
    });
  }, []);

  // Kakao Map SDK 로드 및 지도 초기화
  useEffect(() => {
    if (!plan || !plan.details || plan.details.length === 0) return;

    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!kakaoKey) {
      console.warn("Kakao JS Key is missing in .env");
      return;
    }

    // 현재 선택된 날짜의 장소들만 초기화
    const currentDetails = plan.details.filter(d => d.date === selectedDate);
    const placesWithCoords = currentDetails.filter(d => d.place_latitude && d.place_longitude);

    if (placesWithCoords.length === 0) return;

    const initAllMaps = () => {
      // DOM이 렌더링된 후 지도 초기화를 위해 약간의 지연 추가
      setTimeout(() => {
        placesWithCoords.forEach(detail => {
          initializeMap(detail.id, detail.place_latitude, detail.place_longitude, detail.place_name);
        });
      }, 100);
    };

    if (window.kakao && window.kakao.maps) {
      // SDK가 이미 로드된 경우
      initAllMaps();
    } else {
      // SDK 동적 로드
      const scriptId = 'kakao-map-sdk';
      let script = document.getElementById(scriptId);

      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`;
        script.async = true;
        document.head.appendChild(script);
      }

      const handleLoad = () => {
        initAllMaps();
      };

      script.addEventListener('load', handleLoad);

      return () => {
        script.removeEventListener('load', handleLoad);
      };
    }
  }, [plan, selectedDate, initializeMap]);

  const handleDeletePlace = async (detailId) => {
    if (!window.confirm('이 장소를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await plansService.details.deleteDetail(detailId);
      // Refresh plan details
      fetchPlanDetail();
    } catch (err) {
      alert('장소를 삭제하는데 실패했습니다.');
      console.error('Error deleting place:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || '계획을 찾을 수 없습니다.'}</div>
          <button
            onClick={() => navigate('/plans')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] transition-all"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // Group details by date
  const detailsByDate = (plan.details || []).reduce((acc, detail) => {
    if (!acc[detail.date]) {
      acc[detail.date] = [];
    }
    acc[detail.date].push(detail);
    return acc;
  }, {});

  // Sort places by order
  Object.keys(detailsByDate).forEach(date => {
    detailsByDate[date].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  });

  const dates = Object.keys(detailsByDate).sort();
  const currentDateDetails = selectedDate ? detailsByDate[selectedDate] || [] : [];

  return (
    <div className="container mx-auto px-4 max-w-screen-xl py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate('/plans')}
            className="text-gray-600 dark:text-gray-400 hover:text-[#1392ec] dark:hover:text-[#1392ec]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {plan.title}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                plan.plan_type === 'ai_recommended'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              }`}>
                {plan.plan_type === 'ai_recommended' ? 'AI 추천' : '직접 작성'}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {new Date(plan.start_date).toLocaleDateString('ko-KR')} ~ {new Date(plan.end_date).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>

        {plan.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {plan.description}
          </p>
        )}

        {isOwner && (
          <div className="flex gap-4">
            <button
              onClick={() => navigate(`/plans/${planId}/edit`)}
              className="h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              계획 수정
            </button>
            <button
              onClick={() => navigate(`/plans/${planId}/add-place`)}
              className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
            >
              장소 추가
            </button>
          </div>
        )}
      </div>

      {/* Date Tabs */}
      {dates.length > 0 && (
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
            {dates.map((date, index) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-6 py-3 rounded-t-lg font-semibold whitespace-nowrap transition-all ${
                  selectedDate === date
                    ? 'bg-[#1392ec] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Day {index + 1} ({new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Places List */}
      {currentDateDetails.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm">
          <div className="text-gray-400 dark:text-gray-600 mb-6">
            <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {dates.length === 0 ? '아직 추가된 장소가 없습니다' : '이 날짜에 추가된 장소가 없습니다'}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => navigate(`/plans/${planId}/add-place`)}
              className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
            >
              장소 추가하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentDateDetails.map((detail, index) => {
            // Generate Kakao Map URL using coordinates
            const kakaoMapUrl = detail.place_latitude && detail.place_longitude
              ? `https://map.kakao.com/link/map/${encodeURIComponent(detail.place_name || '장소')},${detail.place_latitude},${detail.place_longitude}`
              : null;

            return (
              <div
                key={detail.id}
                className="bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-stretch gap-6">
                    {/* 왼쪽: 장소 정보 영역 */}
                    <div className="flex-1 flex flex-col">
                      <div
                        className="flex items-start gap-4 flex-1 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          if (kakaoMapUrl) {
                            window.open(kakaoMapUrl, '_blank');
                          }
                        }}
                      >
                        {/* Order Number */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1392ec] text-white flex items-center justify-center font-bold">
                          {index + 1}
                        </div>

                        {/* Place Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                              {detail.place_name || '장소 이름 없음'}
                            </h3>
                            {kakaoMapUrl && (
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            )}
                          </div>

                          {detail.place_address && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-start">
                              <svg className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {detail.place_address}
                            </p>
                          )}

                          {detail.description && (
                            <p className="text-gray-700 dark:text-gray-300 mb-3">
                              {detail.description}
                            </p>
                          )}

                          {/* Images */}
                          {detail.images && detail.images.length > 0 && (
                            <div className="mt-4 flex gap-2 overflow-x-auto">
                              {detail.images.map((image) => (
                                <img
                                  key={image.id}
                                  src={image.image}
                                  alt={`장소 이미지 ${image.order_index}`}
                                  className="w-32 h-32 object-cover rounded-lg"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions - 왼쪽 하단 (본인 일정일 때만 표시) */}
                      {isOwner && (
                        <div className="flex gap-2 mt-4 ml-14">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/plans/details/${detail.id}/edit`);
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="수정"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlace(detail.id);
                            }}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 지도 */}
                    {detail.place_latitude && detail.place_longitude && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-80 h-52 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0"
                      >
                        <div
                          ref={(el) => {
                            mapRefs.current[detail.id] = el;
                          }}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlanDetail;
