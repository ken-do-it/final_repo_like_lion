import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { placesAxios } from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { API_LANG_CODES } from '../constants/translations';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem', // rounded-xl check
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780,
};

const libraries = ['places', 'geometry'];

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] } // Cleaner map
  ]
};

const AccommodationMap = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { t, language } = useLanguage();

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
  const [searchStatus, setSearchStatus] = useState('Click on the map to search');
  const [searchKeyword, setSearchKeyword] = useState(''); // [1] Add searchKeyword state

  const mapRef = useRef(null);

  const onLoad = useCallback((map) => {
    setMap(map);
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const fetchAccommodations = async (lat, lng) => {
    setLoading(true);
    setError(null);
    setSearchStatus(`Searching...`);

    try {
      const params = {
        lat,
        lng,
        radius: 5000,
        limit: 20, // Increased limit for better list view
        type: selectedType || undefined,
        lang: API_LANG_CODES[language] || 'eng_Latn'
      };

      const response = await placesAxios.get('/accommodations/nearby', { params });
      const data = response.data;
      const validAccommodations = (data.results || []).filter(
        (acc) => acc.latitude && acc.longitude
      );

      setAccommodations(validAccommodations);
      setSearchStatus(validAccommodations.length > 0 ? `Found ${validAccommodations.length} places` : 'No places found nearby');

      if (validAccommodations.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat, lng }); // Include search center
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

  const onMapClick = useCallback(async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setClickedPosition({ lat, lng });
    setSelectedAccommodation(null);
    await fetchAccommodations(lat, lng);
  }, [selectedType, language]);

  // [2] Handle Keyword Search (Geocoding)
  const handleKeywordSearch = async () => {
    if (!searchKeyword.trim()) return;
    if (!window.google || !window.google.maps) {
      alert("Google Maps not loaded yet.");
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchKeyword }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();

        // Update map center and search
        setClickedPosition({ lat, lng });
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(14);
        }
        fetchAccommodations(lat, lng);
      } else {
        alert("Location not found: " + status);
      }
    });
  };

  useEffect(() => {
    if (clickedPosition) {
      fetchAccommodations(clickedPosition.lat, clickedPosition.lng);
    }
  }, [selectedType, language]);

  const handleMarkerClick = (accommodation) => {
    setSelectedAccommodation(accommodation);
    // Scroll list item into view logic could be added here
  };

  const handleListClick = (acc) => {
    setSelectedAccommodation(acc);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: acc.latitude, lng: acc.longitude });
      mapRef.current.setZoom(16);
    }
  };

  const openExternalMap = (accommodation) => {
    let url = `https://www.google.com/maps/search/?api=1&query=${accommodation.latitude},${accommodation.longitude}`;
    if (accommodation.provider === 'KAKAO') {
      url = `https://place.map.kakao.com/${accommodation.place_api_id}`;
    }
    window.open(url, '_blank');
  };

  if (loadError) return <div className="flex h-screen items-center justify-center text-red-500">{t('stays_error_map')}</div>;
  if (!isLoaded) return <div className="flex h-screen items-center justify-center dark:bg-[#101a22] text-white">{t('stays_loading_map')}</div>;

  return (
    <div className="flex flex-col h-screen bg-[#f6f7f8] dark:bg-[#101a22] transition-colors overflow-hidden">

      {/* Header Container */}
      <div className="container mx-auto px-4 max-w-screen-xl py-4 flex-none z-10">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#111111] dark:text-[#f1f5f9]">{t('stays_title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{searchStatus}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl">
            {/* Search Input */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#1e2b36] px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex-1 min-w-[200px]">
              <span className="material-symbols-outlined text-gray-400">search</span>
              <input
                type="text"
                placeholder={t('stays_search_placeholder')}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 text-[#111111] dark:text-[#f1f5f9] flex-1 w-full"
              />
              <button
                onClick={handleKeywordSearch}
                className="text-[#1392ec] font-bold text-sm hover:underline"
              >
                {t('stays_search_btn')}
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 bg-white dark:bg-[#1e2b36] px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">{t('stays_type_label')}</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 text-[#111111] dark:text-[#f1f5f9] cursor-pointer"
              >
                <option value="">{t('stays_type_all')}</option>
                <option value="호텔">{t('stays_type_hotel')}</option>
                <option value="모텔">{t('stays_type_motel')}</option>
                <option value="펜션">{t('stays_type_pension')}</option>
                <option value="게스트하우스">{t('stays_type_guesthouse')}</option>
                <option value="리조트">{t('stays_type_resort')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Split Pane */}
      <div className="container mx-auto px-4 max-w-screen-xl flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 pb-6 min-h-0">

        {/* Left: List View (Scrollable) */}
        <div className="lg:col-span-4 flex flex-col h-full bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">

          {accommodations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
              <span className="text-4xl mb-4">🗺️</span>
              <p>{t('stays_initial_msg')}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {accommodations.map((acc, i) => (
                <div
                  key={i}
                  onClick={() => handleListClick(acc)}
                  className={`group flex gap-4 p-3 rounded-xl border transition-all cursor-pointer
                                ${selectedAccommodation?.place_api_id === acc.place_api_id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-[#1392ec] ring-1 ring-[#1392ec]'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                    }
                            `}
                >
                  {/* Image Placeholder */}
                  <div className="w-24 h-24 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 overflow-hidden relative">
                    {/* Mock Image using color hash or just standard placeholder */}
                    <span className="z-10">Image</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 opacity-50"></div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className={`font-bold text-base truncate pr-2 ${selectedAccommodation?.place_api_id === acc.place_api_id ? 'text-[#1392ec]' : 'text-[#111111] dark:text-[#f1f5f9]'}`}>
                          {acc.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {acc.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {acc.category_main_translated || acc.category_main || t('stays_type_all')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${acc.provider === 'KAKAO' ? 'bg-[#fee500]/20 text-[#3c1e1e] dark:text-[#fee500]' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                        {acc.provider}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-center text-sm text-[#1392ec] font-bold animate-pulse">
              {t('stays_updating')}
            </div>
          )}
        </div>

        {/* Right: Map View (Full Height) */}
        <div className="lg:col-span-8 h-[50vh] lg:h-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 relative ring-1 ring-black/5">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={clickedPosition || defaultCenter}
            zoom={13}
            onClick={onMapClick}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={mapOptions}
          >
            {/* Search Center Marker */}
            {clickedPosition && (
              <Marker
                position={clickedPosition}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                }}
              />
            )}

            {/* Accommodation Markers */}
            {accommodations.map((acc, i) => (
              <Marker
                key={`${acc.place_api_id}-${i}`}
                position={{ lat: acc.latitude, lng: acc.longitude }}
                onClick={() => handleMarkerClick(acc)}
                animation={selectedAccommodation?.place_api_id === acc.place_api_id ? window.google.maps.Animation.BOUNCE : null}
              />
            ))}

            {/* Info Window */}
            {selectedAccommodation && (
              <InfoWindow
                position={{ lat: selectedAccommodation.latitude, lng: selectedAccommodation.longitude }}
                onCloseClick={() => setSelectedAccommodation(null)}
              >
                <div className="p-2 min-w-[200px] max-w-[250px]">
                  <h3 className="font-bold text-[#111111] text-sm mb-1">{selectedAccommodation.name}</h3>
                  <p className="text-xs text-gray-600 mb-2">{selectedAccommodation.address}</p>
                  <button
                    onClick={() => openExternalMap(selectedAccommodation)}
                    className="w-full bg-[#1392ec] hover:bg-blue-600 text-white text-xs font-bold py-1.5 rounded transition-colors"
                  >
                    {t('stays_view_details')}
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Loading Overlay Map */}
          {loading && (
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="bg-white dark:bg-[#1e2b36] px-6 py-3 rounded-full shadow-xl flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1392ec] border-t-transparent"></div>
                <span className="text-sm font-bold text-[#111111] dark:text-white">{t('stays_finding')}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AccommodationMap;
