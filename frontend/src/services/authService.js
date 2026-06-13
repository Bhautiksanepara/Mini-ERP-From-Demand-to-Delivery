import { apiRequest, clearAccessToken, setAccessToken } from './apiClient';

export async function login(credentials) {
  const payload = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  setAccessToken(payload.data.access_token);
  return payload.data.user;
}

export async function signup(form) {
  const payload = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(form)
  });
  setAccessToken(payload.data.access_token);
  return payload.data.user;
}

export async function fetchCurrentUser() {
  const payload = await apiRequest('/auth/me');
  return payload.data.user;
}

export function logout() {
  clearAccessToken();
}
