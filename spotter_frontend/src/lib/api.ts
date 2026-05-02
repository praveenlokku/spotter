import axios from 'axios';
import { getToken, clearToken } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, attempt refresh — on failure, log out
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const resp = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/users/token/refresh/`,
            { refresh }
          );
          const newAccess = resp.data.access;
          localStorage.setItem('access_token', newAccess);
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          clearToken();
          window.location.href = '/login';
        }
      } else {
        clearToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
