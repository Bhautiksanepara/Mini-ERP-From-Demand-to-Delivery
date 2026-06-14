import { apiRequest, clearAccessToken, setAccessToken } from './apiClient';

export async function login(credentials) {
  const payload = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  setAccessToken(payload.data.access_token);
  const user = payload.data.user;
  try {
    const permRes = await apiRequest('/permissions/me');
    user.permissions = permRes.data;
  } catch (err) {
    user.permissions = { module_permissions: [] };
  }
  return user;
}

export async function signup(form) {
  const payload = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(form)
  });
  setAccessToken(payload.data.access_token);
  const user = payload.data.user;
  try {
    const permRes = await apiRequest('/permissions/me');
    user.permissions = permRes.data;
  } catch (err) {
    user.permissions = { module_permissions: [] };
  }
  return user;
}

export async function fetchCurrentUser() {
  const [userRes, permRes] = await Promise.all([
    apiRequest('/auth/me'),
    apiRequest('/permissions/me').catch(() => ({ data: { module_permissions: [] } }))
  ]);
  const user = userRes.data.user;
  user.permissions = permRes.data;
  return user;
}

export function logout() {
  clearAccessToken();
}
