import type { AxiosError } from 'axios';
import { toast } from '@/stores/toastStore';

type ErrorPayload = {
  message?: unknown;
  error?: unknown;
  details?: unknown;
};

function titleCaseField(field: string) {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanize(raw: string): string {
  return raw
    .replace(/^"([^"]+)"\s/, (_, field) => `${titleCaseField(field)} `)
    .replace(/is not allowed to be empty/gi, 'is required')
    .replace(/must be a valid uri/gi, 'must be a valid URL')
    .replace(/must be a valid email/gi, 'must be a valid email address')
    .replace(/is not allowed/gi, 'is not permitted')
    .replace(/must be a number/gi, 'must be a number')
    .replace(/must be a string/gi, 'must be text')
    .replace(/must be a boolean/gi, 'must be true or false');
}

function extractFromPayload(payload?: ErrorPayload): string {
  if (!payload) return '';

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    const details = payload.details
      .map((detail) => {
        if (typeof detail === 'string') return detail;
        if (detail && typeof detail === 'object') {
          const item = detail as Record<string, unknown>;
          return String(item.message || item.field || '');
        }
        return '';
      })
      .filter(Boolean)
      .map(humanize)
      .join(' • ');

    if (details) return details;
  }

  if (payload.error && typeof payload.error === 'object') {
    const nested = payload.error as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim();
    }
    if (Array.isArray(nested.errors)) {
      const details = nested.errors
        .map((detail) => {
          if (typeof detail === 'string') return detail;
          if (detail && typeof detail === 'object') {
            const item = detail as Record<string, unknown>;
            return String(item.message || item.field || '');
          }
          return '';
        })
        .filter(Boolean)
        .map(humanize)
        .join(' • ');
      if (details) return details;
    }
  }

  return '';
}

export function extractSafeErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const axiosError = error as AxiosError<ErrorPayload>;
  const status = axiosError?.response?.status;
  const payloadMessage = extractFromPayload(axiosError?.response?.data);

  if (typeof status === 'number' && status >= 500) {
    return fallback;
  }

  if (payloadMessage) {
    return payloadMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export function notifyError(title: string, error: unknown, fallback?: string) {
  toast.error(title, extractSafeErrorMessage(error, fallback));
}

export function notifyLoadError(resource: string, error: unknown) {
  notifyError(
    `Failed to load ${resource}`,
    error,
    `Could not load ${resource}. Please refresh and try again.`
  );
}

export async function downloadApiFile(path: string, filename: string) {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}));
      message = extractFromPayload(payload) || message;
    } else {
      const text = await response.text().catch(() => '');
      if (text.trim()) message = text.trim();
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
