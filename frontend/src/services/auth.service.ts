import { apiClient, tokenStorage } from '@/lib/apiClient';
import type { ApiResponse, AuthUser } from '@/types';

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
  return data.data;
}

export async function register(input: { firstName: string; lastName: string; email: string; phone?: string; password: string }) {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register', input);
  return data.data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await apiClient.post<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword });
  return data.data;
}

export async function logout() {
  // Capture the token synchronously now: apiClient's request interceptor reads it lazily in a
  // microtask, so if the caller clears storage right after firing this call (as AuthContext
  // does, for instant UI feedback), the interceptor can lose the race and send this
  // unauthenticated. Pinning it explicitly here removes that race entirely.
  const token = tokenStorage.getAccessToken();
  await apiClient.post('/auth/logout', undefined, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
}
