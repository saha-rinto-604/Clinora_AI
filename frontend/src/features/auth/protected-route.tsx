import { LoaderCircle } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from './auth-store';

interface ProtectedRouteProps {
  allowedRoles?: readonly string[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps = {}) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3" role="status">
          <LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} aria-hidden="true" />
          Restoring secure session...
        </div>
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/account" replace state={{ deniedFrom: location.pathname }} />;
  }

  return <Outlet />;
}
