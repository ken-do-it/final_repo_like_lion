// src/pages/plans/PlanDetail.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import plansService from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const PlanDetail = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { language, t } = useLanguage();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // 좋아요 상태
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // 댓글 상태
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  // 이미지 업로드 상태
  const [uploadingImageFor, setUploadingImageFor] = useState(null); // detailId
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRefs = useRef({});

  // 이미지 모달 상태
  const [modalImages, setModalImages] = useState([]); // 현재 장소의 이미지 배열
  const [modalImageIndex, setModalImageIndex] = useState(0); // 현재 보고 있는 이미지 인덱스
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 본인 일정인지 확인
  const isOwner = isAuthenticated && plan && user && plan.user === user.id;

  // Kakao Map refs - 각 장소별 지도 컨테이너
  const mapRefs = useRef({});
  const mapsInitialized = useRef({});

  useEffect(() => {
    fetchPlanDetail();
    fetchLikeStatus();
    fetchComments();
  }, [planId, language]);

  // 좋아요 상태 조회
  const fetchLikeStatus = async () => {
    console.log('fetchLikeStatus called for planId:', planId);
    try {
      const response = await plansService.likes.getLikeStatus(planId);
      console.log('Like status response:', response.data);
      setIsLiked(response.data.liked);
      setLikeCount(response.data.like_count);
    } catch (err) {
      console.error('Error fetching like status:', err);
    }
  };

  // 좋아요 토글
  const handleLikeToggle = async () => {
    if (!isAuthenticated) {
      alert(t('alert_login_required'));
      return;
    }

    try {
      setLikeLoading(true);
      const response = await plansService.likes.toggleLike(planId);
      setIsLiked(response.data.liked);
      setLikeCount(response.data.like_count);
    } catch (err) {
      if (err.response?.status === 403) {
        alert(t('alert_public_like_only'));
      } else {
        alert(t('alert_like_fail'));
      }
      console.error('Error toggling like:', err);
    } finally {
      setLikeLoading(false);
    }
  };

  // 댓글 목록 조회
  const fetchComments = async () => {
    console.log('fetchComments called for planId:', planId);
    try {
      const response = await plansService.comments.getComments(planId, {
        lang: API_LANG_CODES[language] || 'eng_Latn'
      });
      console.log('Comments response:', response.data);
      setComments(response.data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  // 댓글 작성
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      alert(t('alert_login_required'));
      return;
    }

    try {
      setCommentLoading(true);
      await plansService.comments.createComment(planId, { content: newComment });
      setNewComment('');
      fetchComments();
    } catch (err) {
      if (err.response?.status === 403) {
        alert(t('alert_public_comment_only'));
      } else {
        alert(t('alert_comment_fail'));
      }
      console.error('Error creating comment:', err);
    } finally {
      setCommentLoading(false);
    }
  };

  // 댓글 수정
  const handleCommentUpdate = async (commentId) => {
    if (!editingContent.trim()) return;

    try {
      await plansService.comments.updateComment(commentId, { content: editingContent });
      setEditingCommentId(null);
      setEditingContent('');
      fetchComments();
    } catch (err) {
      alert(t('alert_comment_update_fail'));
      console.error('Error updating comment:', err);
    }
  };

  // 댓글 삭제
  const handleCommentDelete = async (commentId) => {
    if (!window.confirm(t('confirm_comment_delete'))) return;

    try {
      await plansService.comments.deleteComment(commentId);
      fetchComments();
    } catch (err) {
      alert(t('alert_comment_delete_fail'));
      console.error('Error deleting comment:', err);
    }
  };

  const fetchPlanDetail = async () => {
    try {
      setLoading(true);
      const response = await plansService.plans.getPlanById(planId, {
        lang: API_LANG_CODES[language] || 'eng_Latn'
      });
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
        setError(err.response?.data?.error || t('error_plan_private'));
      } else if (err.response?.status === 404) {
        setError(t('error_plan_not_found'));
      } else {
        setError(t('error_fetch_plan_failed'));
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
        position: new window.kakao.maps.LatLng(latitude, longitude),
        title: placeName // 마커에 마우스를 올렸을 때 장소 이름 표시
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
    if (!window.confirm(t('msg_confirm_delete_place'))) {
      return;
    }

    try {
      await plansService.details.deleteDetail(detailId);
      // Refresh plan details
      fetchPlanDetail();
    } catch (err) {
      alert(t('error_delete_place_failed'));
      console.error('Error deleting place:', err);
    }
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = async (detailId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      alert(t('alert_image_only') || '이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(t('alert_image_size') || '이미지 크기는 10MB 이하여야 합니다.');
      return;
    }

    try {
      setImageUploading(true);
      setUploadingImageFor(detailId);

      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('order_index', 0);

      await plansService.images.uploadImage(detailId, formData);

      // 업로드 성공 후 새로고침
      fetchPlanDetail();
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(t('alert_image_upload_fail') || '이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
      setUploadingImageFor(null);
      // 파일 입력 초기화
      if (fileInputRefs.current[detailId]) {
        fileInputRefs.current[detailId].value = '';
      }
    }
  };

  // 이미지 삭제 핸들러
  const handleImageDelete = async (imageId, event) => {
    event.stopPropagation();

    if (!window.confirm(t('confirm_image_delete') || '이미지를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await plansService.images.deleteImage(imageId);
      fetchPlanDetail();
    } catch (err) {
      console.error('Error deleting image:', err);
      alert(t('alert_image_delete_fail') || '이미지 삭제에 실패했습니다.');
    }
  };

  // 이미지 모달 열기
  const openImageModal = (images, index) => {
    setModalImages(images);
    setModalImageIndex(index);
    setIsModalOpen(true);
  };

  // 이미지 모달 닫기
  const closeImageModal = () => {
    setIsModalOpen(false);
    setModalImages([]);
    setModalImageIndex(0);
  };

  // 이전 이미지
  const showPrevImage = (e) => {
    e.stopPropagation();
    setModalImageIndex((prev) => (prev > 0 ? prev - 1 : modalImages.length - 1));
  };

  // 다음 이미지
  const showNextImage = (e) => {
    e.stopPropagation();
    setModalImageIndex((prev) => (prev < modalImages.length - 1 ? prev + 1 : 0));
  };

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isModalOpen) return;

      if (e.key === 'Escape') {
        closeImageModal();
      } else if (e.key === 'ArrowLeft') {
        setModalImageIndex((prev) => (prev > 0 ? prev - 1 : modalImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setModalImageIndex((prev) => (prev < modalImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, modalImages.length]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-600 dark:text-gray-400">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container mx-auto px-4 max-w-screen-xl py-12">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || t('error_plan_not_found')}</div>
          <button
            onClick={() => navigate('/plans')}
            className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] transition-all"
          >
            {t('btn_back_to_list')}
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
      {/* 이미지 모달 */}
      {isModalOpen && modalImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeImageModal}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 이전 버튼 */}
          {modalImages.length > 1 && (
            <button
              onClick={showPrevImage}
              className="absolute left-4 p-3 text-white hover:text-gray-300 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* 이미지 */}
          <div
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={modalImages[modalImageIndex]?.image_url || modalImages[modalImageIndex]?.image}
              alt={`이미지 ${modalImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>

          {/* 다음 버튼 */}
          {modalImages.length > 1 && (
            <button
              onClick={showNextImage}
              className="absolute right-4 p-3 text-white hover:text-gray-300 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* 이미지 카운터 */}
          {modalImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white rounded-full text-sm">
              {modalImageIndex + 1} / {modalImages.length}
            </div>
          )}
        </div>
      )}
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
                {plan.title_translated || plan.title}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${plan.plan_type === 'ai_recommended'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                {plan.plan_type === 'ai_recommended' ? t('badge_ai') : t('badge_manual')}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {new Date(plan.start_date).toLocaleDateString('ko-KR')} ~ {new Date(plan.end_date).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>

        {(plan.description_translated || plan.description) && (
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {plan.description_translated || plan.description}
          </p>
        )}

        <div className="flex items-center gap-4">
          {isOwner && (
            <>
              <button
                onClick={() => navigate(`/plans/${planId}/edit`)}
                className="h-12 px-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                {t('btn_edit_plan')}
              </button>
              <button
                onClick={() => navigate(`/plans/${planId}/add-place`)}
                className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
              >
                {t('btn_add_place')}
              </button>
            </>
          )}

          {/* 좋아요 버튼 - 공개 일정에만 표시 */}
          {plan.is_public && (
            <button
              onClick={handleLikeToggle}
              disabled={likeLoading}
              className={`flex items-center gap-2 h-12 px-6 rounded-lg font-semibold transition-all ${isLiked
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              <svg
                className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`}
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>{likeCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Tabs */}
      {dates.length > 0 && (
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
            {dates.map((date, index) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-6 py-3 rounded-t-lg font-semibold whitespace-nowrap transition-all ${selectedDate === date
                  ? 'bg-[#1392ec] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                {t('day_label').replace('{day}', index + 1)} ({new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
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
              {dates.length === 0 ? t('msg_no_places_added') : t('msg_no_places_date')}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => navigate(`/plans/${planId}/add-place`)}
              className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] hover:-translate-y-0.5 transition-all"
            >
              {t('btn_add_place')}
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
                              {detail.place_name || t('default_place_name')}
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
                          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 overflow-x-auto items-center">
                              {detail.images && detail.images.map((image, imgIndex) => (
                                <div key={image.id} className="relative group flex-shrink-0">
                                  <img
                                    src={image.image_url || image.image}
                                    alt={t('alt_place_image')?.replace('{index}', image.order_index) || `이미지 ${image.order_index}`}
                                    className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => openImageModal(detail.images, imgIndex)}
                                  />
                                  {/* 삭제 버튼 - 본인 일정일 때만 */}
                                  {isOwner && (
                                    <button
                                      onClick={(e) => handleImageDelete(image.id, e)}
                                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                      title={t('btn_delete') || '삭제'}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}

                              {/* 이미지 추가 버튼 - 본인 일정일 때만 */}
                              {isOwner && (
                                <label
                                  className={`flex-shrink-0 w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1392ec] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                    imageUploading && uploadingImageFor === detail.id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={(el) => { fileInputRefs.current[detail.id] = el; }}
                                    onChange={(e) => handleImageUpload(detail.id, e)}
                                    disabled={imageUploading}
                                  />
                                  {imageUploading && uploadingImageFor === detail.id ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1392ec]"></div>
                                  ) : (
                                    <>
                                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      <span className="text-xs text-gray-400 mt-1">{t('btn_add_image') || '사진 추가'}</span>
                                    </>
                                  )}
                                </label>
                              )}
                            </div>
                          </div>
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
                            title={t('btn_edit')}
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
                            title={t('btn_delete')}
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

      {/* 댓글 섹션 - 공개 일정에만 표시 */}
      {plan.is_public && (
        <div className="mt-12 bg-white dark:bg-[#1e2b36] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {t('comments')} ({comments.length})
          </h2>

          {/* 댓글 작성 폼 */}
          <form onSubmit={handleCommentSubmit} className="mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isAuthenticated ? t('add_comment') : t('placeholder_comment_login')}
                disabled={!isAuthenticated || commentLoading}
                className="flex-1 h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1392ec] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isAuthenticated || commentLoading || !newComment.trim()}
                className="h-12 px-6 rounded-lg bg-[#1392ec] text-white font-semibold hover:bg-[#0f7bc2] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {commentLoading ? t('btn_posting') : t('btn_post')}
              </button>
            </div>
          </form>

          {/* 댓글 목록 */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {t('msg_no_comments')}
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {comment.user_nickname || '익명'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString(language === 'English' ? 'en-US' :
                            language === '日本語' ? 'ja-JP' :
                              language === '中文' ? 'zh-CN' : 'ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1392ec]"
                          />
                          <button
                            onClick={() => handleCommentUpdate(comment.id)}
                            className="px-4 py-2 rounded-lg bg-[#1392ec] text-white text-sm font-semibold hover:bg-[#0f7bc2]"
                          >
                            {t('btn_save')}
                          </button>
                          <button
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingContent('');
                            }}
                            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            {t('btn_cancel')}
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-700 dark:text-gray-300">
                          {comment.content_translated || comment.content}
                        </p>
                      )}
                    </div>

                    {/* 본인 댓글일 때만 수정/삭제 버튼 표시 */}
                    {isAuthenticated && user && comment.user === user.id && editingCommentId !== comment.id && (
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditingContent(comment.content);
                          }}
                          className="p-2 text-gray-500 hover:text-[#1392ec] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('btn_edit')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleCommentDelete(comment.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title={t('btn_delete')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanDetail;
