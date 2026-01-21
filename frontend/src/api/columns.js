import { placesAxios } from './axios';

// ==================== 조회 API ====================

// 현지인 칼럼 목록 조회
export const getLocalColumns = async ({ city, page = 1, limit = 20, lang }) => {
    const params = { page, limit };
    if (city) params.city = city;
    if (lang) params.lang = lang;

    const response = await placesAxios.get('/places/local-columns', { params });
    return response.data;
};

// 현지인 칼럼 상세 조회
export const getLocalColumnDetail = async (columnId, lang) => {
    const params = {};
    if (lang) params.lang = lang;
    const response = await placesAxios.get(`/places/local-columns/${columnId}`, { params });
    return response.data;
};

// 현지인 뱃지 상태 조회 (권한 체크용)
export const getBadgeStatus = async () => {
    const response = await placesAxios.get('/places/local-badge/status');
    return response.data;
};

// ==================== 작성/수정/삭제 API ====================

// 현지인 칼럼 작성
export const createLocalColumn = async (formData) => {
    // FormData 사용 시 Content-Type 헤더를 설정하지 않아야 axios가 boundary를 자동으로 추가함
    const response = await placesAxios.post('/places/local-columns', formData);
    return response.data;
};

// 현지인 칼럼 수정
export const updateLocalColumn = async (columnId, formData) => {
    // FormData 사용 시 Content-Type 헤더를 설정하지 않아야 axios가 boundary를 자동으로 추가함
    const response = await placesAxios.put(`/places/local-columns/${columnId}`, formData);
    return response.data;
};

// 현지인 칼럼 삭제
export const deleteLocalColumn = async (columnId) => {
    const response = await placesAxios.delete(`/places/local-columns/${columnId}`);
    return response.data;
};

// 권한 체크 헬퍼 함수
export const checkColumnPermission = async () => {
    try {
        const badge = await getBadgeStatus();
        if (!badge.is_active) {
            return { allowed: false, reason: 'badge_inactive', message: '현지인 뱃지가 활성화되어 있지 않습니다.' };
        }
        if (badge.level < 3) {
            return { allowed: false, reason: 'level_low', message: `현지인 레벨 3부터 작성 가능합니다. (현재 레벨: ${badge.level})` };
        }
        return { allowed: true };
    } catch (error) {
        console.error('Failed to check permission:', error);
        return { allowed: false, reason: 'error', message: '권한 정보를 확인할 수 없습니다.' };
    }
};
