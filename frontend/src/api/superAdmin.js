import api from './client';

export const getSuperAdminOverview = () => api.get('/super-admin/overview');
export const getSuperAdminWorkspace = (params) => api.get('/super-admin/workspace', { params });
export const searchSuperAdmin = (q) => api.get('/super-admin/search', { params: { q } });

export const createSuperAdminEvent = (payload) => api.post('/super-admin/events', payload);
export const updateSuperAdminEvent = (id, payload) => api.patch(`/super-admin/events/${id}`, payload);
export const deleteSuperAdminEvent = (id) => api.delete(`/super-admin/events/${id}`);

export const createSuperAdminOrganiser = (payload) => api.post('/super-admin/organisers', payload);
export const updateSuperAdminOrganiser = (id, payload) => api.patch(`/super-admin/organisers/${id}`, payload);
export const deleteSuperAdminOrganiser = (id) => api.delete(`/super-admin/organisers/${id}`);

export const createSuperAdminUser = (payload) => api.post('/super-admin/users', payload);
export const updateSuperAdminUser = (id, payload) => api.patch(`/super-admin/users/${id}`, payload);
export const updateSuperAdminUserStatus = (id, status) => api.patch(`/super-admin/users/${id}/status`, { status });
export const deleteSuperAdminUser = (id) => api.delete(`/super-admin/users/${id}`);

export const resendSuperAdminNotification = (id) => api.post(`/super-admin/notifications/${id}/resend`);

export const exportSuperAdminReport = (params) =>
  api.get('/super-admin/reports/export', { params, responseType: 'blob' });

export const getSuperAdminSettings = () => api.get('/super-admin/settings');
export const updateSuperAdminSettings = (payload) => api.patch('/super-admin/settings', payload);
export const getSuperAdminLogs = (params) => api.get('/super-admin/logs', { params });
