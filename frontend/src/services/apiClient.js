import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../config/app';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed');
    if (payload.errors) error.errors = payload.errors;
    throw error;
  }
  return payload;
}

export function getRowsFromPayload(payload, key) {
  const data = payload?.data || payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return Object.values(data || {}).find(Array.isArray) || [];
}
