// src/api/plansApi.js
import axiosInstance from './axios';

// Travel Plan APIs
export const plansApi = {
  // Get all plans
  getPlans: () => axiosInstance.get('/plans/'),

  // Get plan by ID
  getPlanById: (planId) => axiosInstance.get(`/plans/${planId}/`),

  // Create new plan
  createPlan: (data) => axiosInstance.post('/plans/', data),

  // Update plan
  updatePlan: (planId, data) => axiosInstance.put(`/plans/${planId}/`, data),

  // Partial update plan
  patchPlan: (planId, data) => axiosInstance.patch(`/plans/${planId}/`, data),

  // Delete plan
  deletePlan: (planId) => axiosInstance.delete(`/plans/${planId}/`),
};

// Plan Details APIs
export const planDetailsApi = {
  // Get plan details
  getPlanDetails: (planId) => axiosInstance.get(`/plans/${planId}/details/`),

  // Add place to plan
  addPlaceToplan: (planId, data) => axiosInstance.post(`/plans/${planId}/details/`, data),

  // Get detail by ID
  getDetailById: (detailId) => axiosInstance.get(`/plans/details/${detailId}/`),

  // Update detail
  updateDetail: (detailId, data) => axiosInstance.put(`/plans/details/${detailId}/`, data),

  // Partial update detail
  patchDetail: (detailId, data) => axiosInstance.patch(`/plans/details/${detailId}/`, data),

  // Delete detail
  deleteDetail: (detailId) => axiosInstance.delete(`/plans/details/${detailId}/`),
};

// Plan Detail Images APIs
export const planImagesApi = {
  // Get images for detail
  getDetailImages: (detailId) => axiosInstance.get(`/plans/details/${detailId}/images/`),

  // Upload image
  uploadImage: (detailId, formData) => {
    return axiosInstance.post(`/plans/details/${detailId}/images/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get image by ID
  getImageById: (imageId) => axiosInstance.get(`/plans/images/${imageId}/`),

  // Update image
  updateImage: (imageId, formData) => {
    return axiosInstance.put(`/plans/images/${imageId}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Delete image
  deleteImage: (imageId) => axiosInstance.delete(`/plans/images/${imageId}/`),
};

// AI Travel Request APIs
export const aiTravelApi = {
  // Create AI travel request
  createAIRequest: (data) => axiosInstance.post('/plans/ai/request/', data),

  // Get AI request by ID
  getAIRequestById: (requestId) => axiosInstance.get(`/plans/ai/request/${requestId}/`),

  // Get all AI requests (with optional filters)
  getAIRequests: (params) => axiosInstance.get('/plans/ai/requests/', { params }),
};

// Like APIs
export const planLikesApi = {
  // Get like status
  getLikeStatus: (planId) => axiosInstance.get(`/plans/${planId}/like/`),

  // Toggle like
  toggleLike: (planId) => axiosInstance.post(`/plans/${planId}/like/`),
};

// Comment APIs
export const planCommentsApi = {
  // Get comments for plan
  getComments: (planId) => axiosInstance.get(`/plans/${planId}/comments/`),

  // Create comment
  createComment: (planId, data) => axiosInstance.post(`/plans/${planId}/comments/`, data),

  // Update comment
  updateComment: (commentId, data) => axiosInstance.put(`/plans/comments/${commentId}/`, data),

  // Delete comment
  deleteComment: (commentId) => axiosInstance.delete(`/plans/comments/${commentId}/`),
};

// Export all as a single object
const plansService = {
  plans: plansApi,
  details: planDetailsApi,
  images: planImagesApi,
  ai: aiTravelApi,
  likes: planLikesApi,
  comments: planCommentsApi,
};

export default plansService;
