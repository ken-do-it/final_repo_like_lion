// src/api/placesApi.js
import { placesAxios } from './axios';

// Places API
export const placesApi = {
  // Autocomplete search for places
  autocomplete: (query, limit = 10) =>
    placesAxios.get('/api/v1/places/autocomplete', {
      params: { q: query, limit }
    }),

  // Search places
  search: (query, category = null, city = null) =>
    placesAxios.get('/api/v1/places/search', {
      params: { query, category, city }
    }),

  // Get place detail by API ID
  getDetailByApiId: (placeApiId, provider, name) =>
    placesAxios.get('/api/v1/places/detail', {
      params: { place_api_id: placeApiId, provider, name }
    }),

  // Get place detail by DB ID
  getDetailById: (placeId) =>
    placesAxios.get(`/api/v1/places/${placeId}`),
};

export default placesApi;
