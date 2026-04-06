import api from './client';
export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.patch(`/users/${id}`, data);
export const updateUserPermissions = (id, data) => api.patch(`/users/${id}/permissions`, data);
export const assignUserToEvent = (id, eventId) => api.patch(`/users/${id}/assign-event`, { eventId });
export const toggleUserActive = (id) => api.patch(`/users/${id}/toggle-active`);
