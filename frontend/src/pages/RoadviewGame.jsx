import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, StreetViewPanorama, Marker, Polyline } from '@react-google-maps/api';
import { useLocation, useNavigate } from 'react-router-dom';

const libraries = ['places', 'geometry'];

const streetViewOptions = {
  disableDefaultUI: false, // Keep controls as per requirement, but styled cleanly by default GMaps
  zoom: 1,
  pov: { heading: 0, pitch: 0 },
  visible: true,
  showRoadLabels: false // Adding this to make it harder (optional polish)
};

const mapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false, // Prevent clicking POIs
};

const defaultCenter = {
  lat: 36.3504119,
  lng: 127.3845475
};

const RoadviewGame = () => {
  const locationState = useLocation().state;
  const navigate = useNavigate();

  // Coordinates from Router State or fallback (for dev/testing, though strict check exists)
  const lat = locationState?.lat;
  const lng = locationState?.lng;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Game State
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // Google Maps Loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
    libraries: libraries
  });

  // Memoize default locations
  const answerLocation = useMemo(() => ({ lat, lng }), [lat, lng]);

  // Handle Map Click (User Guess)
  const onMapClick = useCallback((e) => {
    if (showResult) return;
    setGuess({
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    });
  }, [showResult]);

  // Calculate Score (Haversine)
  const handleSubmit = () => {
    if (!guess) return;

    const R = 6371; // Earth radius in km
    const dLat = (guess.lat - lat) * (Math.PI / 180);
    const dLng = (guess.lng - lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) * Math.cos(guess.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Scoring Formula: 5000 * exp(-distance / 2000)
    // Adjusted decay for a bit more difficulty/fun? Keeping original logic.
    let score = 0;
    if (distanceKm < 0.05) score = 5000;
    else score = Math.floor(5000 * Math.exp(-distanceKm / 2000));

    setResult({
      distance: distanceKm,
      score: score
    });
    setShowResult(true);
  };

  const handleRetry = () => {
    // In a real app, might want to pop state or go back to list
    navigate(-1);
  };

  const handleHome = () => {
    navigate('/');
  }

  // --- Loading / Error States ---
  if (!lat || !lng) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#101a22] text-center p-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-2 dark:text-white">잘못된 접근입니다.</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">위치 정보가 없습니다. 퀴즈 목록에서 시작해주세요.</p>
        <button
          onClick={() => navigate('/geo-quiz')}
          className="px-6 py-2 bg-[#1392ec] text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          퀴즈 목록으로 이동
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-red-500">
        <h3 className="text-xl font-bold">⚠️ Google Maps Error</h3>
        <p>{loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#101a22]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1392ec] mb-4"></div>
        <p className="text-gray-500">지도를 불러오는 중입니다...</p>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-[#101a22] overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-[#1e2b36] shadow-sm z-10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🌍</span>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white hidden md:block">
            GeoGuessr Challenge <span className="text-[#1392ec]">Korea</span>
          </h1>
        </div>

        {/* Game Info / Status */}
        <div className="bg-gray-100 dark:bg-black/20 px-4 py-1 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300">
          {showResult ? (
            <span className="text-green-500 font-bold">게임 종료</span>
          ) : (
            <span>위치를 찾아보세요!</span>
          )}
        </div>

        <div className="flex space-x-2">
          <button onClick={handleHome} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
            ✕
          </button>
        </div>
      </header>

      {/* Split Screen Container */}
      <main className="flex-1 flex flex-col lg:flex-row h-full relative">

        {/* Left: Street View (Question) */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full relative border-b-4 lg:border-b-0 lg:border-r-4 border-white dark:border-[#2d3748]">
          <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-3 py-1 rounded backdrop-blur-sm text-sm pointer-events-none">
            📷 이 장소는 어디일까요?
          </div>
          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={answerLocation}
            zoom={14}
            options={{ disableDefaultUI: true, gestureHandling: 'none' }} // Map under StreetView doesn't need interaction
          >
            <StreetViewPanorama
              position={answerLocation}
              visible={true}
              options={streetViewOptions}
            />
          </GoogleMap>
        </div>

        {/* Right: Map (Answer Sheet) */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full relative bg-gray-200">
          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={defaultCenter}
            zoom={7}
            onClick={onMapClick}
            options={mapOptions}
          >
            {/* User Guess Marker */}
            {guess && (
              <Marker
                position={guess}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                }}
              />
            )}

            {/* Result: Answer Marker & Polyline */}
            {showResult && (
              <>
                <Marker
                  position={answerLocation}
                  label={{ text: "정답", color: "white", className: "bg-green-600 px-2 rounded" }}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                  }}
                />
                <Polyline
                  path={[guess, answerLocation]}
                  options={{
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    geodesic: true,
                    icons: [{
                      icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
                      offset: "0",
                      repeat: "20px"
                    }]
                  }}
                />
              </>
            )}
          </GoogleMap>

          {/* Submit Button (Floating) */}
          {!showResult && guess && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-[#e53e3e] hover:bg-red-600 text-white text-lg font-bold rounded-full shadow-lg transform hover:scale-105 transition-all animate-bounce-subtle"
              >
                🚀 정답 제출하기
              </button>
            </div>
          )}

          {/* Result Overlay (Absolute Center) */}
          {showResult && result && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border overflow-hidden relative">
                {/* Success Sparkles/Effect (Simplified) */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500"></div>

                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                  결과 발표!
                </h2>

                <div className="py-6 space-y-4">
                  <div>
                    <p className="text-gray-500 text-sm">오차 거리</p>
                    <p className="text-3xl font-mono font-bold text-gray-800 dark:text-white">
                      {result.distance < 1
                        ? `${(result.distance * 1000).toFixed(0)}m`
                        : `${result.distance.toFixed(2)}km`}
                    </p>
                  </div>
                  <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>
                  <div>
                    <p className="text-gray-500 text-sm">획득 점수</p>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-4xl font-extrabold text-[#1392ec]">{result.score}</span>
                      <span className="text-gray-400 pb-1">/ 5000</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleHome}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    종료
                  </button>
                  <button
                    onClick={handleRetry}
                    className="flex-1 px-4 py-3 bg-[#1392ec] hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all"
                  >
                    다음 라운드
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RoadviewGame;