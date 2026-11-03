import api, { unwrapResponse } from './api';

const institutionService = {
  registerInstitution: async (data) => {
    const response = await api.post('/auth/institutions', data);
    return unwrapResponse(response);
  },

  getInstitutions: async () => {
    const response = await api.get('/auth/institutions');
    return unwrapResponse(response);
  },

  approveInstitution: async (id) => {
    const response = await api.put(`/auth/institutions/${id}/approve`);
    return unwrapResponse(response);
  },
};

export default institutionService;
