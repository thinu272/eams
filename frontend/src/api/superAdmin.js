import api from './client';

export const getSuperAdminOverview = () => api.get('/super-admin/overview');
export const getSuperAdminLogs = (params) => api.get('/super-admin/logs', { params });
