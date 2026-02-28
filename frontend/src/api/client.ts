import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores';
import { toast } from '@/stores/toastStore';
import type { ApiError } from '@/types';

// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --------------- Silent Token Refresh ---------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

function forceLogout() {
  useAuthStore.getState().logout();
  localStorage.removeItem('refreshToken');
  toast.error('Session Expired', 'Please log in again');
  window.location.href = '/login';
}

// Response interceptor for handling errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ---- 401: attempt a silent refresh before logging out ----
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry the refresh endpoint itself
      if (originalRequest.url?.includes('/auth/refresh')) {
        forceLogout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Another refresh is already in-flight — queue this request
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        isRefreshing = false;
        forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken: string = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Handle authorization errors
    if (error.response?.status === 403) {
      toast.error('Access Denied', 'You don\'t have permission to perform this action');
    }
    
    // Handle not found errors
    if (error.response?.status === 404) {
      toast.error('Not Found', error.response.data?.message || 'The requested resource was not found');
    }
    
    // Handle validation errors
    if (error.response?.status === 400 || error.response?.status === 422) {
      const message = error.response.data?.message || 'Invalid request data';
      toast.error('Validation Error', message);
    }
    
    // Handle server errors
    if (error.response?.status && error.response.status >= 500) {
      toast.error('Server Error', 'Something went wrong on our end. Please try again later.');
    }
    
    // Handle network errors
    if (!error.response) {
      toast.error('Network Error', 'Unable to connect to server. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);

// Generic API helper functions
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.patch<T>(url, data);
  return response.data;
}

export async function del<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}

export default api;
