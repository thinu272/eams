import api from './client';

export const getDashboardStats = (params) => api.get('/dashboard/stats', { params });
export const getDashboardLogs = (params) => api.get('/dashboard/logs', { params });
