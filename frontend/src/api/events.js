import api from './client';

export const getEvents = (params) => api.get('/events', { params });
export const getEvent = (slug) => api.get(`/events/${slug}`);
export const getEventForEdit = (id) => api.get(`/events/manage/${id}`);
export const getAllEventsAdmin = (params) => api.get('/events/admin/all', { params });
export const getMyEvents = () => api.get('/events/my/events');

export const createEvent = (data, config = {}) => api.post('/events', data, config);
export const updateEvent = (id, data, config = {}) => api.patch(`/events/${id}`, data, config);

export const publishEvent = (id) => api.patch(`/events/${id}/publish`);
export const assignOrganiser = (eventId, organiserId) => api.patch(`/events/${eventId}/assign-organiser`, { organiserId });
export const getEventDashboard = (eventId) => api.get(`/events/${eventId}/dashboard`);
