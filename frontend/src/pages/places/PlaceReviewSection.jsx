import React, { useState, useEffect, useRef } from 'react';
import { placesAxios as api } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_LANG_CODES } from '../../constants/translations';

const PlaceReviewSection = ({ placeId }) => {
    const { user, isAuthenticated } = useAuth();
    const { language, t } = useLanguage();
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
            const langParam = API_LANG_CODES[language] || 'eng_Latn';
            const response = await api.get(`/places/${placeId}/reviews`, {
                params: {
                    page: pageNum,
                    limit: 10,
                    order_by: orderBy,
                    lang: langParam
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
    }, [placeId, orderBy, language]);

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
                alert(t('msg_review_updated'));
            } else {
                // Create (POST)
                await api.post(`/places/${placeId}/reviews`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert(t('msg_review_created'));
            }

            // Reset form
            handleCancelEdit();

            // Refresh list
            setPage(1);
            fetchReviews(1, true);

        } catch (error) {
            console.error("Failed to save review:", error);
            alert(error.response?.data?.detail || t('msg_review_save_failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm(t('msg_confirm_delete_review'))) return;

        try {
            await api.delete(`/places/${placeId}/reviews/${reviewId}`);
            alert(t('msg_review_deleted'));
            // Refresh list
            setPage(1);
            fetchReviews(1, true);
        } catch (error) {
            console.error("Failed to delete review:", error);
            alert(t('msg_review_delete_failed'));
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e2b36] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                {t('label_reviews')} <span className="text-[#1392ec]">{total}</span>
            </h2>

            {/* Review Form */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {!isAuthenticated ? (
                    <div className="text-center py-6">
                        <p className="text-gray-500 dark:text-gray-400 mb-2">{t('msg_login_required_review')}</p>
                        <a href="/login-page" className="text-[#1392ec] font-bold hover:underline">{t('btn_login')}</a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {editingReviewId && (
                            <div className="mb-4 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-sm text-blue-600 dark:text-blue-400">
                                <span>✏️ {t('msg_editing_review')}</span>
                                <button type="button" onClick={handleCancelEdit} className="underline">{t('btn_cancel')}</button>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">{t('label_rating')}</label>
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
                                placeholder={t('placeholder_review_content')}
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
                                    📷 {t('btn_add_photo')}
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
                                        {t('btn_cancel')}
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting || !content.trim()}
                                    className="px-6 py-2 bg-[#1392ec] text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {submitting ? t('msg_saving') : (editingReviewId ? t('btn_update_complete') : t('btn_submit_review'))}
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
                    <option value="latest">{t('sort_latest')}</option>
                    <option value="rating_desc">{t('sort_rating_desc')}</option>
                    <option value="rating_asc">{t('sort_rating_asc')}</option>
                </select>
            </div>

            {/* Review List */}
            <div className="space-y-6">
                {reviews.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        {t('msg_no_reviews')}
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-100 dark:border-gray-700 pb-6 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-sm">{review.user_nickname || t('label_anonymous_user')}</div>
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
                                            {t('btn_edit')}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(review.id)}
                                            className="text-xs text-red-500 hover:underline"
                                        >
                                            {t('btn_delete')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex text-yellow-400 text-sm mb-2">
                                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line mb-3">
                                {review.content_translated || review.content}
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
                        {loading ? t('msg_loading') : t('btn_load_more')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PlaceReviewSection;
