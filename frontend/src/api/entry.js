import api from './client';
export const scanEntry = (data) => api.post('/entry/scan', data);
export const getEntryLogs = (params) => api.get('/entry/logs', { params });
export const getEntryStats = (eventOrParams) => {
  const params = typeof eventOrParams === 'string' ? { eventId: eventOrParams } : eventOrParams;
  return api.get('/entry/stats', { params });
};
export const searchEntryAttendees = (params) => api.get('/entry/search', { params });
export const lookupAttendee = (qrToken) => api.get(`/entry/attendee/${qrToken}`);
