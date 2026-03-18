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

// --------------- Silent Token Refresh --------------------
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

function shouldSkipRefresh(url?: string) {
  if (!url) return false;
  return [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
    '/auth/google',
  ].some((path) => url.includes(path));
}

// Response interceptor for handling errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ---- 401: attempt a silent refresh before logging out --------
    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh(originalRequest.url)) {
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
    
    // ---- Unified error message extraction ------------------------
    // Backend sends message in two possible locations:
    //   1. data.message (unified format / validator middleware)
    //   2. data.error.message (legacy global error handler)
    // Also data.details[] for field-level validation errors.
    const data = error.response?.data as Record<string, unknown> | undefined;
    const extractMessage = (): string => {
      if (data?.message && typeof data.message === 'string') return data.message;
      if (data?.error && typeof data.error === 'string') return data.error;
      if (data?.error && typeof data.error === 'object' && (data.error as Record<string, unknown>).message) {
        return (data.error as Record<string, unknown>).message as string;
      }
      return '';
    };

    const extractDetails = (): string => {
      const details = data?.details;
      if (Array.isArray(details) && details.length > 0) {
        return details
          .map((d: unknown) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              const item = d as Record<string, unknown>;
              return String(item.message || item.field || '');
            }
            return '';
          })
          .filter(Boolean)
          .join('; ');
      }

      const errorObj = data?.error;
      if (errorObj && typeof errorObj === 'object' && Array.isArray((errorObj as Record<string, unknown>).errors)) {
        return ((errorObj as Record<string, unknown>).errors as unknown[])
          .map((d: unknown) => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object') {
              const item = d as Record<string, unknown>;
              return String(item.message || item.field || '');
            }
            return '';
          })
          .filter(Boolean)
          .join('; ');
      }
      return '';
    };

    const serverMessage = extractMessage();
    const fieldDetails = extractDetails();

    // Convert raw Joi messages like '"website" is not allowed to be empty'
    // into human-readable text like 'Website is required'
    const humanize = (raw: string): string => {
      return raw
        // Remove enclosing quotes around field name and title-case it
        .replace(/^"([^"]+)"\s/, (_, field) => {
          const label = field
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          return `${label} `;
        })
        .replace(/is not allowed to be empty/gi, 'is required')
        .replace(/must be a valid uri/gi, 'must be a valid URL')
        .replace(/must be a valid email/gi, 'must be a valid email address')
        .replace(/is not allowed/gi, 'is not permitted')
        .replace(/must be a number/gi, 'must be a number')
        .replace(/must be a string/gi, 'must be text')
        .replace(/must be a boolean/gi, 'must be true or false');
    };

    // Handle authentication failures
    if (error.response?.status === 401) {
      toast.error('Authentication Failed', serverMessage || 'Please sign in and try again');
    }

    // Handle authorization errors
    else if (error.response?.status === 403) {
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
      // Prefer per-field detail messages; fall back to top-level message
      const rawMessages: string[] = fieldDetails
        ? fieldDetails.split(';').map((x) => x.trim()).filter(Boolean)
        : serverMessage ? [serverMessage] : [];
      const readable = [...new Set(rawMessages.map(humanize))].join(' • ');
      toast.error('Please check your input', readable || 'Invalid request data');
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
