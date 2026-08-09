import { useEffect, type PropsWithChildren } from 'react';
import { authApi } from './auth-api';

let bootstrap: Promise<unknown> | null = null;

export function AuthProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!bootstrap) bootstrap = authApi.bootstrap();
  }, []);

  return children;
}
