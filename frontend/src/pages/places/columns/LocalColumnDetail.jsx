import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalColumnDetail, deleteLocalColumn } from '../../../api/columns';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/ui/Button';

const LocalColumnDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { language } = useLanguage();
    const [column, setColumn] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDetail();
    }, [id, language]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            const data = await getLocalColumnDetail(id, API_LANG_CODES[language] || 'eng_Latn');
            setColumn(data);
        } catch (err) {
            console.error('Failed to fetch column detail:', err);
            setError('칼럼을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('정말로 이 칼럼을 삭제하시겠습니까?')) return;

        try {
            await deleteLocalColumn(id);
            alert('칼럼이 삭제되었습니다.');
            navigate('/local-columns');
        } catch (err) {
            console.error('Failed to delete column:', err);
            alert('삭제에 실패했습니다. 다시 시도해주세요.');
        }
    };

    const handleEdit = () => {
        navigate(`/local-columns/${id}/edit`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1392ec]"></div>
            </div>
        );
    }

    if (error || !column) {
        return (
            <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] flex flex-col items-center justify-center px-4">
                <p className="text-red-500 mb-4">{error || '칼럼을 찾을 수 없습니다.'}</p>
                <Button onClick={() => navigate('/local-columns')} variant="secondary">
                    목록으로 돌아가기
                </Button>
            </div>
        );
    }

    const isAuthor = user && user.id === column.user_id;

    return (
        <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] py-8">
            <article className="max-w-3xl mx-auto bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm overflow-hidden">
                {/* Header Image */}
                <div className="relative h-64 md:h-96 w-full">
                    <img
                        src={column.thumbnail_url}
                        alt={column.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                        <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 leading-tight">
                            {column.title}
                        </h1>
                        <div className="flex items-center text-gray-200 text-sm md:text-base gap-4">
                            <span className="font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                                {column.user_nickname}
                                {column.user_level && (
                                    <span className="text-xs bg-yellow-400/20 text-yellow-200 px-1.5 py-0.5 rounded-full border border-yellow-400/30">
                                        🏅 Lv.{column.user_level}
                                    </span>
                                )}
                            </span>
                            <span>{new Date(column.created_at).toLocaleDateString()}</span>
                            <span>조회 {column.view_count}</span>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-6 md:p-8 space-y-12">
                    {/* Intro */}
                    <section className="prose dark:prose-invert max-w-none">
                        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 font-medium whitespace-pre-line">
                            {column.content}
                        </p>
                        {column.intro_image_url && (
                            <img
                                src={column.intro_image_url}
                                alt="Intro"
                                className="w-full rounded-xl mt-6 shadow-sm"
                            />
                        )}
                    </section>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* Dynamic Sections */}
                    {column.sections && column.sections.map((section, idx) => (
                        <section key={section.id} className="prose dark:prose-invert max-w-none">
                            <h2 className="text-xl md:text-2xl font-bold text-[#1392ec] mb-4 flex items-center gap-2">
                                <span className="text-lg opacity-50">#{idx + 1}</span>
                                {section.title}
                            </h2>

                            {/* Section Images */}
                            {section.images && section.images.length > 0 && (
                                <div className={`grid gap-4 mb-6 ${section.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {section.images.map((img) => (
                                        <img
                                            key={img.id}
                                            src={img.image_url}
                                            alt={section.title}
                                            className="w-full h-auto rounded-xl shadow-sm object-cover aspect-video"
                                        />
                                    ))}
                                </div>
                            )}

                            <p className="whitespace-pre-line text-gray-600 dark:text-gray-300 leading-relaxed">
                                {section.content}
                            </p>

                            {/* Place Badge (If linked) */}
                            {section.place_id && (
                                <div
                                    className="mt-6 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                    onClick={() => navigate(`/places/${section.place_id}`)}
                                >
                                    <span>📍</span>
                                    <span className="text-[#1392ec] font-medium text-sm">장소 정보 보기</span>
                                </div>
                            )}
                        </section>
                    ))}
                </div>

                {/* Footer / Actions */}
                {isAuthor && (
                    <div className="bg-gray-50 dark:bg-[#18222c] px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                        <Button
                            variant="secondary"
                            onClick={handleEdit}
                            className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                        >
                            수정하기
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            삭제하기
                        </Button>
                    </div>
                )}
            </article>

            <div className="max-w-3xl mx-auto mt-8 px-4">
                <Button
                    onClick={() => navigate('/local-columns')}
                    variant="ghost"
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    <span>←</span> 목록으로 돌아가기
                </Button>
            </div>
        </div>
    );
};

export default LocalColumnDetail;
