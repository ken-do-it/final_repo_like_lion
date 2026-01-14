import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, StreetViewPanorama, Marker, Polyline } from '@react-google-maps/api';
import { useLocation, useNavigate } from 'react-router-dom';

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

  // Coordinates
  const lat = locationState?.lat;
  const lng = locationState?.lng;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Game State
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // UI State (Mocking for visuals)
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
    libraries: libraries
  });

  const answerLocation = useMemo(() => ({ lat, lng }), [lat, lng]);

  // Timer Effect
  useEffect(() => {
    if (showResult) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showResult]);

  // Format Time 00:00
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
    if (!guess) return;

    const R = 6371;
    const dLat = (guess.lat - lat) * (Math.PI / 180);
    const dLng = (guess.lng - lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) * Math.cos(guess.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    let score = 0;
    if (distanceKm < 0.05) score = 5000;
    else score = Math.floor(5000 * Math.exp(-distanceKm / 2000));

    setResult({
      distance: distanceKm,
      score: score
    });
    setShowResult(true);
  };

  const handleNext = () => {
    // Mock functionality for next round
    navigate('/'); // Go home for now or would trigger next round fetch
  };

  if (!lat || !lng) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f8] dark:bg-[#101a22]">
        <h2 className="text-2xl font-bold dark:text-white">Invalid Location</h2>
        <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-[#1392ec] text-white rounded-lg">Go Home</button>
      </div>
    );
  }

  if (!isLoaded || loadError) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-[#101a22] text-white">Loading...</div>;
  }

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] text-[#0d161b] dark:text-white font-sans min-h-screen flex flex-col">


      {/* Main Game Area */}
      {/* Height calculation to fit viewport minus global navbar (approx 64px) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 h-[calc(100vh-64px)]">

        {/* Left Column: Panorama */}
        <div className="relative flex-1 group w-full h-[50vh] lg:h-auto rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none">
            <span className="text-[18px]">📷</span>
            <span className="text-xs font-bold">Street View</span>
          </div>

          {/* Compass (Visual Only) */}
          <div className="absolute top-4 right-4 z-20 bg-white/90 dark:bg-slate-900/90 p-2 rounded-full shadow-lg cursor-pointer hover:bg-white transition-colors">
            <span className="text-slate-700 dark:text-slate-200 material-icons">🧭</span>
          </div>

          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={answerLocation}
            zoom={14}
            options={{ disableDefaultUI: true, gestureHandling: 'none' }}
          >
            <StreetViewPanorama
              position={answerLocation}
              visible={true}
              options={streetViewOptions}
            />
          </GoogleMap>
        </div>

        {/* Right Column: Controls & Map */}
        <aside className="w-full lg:w-[400px] xl:w-[440px] flex flex-col gap-4 lg:h-full overflow-y-auto scrollbar-hide">

          {/* Target Photo Card */}
          {locationState?.imageUrl && (
            <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Photo</h3>
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={locationState.imageUrl} alt="Target" className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          {/* Game Info Card */}
          <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                <span>🚩</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Round</span>
                {/* Display Round as 1 / Total Photos */}
                <span className="text-lg font-bold">{round} <span className="text-slate-400 text-sm">/ {locationState?.totalPhotos || 1}</span></span>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-700"></div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                <span>⏱️</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Time</span>
                <span className={`text-lg font-bold font-mono ${timeLeft < 30 ? 'text-red-500 animate-pulse' : ''}`}>{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Guessing Interface */}
          <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col flex-1 gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-[#0d161b] dark:text-white">Where was this taken?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Find the location in the photo on the map!</p>
            </div>

            {/* Interactive Map Container */}
            <div className="relative w-full aspect-square lg:aspect-auto lg:flex-1 min-h-[400px] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
                center={defaultCenter}
                zoom={6}
                onClick={onMapClick}
                options={mapOptions}
              >
                {guess && (
                  <Marker
                    position={guess}
                    icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                  />
                )}
                {showResult && (
                  <>
                    <Marker
                      position={answerLocation}
                      icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    />
                    <Polyline
                      path={[guess, answerLocation]}
                      options={{
                        strokeColor: "#FF0000",
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        geodesic: true,
                      }}
                    />
                  </>
                )}
              </GoogleMap>

              {/* Overlay Animation for User Guess */}
              {!showResult && guess && (
                <div className="absolute top-[10px] left-1/2 -translate-x-1/2 bg-[#1392ec] text-white text-xs font-bold px-3 py-1 rounded shadow animate-bounce">
                  Pin Placed!
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              {!showResult ? (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={!guess}
                    className={`w-full h-12 flex items-center justify-center gap-2 text-white rounded-xl font-bold text-base shadow-lg transition-all ${guess
                      ? 'bg-[#1392ec] hover:bg-blue-600 active:scale-[0.98] shadow-blue-500/20'
                      : 'bg-gray-300 cursor-not-allowed'
                      }`}
                  >
                    <span>✅</span>
                    Confirm Guess
                  </button>
                  {/* Skip Button Removed */}
                </>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-base shadow-lg transition-all shadow-green-500/20"
                >
                  <span>➡️</span>
                  Next Round
                </button>
              )}
            </div>
          </div>

          {/* Result Card (When showResult is true) */}
          {showResult && result && (
            <div className="bg-white dark:bg-[#1e2936] rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 animate-fade-in-up">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Round Result</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Distance</p>
                  <p className="text-2xl font-mono text-[#1392ec]">
                    {result.distance < 1
                      ? `${(result.distance * 1000).toFixed(0)}m`
                      : `${result.distance.toFixed(2)}km`}
                  </p>
                </div>
                <div className="w-[1px] h-10 bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Score</p>
                  <div className="flex items-end justify-end gap-1">
                    <span className="text-2xl font-bold text-[#1392ec]">{result.score}</span>
                    <span className="text-xs text-gray-500 pb-1">pts</span>
                  </div>
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