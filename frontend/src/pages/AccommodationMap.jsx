import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 150px)',
  borderRadius: '16px',
};

// 서울 중심
const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780,
};

const libraries = ['places'];

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  // 기본 POI(관심 장소) 마커 숨기기
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'poi.business',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'transit',
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

// 숙소 타입별 마커 색상
const typeColors = {
  '호텔': '#FF5733',
  '모텔': '#33A1FF',
  '펜션': '#33FF57',
  '게스트하우스': '#FF33F5',
  '리조트': '#FFD700',
  '민박': '#8B4513',
  'default': '#FF0000',
};

const AccommodationMap = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: libraries,
  });

  const [map, setMap] = useState(null);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [accommodations, setAccommodations] = useState([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [searchCity, setSearchCity] = useState('');

  const mapRef = useRef(null);

  const onLoad = useCallback((map) => {
    setMap(map);
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // 지도 클릭 시 해당 위치 근처 숙소 검색
  const onMapClick = useCallback(async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setClickedPosition({ lat, lng });
    setSelectedAccommodation(null);
    
    // 역지오코딩으로 도시명 추출 (간단히 위치 기반으로 검색)
    await fetchAccommodations(lat, lng);
  }, [selectedType]);

  // FastAPI 숙소 API 호출
  const fetchAccommodations = async (lat, lng) => {
    setLoading(true);
    setError(null);
    
    try {
      // 역지오코딩으로 도시명 얻기 (Google Geocoder 사용)
      const geocoder = new window.google.maps.Geocoder();
      const response = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng }, language: 'ko' }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error('Geocoding failed'));
          }
        });
      });

      // 주소에서 도시명 추출
      let city = '';
      for (const component of response.address_components) {
        if (component.types.includes('locality') || 
            component.types.includes('sublocality_level_1') ||
            component.types.includes('administrative_area_level_1')) {
          city = component.long_name;
          break;
        }
      }

      if (!city) {
        city = '서울'; // 기본값
      }

      setSearchCity(city);

      // FastAPI 숙소 API 호출 (Nginx 프록시: /places/ -> fastapi_places:8002)
      let url = `/places/api/v1/accommodations?city=${encodeURIComponent(city)}&limit=15`;
      if (selectedType) {
        url += `&type=${encodeURIComponent(selectedType)}`;
      }

      const apiResponse = await fetch(url);
      
      if (!apiResponse.ok) {
        throw new Error(`API Error: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      
      // 위치 정보가 있는 숙소만 필터링
      const validAccommodations = (data.results || []).filter(
        (acc) => acc.latitude && acc.longitude
      );

      setAccommodations(validAccommodations);

      // 검색 결과가 있으면 지도 범위 조정
      if (validAccommodations.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat, lng }); // 클릭한 위치도 포함
        validAccommodations.forEach((acc) => {
          bounds.extend({ lat: acc.latitude, lng: acc.longitude });
        });
        mapRef.current.fitBounds(bounds);
      }

    } catch (err) {
      console.error('숙소 검색 실패:', err);
      setError('숙소 검색에 실패했습니다. 다시 시도해주세요.');
      setAccommodations([]);
    } finally {
      setLoading(false);
    }
  };

  // 마커 클릭 시 상세 정보 표시
  const handleMarkerClick = (accommodation) => {
    setSelectedAccommodation(accommodation);
  };

  // 외부 지도 서비스로 이동
  const openExternalMap = (accommodation) => {
    let url = '';
    
    if (accommodation.provider === 'KAKAO') {
      // 카카오맵 상세 페이지
      url = `https://place.map.kakao.com/${accommodation.place_api_id}`;
    } else if (accommodation.provider === 'GOOGLE') {
      // 구글맵 상세 페이지
      url = `https://www.google.com/maps/place/?q=place_id:${accommodation.place_api_id}`;
    } else {
      // 기본: 구글맵 좌표 검색
      url = `https://www.google.com/maps/search/?api=1&query=${accommodation.latitude},${accommodation.longitude}`;
    }
    
    window.open(url, '_blank');
  };

  // 숙소 타입 필터 변경
  const handleTypeChange = (e) => {
    setSelectedType(e.target.value);
    // 이미 클릭한 위치가 있으면 다시 검색
    if (clickedPosition) {
      fetchAccommodations(clickedPosition.lat, clickedPosition.lng);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>
        <h3>⚠️ Google Maps 로딩 실패</h3>
        <p>API Key를 확인해주세요.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h3>⏳ 지도 로딩 중...</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>🏨 숙소 찾기</h2>
        <p style={{ margin: '0 0 15px 0', color: '#666' }}>
          지도를 클릭하면 해당 위치 근처의 숙소를 찾아드립니다!
        </p>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>숙소 유형:</span>
            <select
              value={selectedType}
              onChange={handleTypeChange}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px',
              }}
            >
              <option value="">전체</option>
              <option value="호텔">호텔</option>
              <option value="모텔">모텔</option>
              <option value="펜션">펜션</option>
              <option value="게스트하우스">게스트하우스</option>
              <option value="리조트">리조트</option>
              <option value="민박">민박</option>
            </select>
          </label>

          {searchCity && (
            <span style={{ 
              padding: '6px 12px', 
              backgroundColor: '#e3f2fd', 
              borderRadius: '20px',
              fontSize: '14px',
            }}>
              📍 검색 지역: {searchCity}
            </span>
          )}

          {loading && (
            <span style={{ color: '#1976d2', fontWeight: 'bold' }}>
              🔄 검색 중...
            </span>
          )}
        </div>

        {error && (
          <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>
        )}
      </div>

      {/* 지도 */}
      <div style={{ position: 'relative' }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={clickedPosition || defaultCenter}
          zoom={13}
          onClick={onMapClick}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {/* 클릭한 위치 마커 */}
          {clickedPosition && (
            <Marker
              position={clickedPosition}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              }}
              title="검색 위치"
            />
          )}

          {/* 숙소 마커들 */}
          {accommodations.map((acc, index) => (
            <Marker
              key={`${acc.place_api_id}-${index}`}
              position={{ lat: acc.latitude, lng: acc.longitude }}
              onClick={() => handleMarkerClick(acc)}
              icon={{
                url: `http://maps.google.com/mapfiles/ms/icons/red-dot.png`,
              }}
              title={acc.name}
            />
          ))}

          {/* 선택된 숙소 InfoWindow */}
          {selectedAccommodation && (
            <InfoWindow
              position={{
                lat: selectedAccommodation.latitude,
                lng: selectedAccommodation.longitude,
              }}
              onCloseClick={() => setSelectedAccommodation(null)}
            >
              <div style={{ 
                padding: '10px', 
                maxWidth: '280px',
                fontFamily: 'system-ui, sans-serif',
              }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '16px',
                  color: '#333',
                }}>
                  {selectedAccommodation.name}
                </h3>
                
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '13px',
                  color: '#666',
                }}>
                  📍 {selectedAccommodation.address}
                </p>

                {selectedAccommodation.category_detail && (
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '12px',
                    color: '#888',
                  }}>
                    🏷️ {selectedAccommodation.category_detail.join(' > ')}
                  </p>
                )}

                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginTop: '12px',
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: selectedAccommodation.provider === 'KAKAO' ? '#FFEB00' : '#4285F4',
                    color: selectedAccommodation.provider === 'KAKAO' ? '#000' : '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}>
                    {selectedAccommodation.provider}
                  </span>

                  <button
                    onClick={() => openExternalMap(selectedAccommodation)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    🔗 상세보기
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* 검색 결과 카운트 */}
        {accommodations.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            zIndex: 10,
          }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>
              🏨 {accommodations.length}개의 숙소를 찾았습니다
            </span>
          </div>
        )}
      </div>

      {/* 숙소 리스트 (선택사항) */}
      {accommodations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>검색된 숙소 목록</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '15px',
            marginTop: '15px',
          }}>
            {accommodations.map((acc, index) => (
              <div
                key={`list-${acc.place_api_id}-${index}`}
                onClick={() => {
                  setSelectedAccommodation(acc);
                  // 지도 중심 이동
                  if (mapRef.current) {
                    mapRef.current.panTo({ lat: acc.latitude, lng: acc.longitude });
                    mapRef.current.setZoom(16);
                  }
                }}
                style={{
                  padding: '15px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: selectedAccommodation?.place_api_id === acc.place_api_id 
                    ? '0 4px 12px rgba(25, 118, 210, 0.3)' 
                    : '0 2px 4px rgba(0,0,0,0.05)',
                  borderColor: selectedAccommodation?.place_api_id === acc.place_api_id 
                    ? '#1976d2' 
                    : '#e0e0e0',
                }}
              >
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>
                  {acc.name}
                </h4>
                <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
                  {acc.address}
                </p>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <span style={{
                    padding: '3px 8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}>
                    {acc.category_main || '숙박'}
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    backgroundColor: acc.provider === 'KAKAO' ? '#FFF9C4' : '#E3F2FD',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}>
                    {acc.provider}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccommodationMap;