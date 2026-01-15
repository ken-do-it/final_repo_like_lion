import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, StreetViewPanorama, Marker, Polyline } from '@react-google-maps/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { placesAxios as api } from '../api/axios'; // [수정] API 호출을 위해 추가

const libraries = ['places', 'geometry'];

const streetViewOptions = {
  disableDefaultUI: true,
  zoom: 1,
  pov: { heading: 0, pitch: 0 },
  visible: true,
  showRoadLabels: false,
  addressControl: false,
  linksControl: true,
  panControl: true,
  enableCloseButton: false,
};

const mapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: false,
};

const defaultCenter = {
  lat: 36.3504119,
  lng: 127.3845475
};

const RoadviewGame = () => {
  const locationState = useLocation().state;
  const navigate = useNavigate();

  // 1. 상태 및 변수 선언 (가장 상단)
  const [targetData, setTargetData] = useState({
    lat: locationState?.lat,
    lng: locationState?.lng,
    imageUrl: locationState?.imageUrl,
    totalPhotos: locationState?.totalPhotos || 1
  });
  const [isDataLoading, setIsDataLoading] = useState(!locationState?.lat);

  // [추가] 실제 로드뷰가 존재하는 지점을 저장할 상태
  const [panoLocation, setPanoLocation] = useState(null);
  const [noPano, setNoPano] = useState(false); // 로드뷰 없음 상태

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(180);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
    libraries: libraries
  });

  // [추가/수정] 데이터 가져오기 로직
  useEffect(() => {
    const fetchRandomGame = async () => {
      // 이미 데이터가 있다면(state로 넘어왔다면) 바로 종료
      if (targetData.lat && targetData.lng) {
        setIsDataLoading(false);
        return;
      }
      try {
        setIsDataLoading(true);
        const response = await api.get('/roadview/random');
        const data = response.data;
        // 백엔드 필드명(latitude/longitude)에 맞춰 업데이트
        setTargetData({
          lat: data.latitude || data.lat,
          lng: data.longitude || data.lng,
          imageUrl: data.image_url,
          totalPhotos: 1
        });
      } catch (err) {
        console.error("게임 데이터를 불러오지 못했습니다:", err);
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchRandomGame();
  }, [locationState]);

  // 2. 좌표 변수 추출 (Hook보다 위에 있어야 에러가 안 납니다)
  const lat = useMemo(() => parseFloat(targetData.lat), [targetData.lat]);
  const lng = useMemo(() => parseFloat(targetData.lng), [targetData.lng]);
  const answerLocation = useMemo(() => ({ lat, lng }), [lat, lng]);

  // [수정] totalPhotos, imageUrl 등도 targetData에서 추출
  const { imageUrl, totalPhotos } = targetData;

  // 3. [핵심 추가] 카카오 좌표 -> 구글 로드뷰 도로 좌표 보정 로직
  // 3. [핵심 추가] 카카오 좌표 -> 구글 로드뷰 도로 좌표 보정 로직
  useEffect(() => {
    if (isLoaded && lat && lng) {
      const service = new window.google.maps.StreetViewService();

      // 입력된 좌표 주변 200m (범위 확대) 이내의 가장 가까운 '도로' 지점을 검색
      service.getPanorama({
        location: { lat, lng },
        radius: 200,
        // source: window.google.maps.StreetViewSource.OUTDOOR // 제한 해제
      }, (data, status) => {
        if (status === "OK") {
          // 구글이 찾은 실제 도로 위 좌표로 업데이트 (객체 변환)
          setPanoLocation({
            lat: data.location.latLng.lat(),
            lng: data.location.latLng.lng()
          });
          setNoPano(false);
        } else {
          console.warn("주변 200m 이내에 로드뷰가 없습니다.");
          setPanoLocation(null);
          setNoPano(true);
        }
      });
    }
  }, [isLoaded, lat, lng]);

  // Timer Effect
  useEffect(() => {
    if (showResult || isDataLoading) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showResult, isDataLoading]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const onMapClick = useCallback((e) => {
    if (showResult) return;
    setGuess({
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    });
  }, [showResult]);

  const handleSubmit = () => {
    if (!guess || !lat || !lng) return;

    // [수정] 정답 좌표 설정: panoLocation(로드뷰 스냅 위치)이 있으면 그걸 사용, 없으면 원본 lat/lng
    // 이렇게 해야 사용자가 로드뷰에서 본 정확한 위치를 찍었을 때 정답으로 인정됨
    const correctLat = panoLocation?.lat ? ((typeof panoLocation.lat === 'function') ? panoLocation.lat() : panoLocation.lat) : lat;
    const correctLng = panoLocation?.lng ? ((typeof panoLocation.lng === 'function') ? panoLocation.lng() : panoLocation.lng) : lng;

    const R = 6371;
    const dLat = (guess.lat - correctLat) * (Math.PI / 180);
    const dLng = (guess.lng - correctLng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(correctLat * (Math.PI / 180)) * Math.cos(guess.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    let score = 0;
    // [수정] 점수 로직 강화: 2000 -> 50 으로 감쇠 계수 대폭 축소 (거리가 멀어질수록 점수가 급격히 떨어짐)
    // 50m 이내: 5000점 만점
    // 예: 1km 차이 -> 5000 * exp(-1/50) ≈ 4900점 (여전히 후함) -> 더 줄여야 함?
    // User request: "거리에 따른 점수 차이를 더 키워야 할 것 같다"
    // Let's try constant 10.
    // 1km error -> 5000 * exp(-1/10) = 4524 pts
    // 10km error -> 5000 * exp(-10/10) = 1839 pts
    // 20km error -> 5000 * exp(-20/10) = 676 pts
    // This seems reasonable for a city/province scale game.
    if (distanceKm < 0.05) score = 5000;
    else score = Math.floor(5000 * Math.exp(-distanceKm / 10));

    setResult({
      distance: distanceKm,
      score: score
    });
    setShowResult(true);
  };

  const handleNext = () => {
    // 다음 라운드를 위해 페이지 새로고침(또는 state 초기화)
    window.location.reload();
  };

  // [추가] 로딩 중 화면
  if (isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-[#101a22]">
        <div className="text-[#1392ec] font-bold animate-pulse text-xl">새로운 장소를 찾는 중입니다...</div>
      </div>
    );
  }

  if (!lat || !lng) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f8] dark:bg-[#101a22]">
        <h2 className="text-2xl font-bold dark:text-white">장소 정보를 불러올 수 없습니다.</h2>
        <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-[#1392ec] text-white rounded-lg">홈으로 가기</button>
      </div>
    );
  }

  if (!isLoaded || loadError) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-[#101a22] text-white">Loading...</div>;
  }

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] text-[#0d161b] dark:text-white font-sans min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 h-[calc(100vh-64px)]">
        <div className="relative flex-1 group w-full h-[50vh] lg:h-auto rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none">
            <span className="text-[18px]">📷</span>
            <span className="text-xs font-bold">Street View</span>
          </div>

          {noPano && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
              <span className="text-4xl mb-2">🚫</span>
              <p className="font-bold text-lg">로드뷰를 찾을 수 없습니다</p>
              <p className="text-sm text-slate-400">주변 도로 데이터가 없거나 실내 장소일 수 있습니다.</p>
            </div>
          )}

          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={answerLocation}
            zoom={14}
            options={{ disableDefaultUI: true, gestureHandling: 'none' }}
          >
            {/* 보정된 좌표(panoLocation)가 있을 때만 로드뷰를 띄웁니다 */}
            {!noPano && panoLocation && (
              <StreetViewPanorama
                position={panoLocation}
                visible={true}
                options={streetViewOptions}
              />
            )}
          </GoogleMap>
        </div>

        <aside className="w-full lg:w-[400px] xl:w-[440px] flex flex-col gap-4 lg:h-full overflow-y-auto scrollbar-hide">
          {imageUrl && (
            <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Photo</h3>
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={imageUrl} alt="Target" className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><span>🚩</span></div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Round</span>
                <span className="text-lg font-bold">{round} <span className="text-slate-400 text-sm">/ {totalPhotos}</span></span>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-700"></div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg"><span>⏱️</span></div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Time</span>
                <span className={`text-lg font-bold font-mono ${timeLeft < 30 ? 'text-red-500 animate-pulse' : ''}`}>{formattedTime}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col flex-1 gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-[#0d161b] dark:text-white">Where was this taken?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Find the location in the photo on the map!</p>
            </div>
            <div className="relative w-full aspect-square lg:aspect-auto lg:flex-1 min-h-[400px] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
                center={defaultCenter}
                zoom={6}
                onClick={onMapClick}
                options={mapOptions}
              >
                {guess && <Marker position={guess} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />}
                {showResult && (
                  <>
                    <Marker
                      position={panoLocation ? panoLocation : answerLocation}
                      icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    />
                    <Polyline
                      path={[guess, panoLocation ? panoLocation : answerLocation]}
                      options={{ strokeColor: "#FF0000", strokeOpacity: 0.8, strokeWeight: 4, geodesic: true }}
                    />
                  </>
                )}
              </GoogleMap>
              {!showResult && guess && <div className="absolute top-[10px] left-1/2 -translate-x-1/2 bg-[#1392ec] text-white text-xs font-bold px-3 py-1 rounded shadow animate-bounce">Pin Placed!</div>}
            </div>
            <div className="flex flex-col gap-3 pt-2">
              {!showResult ? (
                <button onClick={handleSubmit} disabled={!guess} className={`w-full h-12 flex items-center justify-center gap-2 text-white rounded-xl font-bold text-base shadow-lg transition-all ${guess ? 'bg-[#1392ec] hover:bg-blue-600 active:scale-[0.98]' : 'bg-gray-300 cursor-not-allowed'}`}>
                  <span>✅</span>Confirm Guess
                </button>
              ) : (
                <button onClick={handleNext} className="w-full h-12 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-base shadow-lg transition-all">
                  <span>➡️</span>Next Round
                </button>
              )}
            </div>
          </div>
          {showResult && result && (
            <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 animate-fade-in-up">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Round Result</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Distance</p>
                  <p className="text-2xl font-mono text-[#1392ec]">{result.distance < 1 ? `${(result.distance * 1000).toFixed(0)}m` : `${result.distance.toFixed(2)}km`}</p>
                </div>
                <div className="w-[1px] h-10 bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Score</p>
                  <div className="flex items-end justify-end gap-1"><span className="text-2xl font-bold text-[#1392ec]">{result.score}</span><span className="text-xs text-gray-500 pb-1">pts</span></div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default RoadviewGame;