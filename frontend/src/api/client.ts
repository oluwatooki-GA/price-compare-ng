import axios from 'axios';
import { formatError } from '../utils/formatting';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Only redirect if not already on login/register page and not a login/register request
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
      const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
      if (!isAuthPage && !isAuthRequest) {
        window.location.href = '/login';
      }
    }

    // Format error message for user display
    const formattedMessage = formatError(error);
    error.userMessage = formattedMessage;

    return Promise.reject(error);
  }
);
