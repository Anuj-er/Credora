import api, { unwrapResponse } from './api';

const certificateService = {
  issueCertificate: async (data) => {
    const response = await api.post('/certificates/issue', data);
    return unwrapResponse(response);
  },

  previewCertificatePdf: async (data, signal) => api.post('/certificates/preview', data, {
    responseType: 'blob',
    signal,
  }),

  verifyCertificate: async (certId) => {
    const response = await api.get(`/certificates/verify/${certId}`);
    return unwrapResponse(response);
  },

  getCertificate: async (certId) => {
    const response = await api.get(`/certificates/${certId}`);
    return unwrapResponse(response);
  },

  downloadCertificatePdf: async (certId) => {
    const response = await certificateService.getCertificatePdfBlob(certId);
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },

  getCertificatePdfBlob: async (certId) => api.get(`/certificates/${certId}/pdf`, { responseType: 'blob' }),

  getStudentCertificates: async (email, page = 1, search = '') => {
    const query = new URLSearchParams({ page: String(page) });
    if (search.trim()) query.set('q', search.trim());
    const response = await api.get(`/certificates/student/${encodeURIComponent(email)}?${query.toString()}`);
    return unwrapResponse(response);
  },

  getInstitutionCertificates: async (instId, page = 1, view = 'certificates', search = '') => {
    const query = new URLSearchParams({ page: String(page) });
    if (view === 'revocations') query.set('view', 'revocations');
    if (search.trim()) query.set('q', search.trim());
    const response = await api.get(`/certificates/institution/${instId}?${query.toString()}`);
    return unwrapResponse(response);
  },

  getAdminCertificates: async (page = 1, search = '') => {
    const query = new URLSearchParams({ page: String(page) });
    if (search.trim()) query.set('q', search.trim());
    const response = await api.get(`/certificates/all?${query.toString()}`);
    return unwrapResponse(response);
  },

  revokeCertificate: async (certId, reason) => {
    const response = await api.put(`/certificates/revoke/${certId}`, { reason });
    return unwrapResponse(response);
  },

  getAuditTrail: async (certId) => {
    const response = await api.get(`/certificates/audit/${certId}`);
    return unwrapResponse(response);
  },

  getCertificateStats: async () => {
    const response = await api.get('/certificates/stats');
    return unwrapResponse(response);
  },
};

export default certificateService;
