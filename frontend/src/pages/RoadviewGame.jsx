import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, StreetViewPanorama, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// 기본 화면 (초기 로딩 시 보여줄 위치 등 - 사실 로드뷰가 메인이라 크게 중요하진 않음)
const defaultCenter = {
  lat: 36.3504119,
  lng: 127.3845475
};

const libraries = ['places', 'geometry'];

// 옵션 객체를 컴포넌트 밖으로 빼서 절대 변하지 않게 함 (Memoization보다 더 확실)
const streetViewOptions = {
  disableDefaultUI: false,
  zoom: 1,
  pov: { heading: 0, pitch: 0 },
  visible: true
};

const mapOptions = {
  streetViewControl: false,
};

import { useLocation, useNavigate } from 'react-router-dom';

const RoadviewGame = (props) => {
  const locationState = useLocation().state;
  const navigate = useNavigate();

  // Props로 받거나(기존 호환), router state로 받거나
  const lat = props.lat || locationState?.lat;
  const lng = props.lng || locationState?.lng;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>⚠️ 잘못된 접근입니다.</h2>
        <p>위치 정보가 없습니다. 사진을 먼저 업로드해주세요.</p>
        <button onClick={() => navigate('/geo-quiz')}>돌아가기</button>
      </div>
    );
  }

  if (!apiKey) {
    console.error("VITE_GOOGLE_MAPS_API_KEY is missing!");
    alert("Google Maps API Key가 설정되지 않았습니다. .env 파일을 확인해주세요!");
  }

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
    libraries: libraries
  });

  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  console.log("RoadviewGame Mounted with coords:", lat, lng);
  console.log("Maps loaded:", isLoaded, "Error:", loadError);

  // 문제의 정답 위치 (사진 속 위치)
  const answerLocation = useMemo(() => ({ lat, lng }), [lat, lng]);



  const onMapClick = useCallback((e) => {
    if (showResult) return;
    setGuess({
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    });
  }, [showResult]);

  // 거리 계산 (Haversine Formula) 및 점수 내기
  const handleSubmit = () => {
    if (!guess) return;

    const R = 6371; // 지구 반지름 (km)
    const dLat = (guess.lat - lat) * (Math.PI / 180);
    const dLng = (guess.lng - lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) * Math.cos(guess.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c; // 거리 (km)

    let score = 0;
    // 5000점 만점 공식 (GeoGuessr 스타일 대략적)
    // 거리가 0이면 5000점, 멀어질수록 감점 (exponential decay)
    // 2000km 이상이면 0점 처리
    if (distanceKm < 0.05) score = 5000; // 50m 이내 만점
    else {
      score = Math.floor(5000 * Math.exp(-distanceKm / 2000));
    }

    setResult({
      distance: distanceKm,
      score: score
    });
    setShowResult(true);
  };

  const handleRetry = () => {
    window.location.reload(); // 간단히 새로고침으로 초기화 (또는 상위에서 초기화 함수 받기)
  };

  if (loadError) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>
        <h3>⚠️ Google Maps 로딩 실패</h3>
        <p>API Key를 확인해주세요. ({loadError.message})</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h3>⏳ Google Maps 로딩 중...</h3>
        <p>잠시만 기다려주세요.</p>
      </div>
    );
  }

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', padding: '10px', gap: '10px' }}>
      <header style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2>🌍 GeoGuessr Challenge 🇰🇷</h2>
        {!showResult ? (
          <p>아래 로드뷰를 보고, 지도를 클릭해서 위치를 맞춰보세요! (현재 위치: {lat.toFixed(4)}, {lng.toFixed(4)})</p>
        ) : (
          <div style={{ padding: '10px', backgroundColor: '#e6fffa', borderRadius: '10px', border: '2px solid #38b2ac' }}>
            <h3>🎉 결과 발표!</h3>
            <p style={{ fontSize: '1.2rem' }}>거리 오차: <b>{result.distance < 1 ? (result.distance * 1000).toFixed(0) + 'm' : result.distance.toFixed(3) + 'km'}</b></p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c7a7b' }}>점수: {result.score} / 5000 점</p>
            <button onClick={handleRetry} style={{ marginTop: '10px', padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '5px' }}>
              다시 하기
            </button>
          </div>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, gap: '10px', minHeight: '0' }}>
        {/* 왼쪽: 로드뷰 (문제) */}
        <div style={{ flex: 1, position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #ddd' }}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={answerLocation}
            zoom={14}
          >
            <StreetViewPanorama
              position={answerLocation}
              visible={true}
              options={streetViewOptions}
            />
          </GoogleMap>
        </div>

        {/* 오른쪽: 지도 (정답지) */}
        <div style={{ flex: 1, position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #ddd' }}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={defaultCenter}
            zoom={7} // 대한민국 전체 보일 정도
            onClick={onMapClick}
            options={mapOptions}
          >
            {/* 유저가 찍은 위치 마커 */}
            {guess && (
              <Marker
                position={guess}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                }}
              />
            )}

            {/* 결과 화면: 정답 위치 마커 & 선 긋기 */}
            {showResult && (
              <>
                <Marker
                  position={answerLocation}
                  label="정답"
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                  }}
                />

                <Polyline
                  path={[guess, answerLocation]}
                  options={{
                    strokeColor: "#FF0000",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    geodesic: true, // 지구 곡면 따라 그리기
                    icons: [{
                      icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
                      offset: "0",
                      repeat: "10px"
                    }]
                  }}
                />
              </>
            )}
          </GoogleMap>

          {/* 제출 버튼 (지도 위에 둥둥 떠있게) */}
          {!showResult && guess && (
            <button
              onClick={handleSubmit}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '15px 30px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              🚀 정답 제출!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoadviewGame;