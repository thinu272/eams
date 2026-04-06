import api from './client';

// Create new order
export const createOrder = (data) => api.post('/orders', data);

// Get order by confirmation token
export const getOrderByToken = (token) => api.get(`/orders/confirm/${token}`);

// Finalize order after all tickets are assigned
export const finalizeOrder = (orderId) => api.post(`/orders/finalize/${orderId}`);

// Sample request/response examples:
/*
// POST /api/orders
const sampleRequest = {
  eventId: "507f1f77bcf86cd799439011",
  buyerName: "John Doe",
  buyerEmail: "john@example.com",
  buyerPhone: "+1234567890",
  tickets: [
    {
      categoryName: "VIP",
      quantity: 2,
      price: 5000
    },
    {
      categoryName: "General",
      quantity: 1,
      price: 2000
    }
  ]
};

// Response
const sampleResponse = {
  success: true,
  data: {
    orderId: "507f1f77bcf86cd799439012",
    orderNumber: "ORD-A1B2C3D4",
    confirmationToken: "uuid-string-here",
    totalAmount: 12000
  },
  message: "Order created successfully"
};
*/
