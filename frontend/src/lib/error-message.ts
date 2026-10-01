import { isAxiosError } from 'axios';

export function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: unknown }>(error) && typeof error.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
