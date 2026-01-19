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
    totalPhotos: 1, // Will be updated to queue length
    placeName: '',
    placeId: null,
    reviewContent: '',
    reviewerNickname: ''
  });
  const [isDataLoading, setIsDataLoading] = useState(!locationState?.lat);

  // Game Session Queue State
  const [gameQueue, setGameQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState([]); // Store results for final page
  const [showSessionSummary, setShowSessionSummary] = useState(false); // Toggle result view

  // [추가] 실제 로드뷰가 존재하는 지점을 저장할 상태
  const [panoLocation, setPanoLocation] = useState(null);
  const [noPano, setNoPano] = useState(false); // 로드뷰 없음 상태
  const [distanceWarning, setDistanceWarning] = useState(null); // [New] Distance warning

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

  // [Modified] Fetch Game Session Function
  const fetchGameSession = useCallback(async () => {
    try {
      setIsDataLoading(true);
      const response = await api.get('/roadview/session', { params: { limit: 10 } });
      const { games } = response.data;

      if (games && games.length > 0) {
        setGameQueue(games);
        setCurrentQueueIndex(0);

        // Init first game
        const firstGame = games[0];
        setTargetData({
          id: firstGame.game_id,
          lat: firstGame.lat,
          lng: firstGame.lng,
          imageUrl: firstGame.image_url,
          totalPhotos: games.length,
          placeName: firstGame.place_name,
          placeId: firstGame.place_id,
          reviewContent: firstGame.review_content,
          reviewerNickname: firstGame.reviewer_nickname
        });
      }
    } catch (err) {
      console.error("Failed to fetch game session:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    // If data passed via state (e.g. from upload), use it
    if (locationState?.lat && locationState?.lng) {
      setIsDataLoading(false);
      return;
    }
    // Otherwise fetch session
    fetchGameSession();
  }, [locationState, fetchGameSession]);


  // 2. Extract Coordinates
  const lat = useMemo(() => parseFloat(targetData.lat), [targetData.lat]);
  const lng = useMemo(() => parseFloat(targetData.lng), [targetData.lng]);
  const answerLocation = useMemo(() => ({ lat, lng }), [lat, lng]);

  const { imageUrl, totalPhotos, id: gameId } = targetData;

  // 3. Coordinate Correction Logic (Progressive Search)
  useEffect(() => {
    // Reset states when round changes
    setPanoLocation(null);
    setNoPano(false);
    setDistanceWarning(null);

    if (isLoaded && lat && lng) {
      const service = new window.google.maps.StreetViewService();

      if (isNaN(lat) || isNaN(lng)) return;

      const radii = [300, 500, 700];

      const findPano = (radiusIndex) => {
        if (radiusIndex >= radii.length) {
          console.warn("No street view found within 700m.");
          setNoPano(true);
          return;
        }

        const currentRadius = radii[radiusIndex];

        service.getPanorama({
          location: { lat, lng },
          radius: currentRadius,
        }, (data, status) => {
          if (status === "OK") {
            setPanoLocation({
              lat: data.location.latLng.lat(),
              lng: data.location.latLng.lng()
            });
            setNoPano(false);

            // Show warning if radius > 300
            if (currentRadius > 300) {
              setDistanceWarning(`근처 로드뷰가 없어 약 ${currentRadius}m 떨어진 위치의 로드뷰입니다.`);
            }
          } else {
            // Try next radius
            findPano(radiusIndex + 1);
          }
        });
      };

      // Start search with 300m
      findPano(0);
    }
  }, [isLoaded, lat, lng, round]);



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
    if (distanceKm < 0.05) score = 5000;
    else score = Math.floor(5000 * Math.exp(-distanceKm / 10));

    const roundResult = {
      distance: distanceKm,
      score: score,
      placeName: targetData.placeName,
      placeId: targetData.placeId,
      imageUrl: targetData.imageUrl,
      reviewContent: targetData.reviewContent,
      reviewerNickname: targetData.reviewerNickname
    };

    setResult(roundResult);
    setShowResult(true);
    setSessionResults(prev => [...prev, roundResult]);

    if (gameId) {
      // Still track history on backend for analytics/duplication if we revive it later
      api.post(`/roadview/complete/${gameId}`).catch(err => console.error(err));
    }
  };

  const handleNext = () => {
    // Check if next game exists in queue
    const nextIndex = currentQueueIndex + 1;

    if (nextIndex < gameQueue.length) {
      // Load next game
      const nextGame = gameQueue[nextIndex];
      setTargetData({
        id: nextGame.game_id,
        lat: nextGame.lat,
        lng: nextGame.lng,
        imageUrl: nextGame.image_url,
        totalPhotos: gameQueue.length,
        placeName: nextGame.place_name,
        placeId: nextGame.place_id,
        reviewContent: nextGame.review_content,
        reviewerNickname: nextGame.reviewer_nickname
      });
      setCurrentQueueIndex(nextIndex);
      setRound(prev => prev + 1);

      // Reset states
      setGuess(null);
      setResult(null);
      setShowResult(false);
      setTimeLeft(180);
      setPanoLocation(null);
      setNoPano(false);
    } else {
      // End of session - show summary
      setShowSessionSummary(true);
    }
  };

  // [New] Session Summary View
  if (showSessionSummary) {
    const totalScore = sessionResults.reduce((acc, curr) => acc + curr.score, 0);

    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] p-6 lg:p-10 text-[#0d161b] dark:text-white font-sans flex flex-col items-center">
        <div className="max-w-4xl w-full flex flex-col gap-8">
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-4xl font-bold">Game Over!</h1>
            <p className="text-slate-500 text-lg">Your Total Score: <span className="text-[#1392ec] font-bold text-2xl">{totalScore}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessionResults.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-[#1e2936] rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col">
                <div className="h-48 w-full bg-gray-200 relative">
                  <img src={item.imageUrl} alt={item.placeName} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                    {item.score} pts
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <h3 className="font-bold text-lg leading-tight">{item.placeName || "Unknown Place"}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 italic">
                    "{item.reviewContent || "No review content"}"
                  </p>
                  <div className="mt-auto pt-2 flex justify-between items-center text-xs text-slate-400">
                    <span>by {item.reviewerNickname}</span>
                    {item.placeId && (
                      <button
                        onClick={() => navigate(`/places/${item.placeId}`)}
                        className="text-[#1392ec] hover:underline font-bold"
                      >
                        View Place →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-4 mt-8">
            <button onClick={() => navigate('/')} className="px-8 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
              Go Home
            </button>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[#1392ec] text-white rounded-xl font-bold hover:bg-blue-600 transition-colors">
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          {/* [New] Distance Warning Toast */}
          {distanceWarning && (
            <div className="absolute top-16 left-4 right-4 z-20 bg-orange-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl flex items-start gap-3 shadow-lg animate-fade-in-down">
              <span className="text-xl">⚠️</span>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Warning</span>
                <span className="text-xs opacity-90">{distanceWarning}</span>
              </div>
            </div>
          )}

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