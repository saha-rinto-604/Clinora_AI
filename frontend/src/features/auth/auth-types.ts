export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountStatus: string;
  emailVerified: boolean;
}

export interface AuthenticatedSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
}

export interface AuthSessionItem {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}
