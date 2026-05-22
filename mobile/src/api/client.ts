/**
 * RupeeFast — API Client
 * Authenticated fetch wrapper with token management, error handling,
 * timeout support, and offline fallback.
 */

import { Platform } from 'react-native';
import { useAuthStore } from '../stores/auth-store';

// Android emulator uses 10.0.2.2 to reach host localhost.
// iOS simulator uses localhost directly.
// Real devices should use the machine's LAN IP or a deployed URL.
const DEV_API_HOST = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
  default: 'http://localhost:3000',
});

// Allow override via environment variable or config
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_API_HOST + '/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Timeout in ms (defaults to 15s) */
  timeout?: number;
}

interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  statusCode?: number;
}

export type ApiResult<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Execute an authenticated API request.
 *
 * On network failure, returns `{ success: false, error: 'Network error' }`
 * so callers can gracefully degrade to offline/demo mode.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 15000,
  } = options;

  const token = useAuthStore.getState().token;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Build the URL (handle query params if provided as searchParams)
  const url = `${API_BASE_URL}${endpoint}`;

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: text || 'Unknown error' };
    }

    if (!response.ok) {
      // If 401, clear auth — token expired/invalid
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }

      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    return { success: true, data: data as T };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }

    // Network errors (offline, DNS failure, etc.)
    if (
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('Network request failed') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('load')
    ) {
      return { success: false, error: 'Network error' };
    }

    return { success: false, error: err.message || 'Unknown error' };
  }
}
