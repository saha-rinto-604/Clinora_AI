import { describe, it, expect } from 'vitest';
import { apiClient } from './auth-api';
import { applicationApi } from '../access-applications/application-api';

describe('API base configuration', () => {
  it('auth apiClient should default to /api/v1 when VITE_API_BASE_URL is not set', () => {
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
  });

  it('applicationApi.documentUrl should use the same /api/v1 base', () => {
    const url = applicationApi.documentUrl('doc-123');
    expect(url).toBe('/api/v1/access-applications/me/documents/doc-123/content');
  });
});
