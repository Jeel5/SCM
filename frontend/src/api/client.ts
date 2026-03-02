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
  // Send cookies on every request (access token is an httpOnly cookie)
  withCredentials: true,
  timeout: 30000,
});

// --------------- Silent Token Refresh ---------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve();
  });
  failedQueue = [];
}

function forceLogout() {
  useAuthStore.getState().logout();
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
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          // Cookie is already updated by the refresh — just retry
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // POST to refresh — browser auto-sends the refreshToken httpOnly cookie
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        // Backend has now set a new accessToken cookie in the response
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // ---- Unified error message extraction ----
    // Backend sends message in two possible locations:
    //   1. data.message (unified format / validator middleware)
    //   2. data.error.message (legacy global error handler)
    // Also data.details[] for field-level validation errors.
    const data = error.response?.data as Record<string, unknown> | undefined;
    const extractMessage = (): string => {
      if (data?.message && typeof data.message === 'string') return data.message;
      if (data?.error && typeof data.error === 'object' && (data.error as Record<string, unknown>).message) {
        return (data.error as Record<string, unknown>).message as string;
      }
      return '';
    };

    const extractDetails = (): string => {
      if (Array.isArray(data?.details) && data.details.length > 0) {
        return data.details
          .map((d: Record<string, unknown>) => d.message || d.field)
          .filter(Boolean)
          .join('; ');
      }
      return '';
    };

    const serverMessage = extractMessage();
    const fieldDetails = extractDetails();
    
    // Handle authorization errors
    if (error.response?.status === 403) {
      toast.error('Access Denied', serverMessage || 'You don\'t have permission to perform this action');
    }
    
    // Handle not found errors
    else if (error.response?.status === 404) {
      toast.error('Not Found', serverMessage || 'The requested resource was not found');
    }
    
    // Handle conflict errors (state machine violations, duplicates)
    else if (error.response?.status === 409) {
      toast.error('Conflict', serverMessage || 'This action conflicts with the current state');
    }
    
    // Handle validation errors
    else if (error.response?.status === 400 || error.response?.status === 422) {
      const detail = fieldDetails ? `${serverMessage}. ${fieldDetails}` : serverMessage;
      toast.error('Validation Error', detail || 'Invalid request data');
    }
    
    // Handle rate limiting
    else if (error.response?.status === 429) {
      toast.error('Too Many Requests', serverMessage || 'Please slow down and try again later');
    }
    
    // Handle server errors
    else if (error.response?.status && error.response.status >= 500) {
      toast.error('Server Error', serverMessage || 'Something went wrong on our end. Please try again later.');
    }
    
    // Handle network errors
    else if (!error.response) {
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
