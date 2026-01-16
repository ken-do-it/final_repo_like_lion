import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import axiosInstance from '../../api/axios';
import './shortspage.css'; // Reusing form styles

const ShortsUploadPage = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // If exists, we are in EDIT mode
    const location = useLocation();
    const { isAuthenticated, user } = useAuth();
    const { t, language } = useLanguage();

    const isEditMode = Boolean(id);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [videoFile, setVideoFile] = useState(null);
    // For previewing existing video or selected file
    const [previewUrl, setPreviewUrl] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fetch existing data if in Edit Mode
    useEffect(() => {
        if (isEditMode) {
            fetchShortDetail();
        }
    }, [isEditMode, id]);

    // Redirect if not logged in
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            alert(t('req_login'));
            navigate('/login-page');
        }
    }, [isAuthenticated, isLoading, navigate, t]);

    const fetchShortDetail = async () => {
        try {
            setIsLoading(true);
            const res = await axiosInstance.get(`/shortforms/${id}/`);
            const data = res.data;

            // Authorization Check: Only owner can edit
            // Assuming data.writer is the username or ID. Adjust based on your API response structure.
            // If the API doesn't return writer info suitable for check here, backend will reject it anyway.
            // checking user match roughly if possible, or relying on backend 403.

            setTitle(data.title || '');
            setDescription(data.content || '');
            setPreviewUrl(data.video_url || '');
        } catch (err) {
            console.error(err);
            setError(t('load_fail'));
            alert(t('load_fail'));
            navigate('/shorts');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', description);

            // If creating, file is required. If editing, file is optional (update only if changed)
            if (videoFile) {
                formData.append('video_file', videoFile);
            }

            if (isEditMode) {
                // PUT or PATCH
                await axiosInstance.put(`/shortforms/${id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert(t('update_success'));
                navigate(`/shorts/${id}`);
            } else {
                // POST
                if (!videoFile) {
                    alert(t('label_video') + " " + t('label_required'));
                    setIsSubmitting(false);
                    return;
                }
                const res = await axiosInstance.post('/shortforms/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert(t('upload_success'));
                navigate('/shorts');
            }

        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.detail || err.message || t('submit_fail');
            setError(msg);
            alert(`Error: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <span className="material-symbols-outlined spin text-4xl text-blue-500">sync</span>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <div className="mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-500 hover:text-gray-800 transition-colors mb-4"
                >
                    <span className="material-symbols-outlined mr-1">arrow_back</span>
                    {t('back')}
                </button>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {isEditMode ? t('upload_title_edit') : t('upload_title_new')}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    {isEditMode ? t('upload_sub_edit') : t('upload_sub_new')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white dark:bg-[#1e2b36] p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">

                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Video Selection Area */}
                <div className="form-group">
                    <label className="form-label mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('label_video')} {isEditMode ? t('label_optional') : t('label_required')}
                    </label>

                    <div className="relative group">
                        <div className={`file-dropzone border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                            ${previewUrl ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-white'}
                        `}>
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                required={!isEditMode && !videoFile} // Required only for creation
                            />

                            {previewUrl ? (
                                <div className="relative w-full aspect-[9/16] max-w-[200px] mx-auto bg-black rounded-lg overflow-hidden shadow-md">
                                    <video src={previewUrl} className="w-full h-full object-cover" controls={false} />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">
                                            {t('video_change')}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                                    <p className="font-medium">{t('video_drag')}</p>
                                    <p className="text-xs text-gray-400">{t('video_format')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {videoFile && (
                        <p className="text-xs text-green-600 mt-2 text-center font-medium">
                            {t('video_selected')}: {videoFile.name}
                        </p>
                    )}
                </div>

                {/* Title Input */}
                <div className="form-group">
                    <label className="form-label mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('label_title')}
                    </label>
                    <input
                        className="form-input w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:bg-gray-800 dark:border-gray-600 outline-none transition-all"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('ph_title')}
                        required
                    />
                </div>

                {/* Description Input */}
                <div className="form-group">
                    <label className="form-label mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('label_desc')}
                    </label>
                    <textarea
                        className="form-textarea w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:bg-gray-800 dark:border-gray-600 outline-none transition-all resize-none"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('ph_desc')}
                        rows="5"
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                    >
                        {t('btn_cancel')}
                    </button>
                    <button
                        type="submit"
                        className={`px-8 py-2.5 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center gap-2
                            ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="material-symbols-outlined spin text-sm">sync</span>
                                {isEditMode ? t('btn_updating') : t('btn_uploading')}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">
                                    {isEditMode ? 'save' : 'rocket_launch'}
                                </span>
                                {isEditMode ? t('btn_save_changes') : t('btn_upload_short')}
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default ShortsUploadPage;
