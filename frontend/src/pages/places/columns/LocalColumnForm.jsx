import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createLocalColumn, updateLocalColumn, getLocalColumnDetail } from '../../../api/columns';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext'; // Added
import Button from '../../../components/ui/Button';
import PlaceAutosuggest from './PlaceAutosuggest';

const LocalColumnForm = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // If id exists, it's edit mode
    const isEditMode = !!id;
    const { t } = useLanguage(); // Added hook

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(''); // Intro content
    const [thumbnail, setThumbnail] = useState(null); // { file, preview, isExisting }
    const [introImage, setIntroImage] = useState(null); // { file, preview, isExisting }

    // Sections State: [{ id, title, content, placeId, images: [{ id, file, preview, url, isExisting }] }]
    const [sections, setSections] = useState([
        { id: Date.now(), title: '', content: '', place: null, images: [] } // Changed placeId to place
    ]);

    // Validation
    const [titleError, setTitleError] = useState('');

    useEffect(() => {
        if (isEditMode) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            const data = await getLocalColumnDetail(id);
            console.log('[LocalColumnForm] Loaded data:', data);
            console.log('[LocalColumnForm] Sections:', data.sections);
            setTitle(data.title);
            setContent(data.content);
            if (data.thumbnail_url) {
                setThumbnail({ preview: data.thumbnail_url, isExisting: true, url: data.thumbnail_url });
            }
            if (data.intro_image_url) {
                setIntroImage({ preview: data.intro_image_url, isExisting: true, url: data.intro_image_url });
            }

            // Map sections
            const mappedSections = data.sections.map(sec => ({
                id: sec.id,
                title: sec.title,
                content: sec.content,
                place: sec.place_id ? { id: sec.place_id, name: sec.place_name || '' } : null, // Store place object
                images: sec.images.map(img => ({
                    id: img.id,
                    preview: img.image_url,
                    url: img.image_url,
                    isExisting: true
                }))
            }));
            setSections(mappedSections);

        } catch (error) {
            console.error('Failed to load column:', error);
            alert(t('msg_load_fail')); // Translated
            navigate('/local-columns');
        } finally {
            setInitialLoading(false);
        }
    };

    // Handlers
    const handleImageUpload = (e, type, sectionIndex = null) => {
        const file = e.target.files[0];
        if (!file) return;

        const preview = URL.createObjectURL(file);
        const imageObj = { id: Date.now(), file, preview, isExisting: false };

        if (type === 'thumbnail') {
            setThumbnail(imageObj);
        } else if (type === 'intro') {
            setIntroImage(imageObj);
        } else if (type === 'section') {
            const newSections = [...sections];
            newSections[sectionIndex].images.push(imageObj);
            setSections(newSections);
        }
    };

    const removeImage = (type, sectionIndex = null, imageIndex = null) => {
        if (type === 'thumbnail') {
            setThumbnail(null);
        } else if (type === 'intro') {
            setIntroImage(null);
        } else if (type === 'section') {
            const newSections = [...sections];
            newSections[sectionIndex].images.splice(imageIndex, 1);
            setSections(newSections);
        }
    };

    const addSection = () => {
        setSections([
            ...sections,
            { id: Date.now(), title: '', content: '', place: null, images: [] } // Changed placeId to place
        ]);
    };

    const removeSection = (index) => {
        if (sections.length === 1) {
            alert(t('err_section_min')); // Translated
            return;
        }
        const newSections = [...sections];
        newSections.splice(index, 1);
        setSections(newSections);
    };

    const updateSection = (index, field, value) => {
        const newSections = [...sections];
        newSections[index][field] = value;
        setSections(newSections);
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setTitleError(t('err_title_req')); // Translated
            window.scrollTo(0, 0);
            return;
        }
        if (!thumbnail) {
            alert(t('err_thumb_req')); // Translated
            return;
        }

        setLoading(true);
        const formData = new FormData();

        // 1. Basic Fields
        formData.append('title', title);
        formData.append('content', content);

        // 2. Images (Thumbnail & Intro)
        if (thumbnail && !thumbnail.isExisting) {
            formData.append('thumbnail', thumbnail.file);
        }

        if (introImage && !introImage.isExisting) {
            formData.append('intro_image', introImage.file);
        } else if (isEditMode && !introImage) {
            formData.append('remove_intro_image', 'true');
        }

        // 3. Sections JSON & Images
        const sectionsMetadata = sections.map((sec, idx) => {
            const meta = {
                title: sec.title,
                content: sec.content,
                order: idx,
                place_id: sec.place?.id || null,             // Restored place_id (DB ID)
                place_api_id: sec.place?.place_api_id || null,
                place_name: sec.place?.name || null,
                keep_images: [] // For edit mode
            };

            // Process Images
            let newImgCount = 0;
            sec.images.forEach((img) => {
                if (img.isExisting) {
                    meta.keep_images.push(img.url);
                } else {
                    console.log(`[LocalColumnForm] Appending section_${idx}_image_${newImgCount}:`, img.file);
                    formData.append(`section_${idx}_image_${newImgCount}`, img.file);
                    newImgCount++;
                }
            });
            console.log(`[LocalColumnForm] Section ${idx} - newImgCount: ${newImgCount}, keepImages: ${meta.keep_images.length}`);

            return meta;
        });

        formData.append('sections', JSON.stringify(sectionsMetadata));
        console.log('[LocalColumnForm] sectionsMetadata:', sectionsMetadata);

        try {
            if (isEditMode) {
                await updateLocalColumn(id, formData);
                alert(t('msg_col_updated')); // Translated
            } else {
                await createLocalColumn(formData);
                alert(t('msg_col_created')); // Translated
            }
            navigate('/local-columns');
        } catch (error) {
            console.error('Submit failed:', error);
            const msg = error.response?.data?.detail || t('msg_save_fail'); // Translated fallback
            alert(msg);
        } finally {
            setLoading(false);
        }
    };


    if (initialLoading) {
        return <div className="p-8 text-center">{t('msg_loading')}</div>; // Translated
    }

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] py-8 pb-20">
            <div className="max-w-3xl mx-auto bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm p-6 md:p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
                    {isEditMode ? t('col_edit_title') : t('col_write_title')}
                </h1>

                <div className="space-y-8">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('col_input_title')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (e.target.value) setTitleError('');
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-[#1392ec] outline-none transition-all dark:text-white"
                            placeholder={t('col_input_title_ph')}
                        />
                        {titleError && <p className="text-red-500 text-sm mt-1">{titleError}</p>}
                    </div>

                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('col_input_thumb')} <span className="text-red-500">*</span>
                        </label>
                        {thumbnail ? (
                            <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden group">
                                <img src={thumbnail.preview} alt="Thumbnail" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => removeImage('thumbnail')}
                                        className="bg-red-500 text-white px-4 py-2 rounded-full text-sm hover:bg-red-600"
                                    >
                                        {t('btn_delete')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-[#1392ec] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <span className="text-3xl mb-2">🖼️</span>
                                    <p className="text-sm text-gray-500">{t('col_upload_thumb')}</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'thumbnail')} />
                            </label>
                        )}
                    </div>

                    {/* Intro Content */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('col_input_intro')}
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-[#1392ec] outline-none transition-all dark:text-white resize-none"
                            placeholder={t('col_input_intro_ph')}
                        />
                    </div>

                    {/* Intro Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('col_input_intro_img')}
                        </label>
                        {introImage ? (
                            <div className="relative w-full h-48 rounded-xl overflow-hidden group">
                                <img src={introImage.preview} alt="Intro" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={() => removeImage('intro')} className="bg-red-500 text-white px-4 py-2 rounded-full text-sm">{t('btn_delete')}</button>
                                </div>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center w-full h-24 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                <span className="text-gray-500 text-sm">➕ {t('col_intro_img_add')}</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'intro')} />
                            </label>
                        )}
                    </div>

                    <hr className="border-gray-100 dark:border-gray-700 my-8" />

                    {/* Sections */}
                    <div className="space-y-8">
                        {sections.map((section, idx) => (
                            <div key={section.id} className="bg-gray-50 dark:bg-[#18222c] rounded-xl p-6 relative border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-[#1392ec]">{t('col_section_n')} #{idx + 1}</h3>
                                    {sections.length > 1 && (
                                        <button onClick={() => removeSection(idx)} className="text-red-500 text-sm hover:underline">
                                            {t('btn_del_section')}
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSection(idx, 'title', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1e2b36] focus:ring-1 focus:ring-[#1392ec] dark:text-white"
                                        placeholder={t('col_input_subtitle_ph')}
                                    />

                                    <textarea
                                        value={section.content}
                                        onChange={(e) => updateSection(idx, 'content', e.target.value)}
                                        rows={5}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1e2b36] focus:ring-1 focus:ring-[#1392ec] dark:text-white resize-none"
                                        placeholder={t('col_input_content_ph')}
                                    />

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">📍 {t('col_related_place')}:</span>
                                            <PlaceAutosuggest
                                                value={section.place} // Pass the whole object
                                                onChange={(newPlace) => updateSection(idx, 'place', newPlace)}
                                                placeholder={t('col_place_ph')}
                                            />
                                        </div>

                                    </div>

                                    {/* Section Images */}
                                    <div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            {section.images.map((img, imgIdx) => (
                                                <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden group">
                                                    <img src={img.preview} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button onClick={() => removeImage('section', idx, imgIdx)} className="text-white bg-red-500 p-1 rounded-full text-xs">✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                            <label className="aspect-video flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                                                <span className="text-2xl text-gray-400">+</span>
                                                <input type="file" className="hidden" accept="image/*" onClick={(e) => { e.target.value = null; }} onChange={(e) => handleImageUpload(e, 'section', idx)} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button
                        onClick={addSection}
                        variant="secondary"
                        className="w-full py-4 border-dashed border-2 border-gray-300 hover:border-[#1392ec] hover:text-[#1392ec]"
                    >
                        + {t('btn_add_section')}
                    </Button>

                    <div className="flex gap-4 pt-8">
                        <Button
                            onClick={() => navigate('/local-columns')}
                            variant="secondary"
                            className="flex-1"
                        >
                            {t('btn_cancel')}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            isLoading={loading}
                            className="flex-1 bg-[#1392ec] hover:bg-blue-600 text-white"
                        >
                            {isEditMode ? t('btn_submit_edit') : t('btn_submit_create')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocalColumnForm;
