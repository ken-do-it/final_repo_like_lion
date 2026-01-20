import React, { useState, useCallback, useEffect } from 'react';
import exifr from 'exifr';
import { useNavigate } from 'react-router-dom';
import { placesAxios } from '../api/axios'; // Import placesAxios
import { useLanguage } from '../context/LanguageContext';

const GeoImageUploader = () => {
  const { t } = useLanguage();
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gpsData, setGpsData] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Review Game State
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);

  const navigate = useNavigate();

  // Fetch Reviews Effect
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await placesAxios.get('/roadview/my-photo-reviews');
        setReviews(response.data);
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  const handleStartReviewGame = async () => {
    if (!selectedReview) return;

    setLoading(true); // 로딩 상태 표시
    try {
      // 1. 서버에 게임 데이터로 등록 요청 (review_id 기준)
      const response = await placesAxios.post(`/roadview/start-from-review/${selectedReview.review_id}`);

      // 서버 응답에서 좌표 정보 추출
      const { lat, lng } = response.data;

      // [성공 알림] 사용자가 자신의 사진이 게임에 등록되었음을 알 수 있게 함
      alert("This photo has been registered for the Roadview Game!");

      // 2. 게임 페이지로 이동하면서 상태값 전달
      navigate('/game', {
        state: {
          lat,
          lng,
          imageUrl: selectedReview.image_url, // 게임에서 보여줄 이미지
          totalPhotos: 1 // 현재는 단일 라운드로 설정 (필요 시 reviews.length 전달)
        }
      });
    } catch (error) {
      console.error("Failed to start game from review:", error);
      setError("Failed to register this photo for the game.");
    } finally {
      setLoading(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setGpsData(null);

    // Create Preview
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);

    try {
      console.log("🔍 Extracting GPS data...");
      // Use exifr to extract GPS
      const data = await exifr.gps(file);

      if (data && data.latitude && data.longitude) {
        console.log("✅ GPS Found:", data);
        setGpsData({
          lat: data.latitude,
          lng: data.longitude
        });
      } else {
        console.warn("❌ No GPS data found");
        setError("This photo doesn't contain GPS location data. Please try another one.");
      }
    } catch (err) {
      console.error("⚠️ Error extracting GPS:", err);
      setError("Failed to analyze the image. It might be corrupted or format not supported.");
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = (files) => {
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  // Drag & Drop Handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleStartGame = () => {
    if (gpsData) {
      navigate('/game', {
        state: {
          lat: gpsData.lat,
          lng: gpsData.lng,
          imageUrl: imageSrc // [수정] 분석한 이미지 URL을 같이 넘겨줘야 함
        }
      });
    }
  };

  // Cleanup object URL
  useEffect(() => {
    // imageSrc가 바뀔 때 이전 objectURL을 추적해서 해제하는 고도화가 필요하지만,
    // 일단 net::ERR_FILE_NOT_FOUND를 해결하려면 언마운트 시 revoke 로직을 주석 처리해보세요.
  }, [imageSrc]);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] font-sans flex flex-col items-center py-10 px-4 transition-colors">

      <div className="max-w-2xl w-full flex flex-col gap-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('geo_title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('geo_desc')}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">

          {/* Upload Zone */}
          <div
            className={`relative w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden
                            ${dragActive
                ? 'border-[#1392ec] bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-[#1392ec] hover:bg-gray-50 dark:hover:bg-gray-800'
              }
                            ${imageSrc ? 'h-auto p-4 border-solid' : 'h-64'}
                        `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!imageSrc ? (
              <>
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleChange}
                />
                <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[#1392ec] flex items-center justify-center mb-4">
                  <span className="text-3xl">☁️</span>
                </div>
                <h3 className="text-lg font-bold mb-1">{t('geo_drag_drop')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('geo_support_fmt')}</p>
              </>
            ) : (
              <div className="flex flex-col items-center w-full">
                <img
                  src={imageSrc}
                  alt="Uploaded Preview"
                  className="max-h-[400px] w-auto rounded-lg shadow-md object-contain"
                />
                <button
                  onClick={() => { setImageSrc(null); setGpsData(null); setError(null); }}
                  className="mt-4 text-[#1392ec] font-bold text-sm hover:underline"
                >
                  {t('geo_remove')}
                </button>
              </div>
            )}
          </div>

          {/* Status & Results */}
          <div className="mt-6 space-y-4">
            {loading && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 animate-pulse justify-center">
                <div className="animate-spin size-5 border-2 border-[#1392ec] border-t-transparent rounded-full"></div>
                <span className="font-bold">{t('geo_analyzing')}</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/50">
                <span>⚠️</span>
                <span className="font-bold text-sm">{error}</span>
              </div>
            )}

            {gpsData && (
              <div className="animate-fade-in-up space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-[#101a22] p-4 rounded-xl text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('geo_lat')}</p>
                    <p className="text-xl font-mono font-bold text-[#111111] dark:text-[#f1f5f9]">{gpsData.lat.toFixed(6)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#101a22] p-4 rounded-xl text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('geo_lng')}</p>
                    <p className="text-xl font-mono font-bold text-[#111111] dark:text-[#f1f5f9]">{gpsData.lng.toFixed(6)}</p>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center justify-center gap-2 border border-green-100 dark:border-green-900/50">
                  <span>✅</span>
                  <span className="font-bold">{t('geo_success')}</span>
                </div>

                <button
                  onClick={handleStartGame}
                  className="w-full py-4 bg-[#1392ec] hover:bg-blue-600 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <span>�</span>
                  {t('geo_start_game')}
                </button>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-[#1e2b36] text-gray-500">{t('geo_or_memories')}</span>
            </div>
          </div>

          {/* Review List Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">{t('geo_my_reviews')}</h3>
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-[#101a22] rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <p>{t('geo_no_reviews')}</p>
                <p className="text-xs mt-1">{t('geo_write_review_hint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {reviews.map((review) => (
                  <div
                    key={review.review_id}
                    onClick={() => setSelectedReview(review)}
                    className={`relative aspect-square cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${selectedReview?.review_id === review.review_id
                      ? 'border-[#1392ec] ring-2 ring-[#1392ec]/20'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <img src={review.image_url} alt={review.place_name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs font-bold truncate">{review.place_name}</p>
                    </div>
                    {selectedReview?.review_id === review.review_id && (
                      <div className="absolute top-2 right-2 bg-[#1392ec] text-white size-6 rounded-full flex items-center justify-center text-xs shadow-sm">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedReview && (
              <div className="animate-fade-in-up pt-2">
                <button
                  onClick={handleStartReviewGame}
                  className="w-full py-3 bg-[#1392ec] hover:bg-blue-600 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-base shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  {t('geo_start_with').replace('{name}', selectedReview.place_name)}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Debug / Nav Helper */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 font-medium text-sm transition-colors"
          >
            {t('geo_back_home')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default GeoImageUploader;