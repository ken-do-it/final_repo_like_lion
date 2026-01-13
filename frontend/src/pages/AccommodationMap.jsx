import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { placesAxios } from '../api/axios';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem', // rounded-xl
};

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
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
  ]
};

const AccommodationMap = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Google Maps Import
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
  const [searchStatus, setSearchStatus] = useState('');

  const mapRef = useRef(null);

  const onLoad = useCallback((map) => {
    setMap(map);
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fetch Accommodations Function
  const fetchAccommodations = async (lat, lng) => {
    setLoading(true);
    setError(null);
    setSearchStatus(`Searching around ${lat.toFixed(4)}, ${lng.toFixed(4)}...`);

    try {
      const params = {
        lat,
        lng,
        radius: 5000,
        limit: 15,
        type: selectedType || undefined
      };

      // Using placesAxios: baseURL is http://...:8000
      // Endpoint: /places/api/v1/accommodations/nearby
      const response = await placesAxios.get('/places/api/v1/accommodations/nearby', { params });
      const data = response.data;

      const validAccommodations = (data.results || []).filter(
        (acc) => acc.latitude && acc.longitude
      );

      setAccommodations(validAccommodations);
      setSearchStatus(`Found ${validAccommodations.length} places nearby.`);

      // Fit Bounds
      if (validAccommodations.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat, lng });
        validAccommodations.forEach((acc) => {
          bounds.extend({ lat: acc.latitude, lng: acc.longitude });
        });
        mapRef.current.fitBounds(bounds);
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load accommodations.');
      setAccommodations([]);
    } finally {
      setLoading(false);
    }
  };

  // Events
  const onMapClick = useCallback(async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setClickedPosition({ lat, lng });
    setSelectedAccommodation(null);
    await fetchAccommodations(lat, lng);
  }, [selectedType]); // Re-create if filter changes, but better to just use current filter in fetch

  // Trigger fetch when filter changes AND we have a position
  useEffect(() => {
    if (clickedPosition) {
      fetchAccommodations(clickedPosition.lat, clickedPosition.lng);
    }
  }, [selectedType]);


  const handleMarkerClick = (accommodation) => {
    setSelectedAccommodation(accommodation);
  };

  const handleListClick = (acc) => {
    setSelectedAccommodation(acc);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: acc.latitude, lng: acc.longitude });
      mapRef.current.setZoom(16);
    }
  };

  // Open External
  const openExternalMap = (accommodation) => {
    let url = `https://www.google.com/maps/search/?api=1&query=${accommodation.latitude},${accommodation.longitude}`;
    if (accommodation.provider === 'KAKAO') {
      url = `https://place.map.kakao.com/${accommodation.place_api_id}`;
    }
    window.open(url, '_blank');
  };

  // Errors
  if (loadError) return <div className="text-center p-10 text-red-500 font-bold">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="text-center p-10 font-bold animate-pulse">Loading Maps...</div>;

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101a22] min-h-screen text-[#111111] dark:text-[#f1f5f9] transition-colors p-6 pb-20">
      {/* Header / Filter */}
      <div className="container mx-auto max-w-screen-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🏨 숙소 찾기 <span className="text-sm font-normal text-gray-500 dark:text-gray-400 hidden sm:inline-block">지도를 클릭하여 검색하세요</span>
          </h2>
          {searchStatus && <p className="text-sm text-[#1392ec] mt-1">{searchStatus}</p>}
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-[#1e2b36] p-2 rounded-lg shadow-sm">
          <label className="text-sm font-bold pl-2">Filter:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer font-medium text-gray-700 dark:text-gray-200"
          >
            <option value="">전체</option>
            <option value="호텔">호텔</option>
            <option value="모텔">모텔</option>
            <option value="펜션">펜션</option>
            <option value="게스트하우스">게스트하우스</option>
            <option value="리조트">리조트</option>
          </select>
        </div>
      </div>

      {/* Map Area */}
      <div className="container mx-auto max-w-screen-xl h-[60vh] bg-white dark:bg-[#1e2b36] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden mb-8">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={clickedPosition || defaultCenter}
          zoom={13}
          onClick={onMapClick}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {/* Clicked Position */}
          {clickedPosition && (
            <Marker
              position={clickedPosition}
              icon="http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
              title="Selected Location"
            />
          )}

          {/* Results */}
          {accommodations.map((acc, i) => (
            <Marker
              key={`${acc.place_api_id}-${i}`}
              position={{ lat: acc.latitude, lng: acc.longitude }}
              onClick={() => handleMarkerClick(acc)}
              // Highlight selected
              animation={selectedAccommodation?.place_api_id === acc.place_api_id ? window.google.maps.Animation.BOUNCE : null}
            />
          ))}

          {/* InfoWindow */}
          {selectedAccommodation && (
            <InfoWindow
              position={{ lat: selectedAccommodation.latitude, lng: selectedAccommodation.longitude }}
              onCloseClick={() => setSelectedAccommodation(null)}
            >
              <div className="text-gray-800 p-1 max-w-[200px]">
                <h3 className="font-bold text-sm mb-1">{selectedAccommodation.name}</h3>
                <p className="text-xs text-gray-600 mb-2 truncate">{selectedAccommodation.address}</p>
                <button
                  onClick={() => openExternalMap(selectedAccommodation)}
                  className="w-full bg-[#1392ec] text-white text-xs py-1 rounded hover:bg-blue-600"
                >
                  Details
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1392ec] border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* List Area */}
      {accommodations.length > 0 && (
        <div className="container mx-auto max-w-screen-xl">
          <h3 className="text-xl font-bold mb-4 border-l-4 border-[#1392ec] pl-3">Nearby Accommodations ({accommodations.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {accommodations.map((acc, i) => (
              <div
                key={i}
                onClick={() => handleListClick(acc)}
                className={`bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer p-5 border border-transparent 
                                    ${selectedAccommodation?.place_api_id === acc.place_api_id ? 'border-[#1392ec] ring-2 ring-blue-100 dark:ring-blue-900' : 'hover:border-gray-200 dark:hover:border-gray-600'}
                                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                    {acc.category_main || '숙박'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${acc.provider === 'KAKAO' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                    {acc.provider}
                  </span>
                </div>
                <h4 className="font-bold text-lg mb-1 line-clamp-1">{acc.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[40px] mb-4">
                  {acc.address}
                </p>
                <button className="w-full py-2 bg-gray-50 dark:bg-gray-700 hover:bg-[#1392ec] hover:text-white dark:hover:bg-[#1392ec] text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                  Select on Map
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccommodationMap;