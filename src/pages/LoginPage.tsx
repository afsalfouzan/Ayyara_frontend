import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { BrandLogo } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';
import { sessionQueryKey, useSession, type SessionUser } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api';

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export default function LoginPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors({ email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // The backend sets an HTTP-only session cookie; the response body carries only the profile.
      const { user: signedIn } = await api<{ user: SessionUser }>('/admin/auth/login', { method: 'POST', body: parsed.data });
      queryClient.setQueryData(sessionQueryKey, signedIn);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? 'Incorrect email or password.'
          : error instanceof ApiError
            ? error.message
            : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo className="h-28" />
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-panel sm:p-8">
          <h1 className="text-lg font-semibold text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-fg-muted">Use the account created for you by the owner.</p>
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <InputField id="email" label="Email" type="email" autoComplete="username" inputMode="email" error={errors.email} />
            <InputField id="password" label="Password" type="password" autoComplete="current-password" error={errors.password} />
            <div role="alert" aria-live="assertive">
              {formError && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>}
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-fg-subtle">Authorised staff only. Activity is logged.</p>
      </div>
    </div>
  );
}
