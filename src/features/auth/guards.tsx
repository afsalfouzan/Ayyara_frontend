import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState } from '@/components/ui/DataState';
import type { Permission } from '@/lib/permissions';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { useSession } from './session';

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <Loader2 className="size-6 animate-spin text-fg-subtle" aria-hidden />
    </div>
  );
}

/** Sends signed-out users to /login and users with a temporary password to the change-password screen. */
export function RequireAuth() {
  const { user, isLoading, error, refetch } = useSession();
  const location = useLocation();
  if (isLoading) return <FullScreenLoader />;
  if (error && !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/set-password" replace />;
  return <Outlet />;
}

/** UI-level gate. The backend independently rejects any request lacking the permission. */
export function RequirePermission({ permission, ownerOnly, children }: { permission: Permission; ownerOnly?: boolean; children: ReactNode }) {
  const { can, user } = useSession();
  return (ownerOnly ? Boolean(user?.isOwner) : can(permission)) ? children : <ForbiddenPage />;
}
