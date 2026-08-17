import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';
import type { ApiEnvelope, AuthenticatedSession, AuthSessionItem } from './auth-types';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<AuthenticatedSession> | null = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiEnvelope<AuthenticatedSession>>('/auth/refresh-token')
      .then((response) => response.data.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _clinoraRetried?: boolean }) | undefined;
    const authPath = config?.url ?? '';
    const shouldRefresh =
      error.response?.status === 401 &&
      config &&
      !config._clinoraRetried &&
      !authPath.includes('/auth/login') &&
      !authPath.includes('/auth/refresh-token');

    if (shouldRefresh) {
      config._clinoraRetried = true;
      try {
        const session = await refreshSession();
        useAuthStore.getState().setSession(session.accessToken, session.user);
        config.headers.Authorization = `Bearer ${session.accessToken}`;
        return apiClient.request(config);
      } catch {
        useAuthStore.getState().setAnonymous();
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  register(input: { firstName: string; lastName: string; email: string; password: string }) {
    return apiClient.post<ApiEnvelope<{ email: string }>>('/auth/register', input);
  },
  verifyEmail(token: string) {
    return apiClient.post<ApiEnvelope<null>>('/auth/verify-email', { token });
  },
  resendVerification(email: string) {
    return apiClient.post<ApiEnvelope<null>>('/auth/resend-verification', { email });
  },
  async login(email: string, password: string) {
    const response = await apiClient.post<ApiEnvelope<AuthenticatedSession>>('/auth/login', { email, password });
    const session = response.data.data;
    useAuthStore.getState().setSession(session.accessToken, session.user);
    return session;
  },
  async bootstrap() {
    try {
      const session = await refreshSession();
      useAuthStore.getState().setSession(session.accessToken, session.user);
      return session;
    } catch {
      useAuthStore.getState().setAnonymous();
      return null;
    }
  },
  async logout() {
    try {
      await apiClient.post<ApiEnvelope<null>>('/auth/logout');
    } finally {
      useAuthStore.getState().setAnonymous();
    }
  },
  forgotPassword(email: string) {
    return apiClient.post<ApiEnvelope<null>>('/auth/forgot-password', { email });
  },
  resetPassword(token: string, password: string) {
    return apiClient.post<ApiEnvelope<null>>('/auth/reset-password', { token, password });
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await apiClient.patch<ApiEnvelope<AuthenticatedSession>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    const session = response.data.data;
    useAuthStore.getState().setSession(session.accessToken, session.user);
    return session;
  },
  async sessions() {
    const response = await apiClient.get<ApiEnvelope<AuthSessionItem[]>>('/auth/sessions');
    return response.data.data;
  },
  revokeSession(sessionId: string) {
    return apiClient.delete<ApiEnvelope<null>>(`/auth/sessions/${sessionId}`);
  },
  revokeOtherSessions() {
    return apiClient.post<ApiEnvelope<null>>('/auth/sessions/revoke-others');
  },
};

export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}
