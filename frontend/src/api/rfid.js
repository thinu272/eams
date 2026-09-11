import api from './client';

export const getRfidTags = (eventId) => api.get(`/rfid/events/${eventId}`);
export const addRfidTags = (eventId, categoryId, rfidTags) => api.post(`/rfid/events/${eventId}/tags`, { categoryId, rfidTags });
export const uploadRfidTags = (eventId, categoryId, file) => {
  const form = new FormData();
  form.append('categoryId', categoryId);
  form.append('file', file);
  return api.post(`/rfid/events/${eventId}/upload`, form);
};
export const deleteRfidTag = (eventId, tagId) => api.delete(`/rfid/events/${eventId}/tags/${tagId}`);
