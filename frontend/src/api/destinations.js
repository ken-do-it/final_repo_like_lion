import { placesAxios } from './axios';

const getLangCode = (langName) => {
    const map = {
        'Korean': 'ko',
        '한국어': 'ko',
        'English': 'en',
        'Japanese': 'jp',
        '日本語': 'jp',
        'Chinese': 'zh',
        '中文': 'zh'
    };
    return map[langName] || 'ko';
};

// 인기 도시 목록 조회
export const getPopularCities = async (lang = 'Korean') => {
    const code = getLangCode(lang);
    const response = await placesAxios.get(`/places/destinations/popular?target_lang=${code}`);
    return response.data;
};

// 도시별 통합 콘텐츠 조회
// 반환: places(15), local_columns(15), shortforms(15), travel_plans(15)
export const getCityContent = async (cityName, lang = 'Korean') => {
    const code = getLangCode(lang);
    const encodedCity = encodeURIComponent(cityName);
    const response = await placesAxios.get(`/places/destinations/${encodedCity}?target_lang=${code}`);
    return response.data;
};
