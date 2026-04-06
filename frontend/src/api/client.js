import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eams_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // If data is FormData, let axios set the correct Content-Type with boundary
  if (config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
      config.headers.delete('content-type');
    } else {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response?.data && typeof response.data === 'object' && !('data' in response.data)) {
      response.data.data = {};
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('eams_token');
      localStorage.removeItem('eams_user');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    if (status === 403) {
      if (error.response?.data && typeof error.response.data === 'object' && !('data' in error.response.data)) {
        error.response.data.data = {};
      }
      toast.error(error.response?.data?.message || 'Access denied (403).');
      return Promise.resolve(error.response);
    }
    return Promise.reject(error);
  }
);

export default api;
