import api from './client';
export const scanEntry = (data) => api.post('/entry/scan', data);
export const getEntryLogs = (params) => api.get('/entry/logs', { params });
export const getEntryStats = (eventId) => api.get('/entry/stats', { params: { eventId } });
export const lookupAttendee = (qrToken) => api.get(`/entry/attendee/${qrToken}`);
