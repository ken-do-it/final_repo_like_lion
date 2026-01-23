import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext'
import { API_LANG_CODES } from '../../constants/translations';
import axiosInstance from '../../api/axios';
import './shortsDetailpage.css';

const uiGlossary = {
    play: { kor_Hang: '재생', jpn_Jpan: '再生', zho_Hans: '播放' },
    upload: { kor_Hang: '업로드', jpn_Jpan: 'アップロード', zho_Hans: '上传' },
    shortsTitle: { kor_Hang: '쇼츠', jpn_Jpan: 'ショート', zho_Hans: '短视频' },
    shortsSub: {
        kor_Hang: '최신 업로드를 AI 캡션/번역으로 보세요.',
        jpn_Jpan: '最新アップロードをAI字幕/翻訳で見ましょう。',
        zho_Hans: '查看带AI字幕/翻译的最新上传。',
    },
    nowPlaying: { kor_Hang: '재생 중', jpn_Jpan: '再生中', zho_Hans: '正在播放' },
    langLabel: { kor_Hang: '언어', jpn_Jpan: '言語', zho_Hans: '语言' },
    loading: { kor_Hang: '로딩 중...', jpn_Jpan: '読み込み中...', zho_Hans: '加载中...' },
    noShorts: {
        kor_Hang: '준비된 쇼츠가 없습니다.',
        jpn_Jpan: '準備されたショート動画がありません。',
        zho_Hans: '没有准备好的短视频。',
    },
    batchLabel: { kor_Hang: '배치 최적화', jpn_Jpan: 'バッチ最適化', zho_Hans: '批量优化' },
    close: { kor_Hang: '닫기', jpn_Jpan: '閉じる', zho_Hans: '关闭' },
    follow: { kor_Hang: '팔로우', jpn_Jpan: 'フォロー', zho_Hans: '关注' },
    share: { kor_Hang: '공유', jpn_Jpan: '共有', zho_Hans: '分享' },
    save: { kor_Hang: '저장', jpn_Jpan: '保存', zho_Hans: '保存' },
    aiInsight: { kor_Hang: 'AI 인사이트', jpn_Jpan: 'AI インサイト', zho_Hans: 'AI 见解' },
    wantToVisit: { kor_Hang: '이곳에 가고 싶으신가요?', jpn_Jpan: 'ここに行きたいですか？', zho_Hans: '想去这里吗？' },
    aiSuggest: { kor_Hang: 'AI가 당신을 위한 여행 계획을 제안합니다.', jpn_Jpan: 'AIがあなたのための旅行プランを提案します。', zho_Hans: 'AI为你提供旅行建议。' },
    addToTrip: { kor_Hang: '여행에 추가', jpn_Jpan: '旅行に追加', zho_Hans: '添加到行程' },
    comments: { kor_Hang: '댓글', jpn_Jpan: 'コメント', zho_Hans: '评论' },
    addComment: { kor_Hang: '댓글 추가...', jpn_Jpan: 'コメントを追加...', zho_Hans: '添加评论...' },
}

const baseTexts = {
    shortsTitle: 'Shorts',
    shortsSub: 'Watch the latest uploads with AI captions/translation.',
    play: 'Play',
    upload: 'Upload',
    durationMissing: '00:00',
    langLabel: 'Lang',
    nowPlaying: 'Now Playing',
    loading: 'Loading...',
    noShorts: 'No shorts available.',
    batchLabel: 'Batch Optimization',
    close: 'Close',
    follow: 'Follow',
    share: 'Share',
    save: 'Save',
    aiInsight: 'AI Insight',
    wantToVisit: 'Want to visit here?',
    aiSuggest: 'AI suggests a travel plan for you.',
    addToTrip: 'Add to Trip',
    comments: 'Comments',
    addComment: 'Add a comment...',
}

const mockDataMap = {
    eng_Latn: {
        creator: { name: 'Traveler_Jane', location: 'Seoul, Korea', time: '2h ago', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
        hashtags: '#Seoul #Travel #Vlog',
        comments: [
            { user: 'Mike', time: '1h', text: 'Amazing view!' },
            { user: 'Sarah', time: '30m', text: 'I want to go there too.' }
        ]
    },
    kor_Hang: {
        creator: { name: '여행자_제인', location: '서울, 한국', time: '2시간 전', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
        hashtags: '#서울 #여행 #브이로그',
        comments: [
            { user: '마이크', time: '1시간', text: '정말 멋진 풍경이네요!' },
            { user: '사라', time: '30분', text: '저도 가보고 싶어요.' }
        ]
    },
    jpn_Jpan: {
        creator: { name: 'トラベラー_ジェーン', location: 'ソウル, 韓国', time: '2時間前', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
        hashtags: '#ソウル #旅行 #Vlog',
        comments: [
            { user: 'マイク', time: '1時間', text: '素晴らしい景色ですね！' },
            { user: 'サラ', time: '30分', text: '私も行ってみたいです。' }
        ]
    },
    zho_Hans: {
        creator: { name: '旅行者_简', location: '首尔, 韩国', time: '2小时前', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
        hashtags: '#首尔 #旅行 #Vlog',
        comments: [
            { user: '迈克', time: '1小时', text: '景色真美！' },
            { user: '萨拉', time: '30分钟', text: '我也想去那里。' }
        ]
    }
}

function ShortsDetailPage({ videoId: propVideoId, onBack }) {
    const { id: paramId } = useParams()
    const navigate = useNavigate()
    const id = propVideoId || paramId
    const { language } = useLanguage()

    const langCode = API_LANG_CODES[language] || 'eng_Latn'
    const t = useMemo(() => {
        const map = { ...baseTexts }
        if (langCode !== 'eng_Latn') {
            Object.keys(baseTexts).forEach((key) => {
                const translated = uiGlossary[key]?.[langCode]
                if (translated) map[key] = translated
            })
        }
        return map
    }, [langCode])

    const mockData = useMemo(() => mockDataMap[langCode] || mockDataMap.eng_Latn, [langCode])

    const [shortform, setShortform] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Like State
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);



    const { user, isAuthenticated } = useAuth()

    // Comment State
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");

    // Comment Edit State
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editContent, setEditContent] = useState("");

    // Fetch Comments
    const fetchComments = React.useCallback(async () => {
        try {
            const response = await axiosInstance.get(`/shortforms/${id}/comments/`, {
                params: { lang: langCode }
            });
            setComments(response.data);
        } catch (error) {
            console.error("Failed to fetch comments:", error);
        }
    }, [id, langCode]);

    useEffect(() => {
        if (id) {
            fetchComments();
        }
    }, [fetchComments, id]);

    // Handle Comment Submit
    const handleCommentSubmit = async () => {
        if (!newComment.trim()) return;
        if (!isAuthenticated) {
            alert("Please login to comment.");
            return;
        }

        try {
            await axiosInstance.post(`/shortforms/${id}/comments/`, {
                content: newComment
            });
            setNewComment("");
            fetchComments(); // Refresh list
        } catch (error) {
            console.error("Failed to post comment:", error);
            alert("Failed to post comment.");
        }
    };

    // Handle Comment Delete
    const handleDeleteComment = async (commentId) => {
        if (!confirm("Delete this comment?")) return;
        try {
            await axiosInstance.delete(`/comments/${commentId}/`);
            fetchComments();
        } catch (error) {
            console.error("Failed to delete comment:", error);
            alert("Failed to delete comment.");
        }
    };

    // Handle Comment Update
    const startEdit = (comment) => {
        setEditingCommentId(comment.id);
        setEditContent(comment.content);
    };

    const cancelEdit = () => {
        setEditingCommentId(null);
        setEditContent("");
    };

    const handleUpdateComment = async (commentId) => {
        if (!editContent.trim()) return;
        try {
            await axiosInstance.patch(`/comments/${commentId}/`, {
                content: editContent
            });
            setEditingCommentId(null);
            setEditContent("");
            fetchComments();
        } catch (error) {
            console.error("Failed to update comment:", error);
            alert("Failed to update comment.");
        }
    };

    const fetchDetail = async () => {
        try {
            setLoading(true)
            setError('')
            const res = await axiosInstance.get(`/shortforms/${id}/`, {
                params: { lang: langCode }
            })
            const item = res.data
            setShortform({
                id: item.id,
                title: item.title_translated || item.title || 'Untitled',
                desc: item.content_translated || item.content || '',
                thumb: item.thumbnail_url,
                video: item.video_url,
                lang: item.source_lang || 'N/A',
                location: item.location || '', // Add location field
                location_translated: item.location_translated || '',
                ownerId: item.user,
                // Add Creator Info
                creatorName: item.nickname || item.username || `User ${item.user}`,
                creatorAvatar: item.profile_image_url,
                totalComments: item.total_comments,
                prevId: item.prev_id,
                nextId: item.next_id,
            })
            // Initialize Like State
            setLiked(item.is_liked)
            setLikeCount(item.total_likes)

        } catch (err) {
            setError(err.response?.data?.detail || err.message)
        } finally {
            setLoading(false)
        }
    }

    // Like Handlers


    const handleLikeToggle = async () => {
        if (!isAuthenticated) {
            alert("Please login to like.");
            return;
        }

        // Optimistic UI Update
        const prevLiked = liked;
        const prevCount = likeCount;

        setLiked(!prevLiked);
        setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);

        try {
            if (prevLiked) {
                await axiosInstance.delete(`/shortforms/${id}/unlike/`);
            } else {
                await axiosInstance.post(`/shortforms/${id}/like/`);
            }
        } catch (error) {
            console.error("Like toggle failed:", error);
            // Revert on error
            setLiked(prevLiked);
            setLikeCount(prevCount);
        }
    };




    useEffect(() => {
        if (id) {
            fetchDetail()
            // Increment view count
            axiosInstance.post(`/shortforms/${id}/view/`)
                .catch(err => console.error("Failed to increment view count:", err));
        }
    }, [id, langCode])

    const handleBack = () => {
        if (onBack) {
            onBack()
        } else {
            navigate('/shorts')
        }
    }

    // Get current user ID from AuthContext (handling differences in user object structure)
    const currentUserId = useMemo(() => {
        if (!user) return null
        return user.user_id || user.id || user.pk
    }, [user])



    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this short?")) return

        try {
            await axiosInstance.delete(`/shortforms/${id}/`)
            alert("Deleted successfully")
            handleBack()
        } catch (e) {
            alert("Error deleting: " + (e.response?.data?.detail || e.message))
        }
    }

    if (loading) {
        return (
            <div className="shorts-detail-container flex items-center justify-center">
                {t.loading}
            </div>
        )
    }
    if (error) {
        return (
            <div className="shorts-detail-container flex items-center justify-center text-red-500">
                Error: {error}
            </div>
        )
    }
    if (!shortform) return null

    // Determine if embed view (no navbar padding, simplified layout) or full page
    const isEmbed = !!propVideoId;

    return (
        <div className={`shorts-detail-container ${isEmbed ? 'embed-view' : ''}`}>
            {/* Navbar Removed - Handled by Global Layout (App.jsx) */}
            {/* {!isEmbed && <Navbar toggleSidebar={() => { }} />} */}

            <div className="detail-content-wrapper">
                {/* Left Column: Video Player */}
                <div className="player-wrapper relative group">
                    {/* Left Button -> Next Video (Newer) */}
                    {shortform.nextId && (
                        <button
                            onClick={() => navigate(`/shorts/${shortform.nextId}`)}
                            className="absolute -left-18 md:-left-24 top-1/2 -translate-y-1/2 p-2 
                                       text-gray-400 hover:text-gray-700 
                                       transition-colors z-30 md:drop-shadow-none"
                            title="Next Video"
                        >
                            <span className="material-symbols-outlined !text-6xl md:!text-6xl font-light">chevron_left</span>
                        </button>
                    )}

                    {/* Video Container (Clipped) */}
                    <div className="w-full h-full rounded-2xl overflow-hidden relative shadow-2xl bg-black z-10">
                        <video controls poster={shortform.thumb} className="w-full h-full object-cover">
                            <source src={shortform.video} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    {/* Right Button -> Previous Video (Older) */}
                    {shortform.prevId && (
                        <button
                            onClick={() => navigate(`/shorts/${shortform.prevId}`)}
                            className="absolute -right-18 md:-right-24 top-1/2 -translate-y-1/2 p-2 
                                       text-gray-400 hover:text-gray-700 
                                       transition-colors z-30 md:drop-shadow-none"
                            title="Previous Video"
                        >
                            <span className="material-symbols-outlined !text-6xl md:!text-6xl font-light">chevron_right</span>
                        </button>
                    )}
                </div>

                {/* Right Column: Sidebar */}
                <div className="detail-sidebar">

                    {/* Top Navigation / Title Row */}
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold leading-tight">{shortform.title}</h1>

                        <button onClick={handleBack} className="btn-close">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Creator Card */}
                    <div className="creator-card">
                        <img
                            src={shortform.creatorAvatar || `https://ui-avatars.com/api/?name=${shortform.creatorName}&background=random&size=128`}
                            alt="Creator"
                            className="creator-avatar"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${shortform.creatorName}&background=random&size=128`;
                            }}
                        />
                        <div className="creator-info">
                            <h3>{shortform.creatorName}</h3>
                            <p>
                                <span><span className="mr-1 font-bold text-sm text-blue-500">#</span></span>
                                {shortform.location_translated || shortform.location || '#Seoul'} · {mockData.creator.time}
                            </p>
                        </div>
                        <button className="btn-follow">{t.follow}</button>
                    </div>

                    {/* Editing Controls (Owner Only) - Refactored */}
                    {currentUserId && shortform.ownerId === currentUserId && (
                        <div className="flex gap-4 justify-end items-center">
                            <button
                                onClick={() => navigate(`/shorts/${id}/edit`)}
                                className="text-sm font-semibold text-gray-500 hover:text-blue-500 transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                                Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                className="text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                                Delete
                            </button>
                        </div>
                    )}

                    {/* Description & Hashtags */}
                    <div className="video-desc">
                        {shortform.desc}
                        {/* <div className="video-hashtags">{mockData.hashtags}</div> */}
                    </div>

                    {/* Stats Row */}
                    <div className="stats-row">
                        <div className="stat-item" onClick={handleLikeToggle}>
                            <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors group ${liked ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                <span
                                    className={`text-2xl transition-colors ${liked ? 'text-red-500' : 'group-hover:text-red-500'}`}
                                    style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                    ♥
                                </span>
                            </button>
                            <span className={`font-medium ml-2 ${liked ? 'text-red-500' : ''}`}>{likeCount}</span>
                        </div>
                        <div className="stat-item">
                            <span className="material-symbols-outlined">chat_bubble</span> {shortform.totalComments || 0}
                        </div>
                        <div className="stat-item">
                            <span className="material-symbols-outlined">share</span> {t.share}
                        </div>
                        <div className="stat-item">
                            <span className="material-symbols-outlined">bookmark</span> {t.save}
                        </div>
                    </div>

                    {/* AI Insight Card */}
                    <div className="ai-card">
                        <div className="ai-header">
                            <span className="material-symbols-outlined">auto_awesome</span>
                            {t.aiInsight}
                        </div>
                        <div className="ai-title">{t.wantToVisit}</div>
                        <div className="ai-desc">{t.aiSuggest}</div>
                        <button
                            className="btn-ai-action"
                            onClick={() => navigate('/plans')}
                        >
                            {t.addToTrip} <span className="material-symbols-outlined">add_circle</span>
                        </button>
                    </div>

                    {/* Comments Section */}
                    <div>
                        <div className="comments-header">
                            {t.comments} ({comments.length})
                        </div>

                        <div className="max-h-60 overflow-y-auto mb-4">
                            {comments.length === 0 ? (
                                <p className="text-gray-400 text-sm py-2">No comments yet.</p>
                            ) : (
                                comments.map((comment) => (
                                    <div className="comment-item" key={comment.id}>
                                        <img
                                            src={comment.profile_image_url || `https://ui-avatars.com/api/?name=${comment.nickname || comment.username || comment.user_id || 'User'}&background=random&size=32`}
                                            alt="User"
                                            className="comment-avatar"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = `https://ui-avatars.com/api/?name=${comment.nickname || comment.username || comment.user_id || 'User'}&background=random&size=32`;
                                            }}
                                        />
                                        <div className="comment-content w-full">
                                            <div className="flex justify-between items-start">
                                                <div className="comment-meta">
                                                    <span className="comment-user">{comment.nickname || comment.username || `User ${comment.user}`}</span>
                                                    <span className="comment-time">
                                                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Owner Actions */}
                                                {currentUserId && comment.user === currentUserId && !editingCommentId && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => startEdit(comment)} className="text-xs text-gray-400 hover:text-blue-500">Edit</button>
                                                        <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Edit Mode vs View Mode */}
                                            {editingCommentId === comment.id ? (
                                                <div className="mt-1 flex flex-col gap-2">
                                                    <input
                                                        type="text"
                                                        className="border border-gray-300 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white w-full"
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateComment(comment.id)}
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={cancelEdit} className="text-xs text-gray-500">Cancel</button>
                                                        <button onClick={() => handleUpdateComment(comment.id)} className="text-xs text-blue-500 font-bold">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="comment-text">{comment.content_translated || comment.content}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="comment-input-area">
                            <input
                                type="text"
                                className="comment-input"
                                placeholder={t.addComment}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                            />
                            <button className="btn-send" onClick={handleCommentSubmit}>
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}

export default ShortsDetailPage
