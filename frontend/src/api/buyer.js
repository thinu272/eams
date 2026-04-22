import api from './client';

export const getBuyerOrders = () => api.get('/buyer/orders');
export const getBuyerOrderDetails = (orderId) => api.get(`/buyer/orders/${orderId}`);
export const getBuyerTickets = () => api.get('/buyer/tickets');
export const getBuyerInvites = () => api.get('/buyer/invites');
export const assignSelfToTicket = (ticketId, formData) => api.post(`/buyer/tickets/${ticketId}/assign-self`, formData);
export const inviteForTicket = (ticketId, payload) => api.post(`/buyer/tickets/${ticketId}/invite`, payload);
export const assignAttendee = (payload) => api.post('/buyer/assign', payload);
export const resendInvite = (ticketId, payload) => api.post(`/buyer/tickets/${ticketId}/resend-invite`, payload);
