import { Navigate, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/Button';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { FullScreenLoader } from '@/features/auth/guards';
import { useLogout, useSession } from '@/features/auth/session';

/** Shown after signing in with a temporary password; nothing else is reachable until it's replaced. */
export default function SetPasswordPage() {
  const { user, isLoading } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo className="h-28" />
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-panel sm:p-8">
          <h1 className="text-lg font-semibold text-fg">Set your password</h1>
          <p className="mt-1 mb-6 text-sm text-fg-muted">Welcome, {user.name}. Replace the temporary password you were given to continue.</p>
          <ChangePasswordForm submitLabel="Set password and continue" onSuccess={() => navigate('/', { replace: true })} />
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
