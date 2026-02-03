/**
 * Canonical API Configuration
 * Prevents localhost leakage in production builds
 */

/**
 * Get the base URL for API calls
 * @returns Empty string for same-origin, or the configured base URL
 */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim();

  // If unset, use same-origin (works in dev + prod)
  if (!raw) return '';

  // Prevent accidental localhost in production builds
  const isProd = import.meta.env.PROD;
  if (isProd && /localhost|127\.0\.0\.1/.test(raw)) {
    console.warn('[api] refusing localhost base in production:', raw);
    return '';
  }

  return raw.replace(/\/$/, '');
}

/**
 * Build a full API URL from a path
 * @param path The API path (e.g., '/api/something')
 * @returns Full URL for fetch
 */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

// Legacy export for backwards compatibility
export const API_BASE = getApiBase();

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * API client helper for backend endpoints
 * Use this for file uploads and syndicate forms
 * For data operations, use Supabase client directly
 */
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = apiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Upload a file to the backend
 */
export async function uploadFile(file: File): Promise<{ filename: string; originalname: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(apiUrl('/api/documents'), {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`File upload failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Submit syndicate form
 */
export async function submitSyndicateForm(data: { name: string; email: string; message: string }) {
  return apiCall('/api/syndicates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
