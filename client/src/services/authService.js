import api, { unwrapResponse } from './api';

const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return unwrapResponse(response);
  },

  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return unwrapResponse(response);
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return unwrapResponse(response);
  },

  updateProfile: async (data) => {
    const response = await api.put('/auth/profile', data);
    return unwrapResponse(response);
  },

  getAllUsers: async (page = 1, limit = 10, search = '') => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('q', search);
    const response = await api.get(`/auth/users?${params.toString()}`);
    return unwrapResponse(response);
  },

  updateUserRole: async (userId, role) => {
    const response = await api.put(`/auth/users/${userId}/role`, { role });
    return unwrapResponse(response);
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return unwrapResponse(response);
  },
};

export default authService;
