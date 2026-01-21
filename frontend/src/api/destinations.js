import { placesAxios } from './axios';

// 인기 도시 목록 조회
export const getPopularCities = async () => {
    const response = await placesAxios.get('/places/destinations/popular');
    return response.data;
};

// 도시별 통합 콘텐츠 조회
// 반환: places(15), local_columns(15), shortforms(15), travel_plans(15)
export const getCityContent = async (cityName) => {
    const encodedCity = encodeURIComponent(cityName);
    const response = await placesAxios.get(`/places/destinations/${encodedCity}`);
    return response.data;
};
