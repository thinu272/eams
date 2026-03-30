import api from './client';
export const createOrder = (data) => api.post('/orders', data);
export const getOrderByToken = (token) => api.get(`/orders/confirm/${token}`);
export const getOrders = (params) => api.get('/orders', { params });
export const markOrderPaid = (id, data) => api.patch(`/orders/${id}/mark-paid`, data);
