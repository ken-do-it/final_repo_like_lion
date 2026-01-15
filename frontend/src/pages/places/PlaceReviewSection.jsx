import React, { useState, useEffect, useRef } from 'react';
import { placesAxios as api } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const PlaceReviewSection = ({ placeId }) => {
    const { user, isAuthenticated } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [orderBy, setOrderBy] = useState('latest');

    // Review Form State
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Edit Mode State
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [removeImage, setRemoveImage] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch Reviews
    const fetchReviews = async (pageNum = 1, reset = false) => {
        try {
            setLoading(true);
            const response = await api.get(`/places/${placeId}/reviews`, {
                params: {
                    page: pageNum,
                    limit: 10,
                    order_by: orderBy
                }
            });

            if (reset) {
                setReviews(response.data.reviews);
            } else {
                setReviews(prev => [...prev, ...response.data.reviews]);
            }
            setTotal(response.data.total);
        } catch (error) {
            console.error("Failed to fetch reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (placeId) {
            setPage(1);
            fetchReviews(1, true);
        }
    }, [placeId, orderBy]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchReviews(nextPage, false);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setRemoveImage(false); // New image selected, so we are not just removing
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImagePreview(null);
        setRemoveImage(true); // Mark for removal if in edit mode
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleEdit = (review) => {
        setEditingReviewId(review.id);
        setRating(review.rating);
        setContent(review.content);
        setImage(null); // Reset file input
        setImagePreview(review.image_url); // Show existing image
        setRemoveImage(false);
    };

    const handleCancelEdit = () => {
        setEditingReviewId(null);
        setRating(5);
        setContent('');
        setImage(null);
        setImagePreview(null);
        setRemoveImage(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('rating', rating);
            formData.append('content', content);

            if (image) {
                formData.append('image', image);
            }

            if (editingReviewId) {
                // Update (PUT)
                if (removeImage) {
                    formData.append('remove_image', 'true');
                }

                await api.put(`/places/${placeId}/reviews/${editingReviewId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert("리뷰가 수정되었습니다.");
            } else {
                // Create (POST)
                await api.post(`/places/${placeId}/reviews`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert("리뷰가 등록되었습니다.");
            }

            // Reset form
            handleCancelEdit();

            // Refresh list
            setPage(1);
            fetchReviews(1, true);

        } catch (error) {
            console.error("Failed to save review:", error);
            alert(error.response?.data?.detail || "리뷰 저장에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm("정말로 이 리뷰를 삭제하시겠습니까?")) return;

        try {
            await api.delete(`/places/${placeId}/reviews/${reviewId}`);
            alert("리뷰가 삭제되었습니다.");
            // Refresh list
            setPage(1);
            fetchReviews(1, true);
        } catch (error) {
            console.error("Failed to delete review:", error);
            alert("리뷰 삭제에 실패했습니다.");
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                리뷰 <span className="text-[#1392ec]">{total}</span>
            </h2>

            {/* Review Form */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {!isAuthenticated ? (
                    <div className="text-center py-6">
                        <p className="text-gray-500 dark:text-gray-400 mb-2">리뷰를 작성하려면 로그인이 필요합니다.</p>
                        <a href="/login-page" className="text-[#1392ec] font-bold hover:underline">로그인하기</a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {editingReviewId && (
                            <div className="mb-4 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-sm text-blue-600 dark:text-blue-400">
                                <span>✏️ 리뷰 수정 중입니다</span>
                                <button type="button" onClick={handleCancelEdit} className="underline">취소</button>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">별점</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="이 장소에 대한 솔직한 리뷰를 남겨주세요."
                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-[#1392ec] min-h-[100px]"
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    ref={fileInputRef}
                                    className="hidden"
                                    id="review-image-input"
                                />
                                <label
                                    htmlFor="review-image-input"
                                    className="cursor-pointer px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    📷 사진 추가
                                </label>
                                {imagePreview && (
                                    <div className="relative">
                                        <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded" />
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {editingReviewId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        취소
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting || !content.trim()}
                                    className="px-6 py-2 bg-[#1392ec] text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {submitting ? '저장 중...' : (editingReviewId ? '수정 완료' : '리뷰 등록')}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            {/* Filter */}
            <div className="flex justify-end mb-4">
                <select
                    value={orderBy}
                    onChange={(e) => setOrderBy(e.target.value)}
                    className="p-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                >
                    <option value="latest">최신순</option>
                    <option value="rating_desc">별점 높은순</option>
                    <option value="rating_asc">별점 낮은순</option>
                </select>
            </div>

            {/* Review List */}
            <div className="space-y-6">
                {reviews.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        아직 작성된 리뷰가 없습니다. 첫 리뷰를 남겨보세요!
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-100 dark:border-gray-700 pb-6 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-sm">{review.user_nickname || "익명 사용자"}</div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {user && user.id === review.user_id && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(review)}
                                            className="text-xs text-blue-500 hover:underline"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDelete(review.id)}
                                            className="text-xs text-red-500 hover:underline"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex text-yellow-400 text-sm mb-2">
                                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line mb-3">
                                {review.content}
                            </p>

                            {review.image_url && (
                                <div className="mt-2">
                                    <img
                                        src={review.image_url}
                                        alt="Review attachment"
                                        className="max-w-full h-48 object-cover rounded-lg"
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Load More */}
            {reviews.length < total && (
                <div className="mt-6 text-center">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        {loading ? '로딩 중...' : '더 보기'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PlaceReviewSection;
