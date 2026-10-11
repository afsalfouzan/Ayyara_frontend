import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/Field';
import { sessionQueryKey, type SessionUser } from '@/features/auth/session';
import { api } from '@/lib/api';
import { fieldErrorsOf, messageOf } from '@/lib/errors';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(10, 'At least 10 characters')
      .max(128)
      .refine((value) => /[a-zA-Z]/.test(value) && /[^a-zA-Z]/.test(value), 'Use letters and at least one number or symbol'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export function ChangePasswordForm({ submitLabel = 'Update password', onSuccess }: { submitLabel?: string; onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0] ?? ''])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { user } = await api<{ user: SessionUser }>('/admin/auth/change-password', {
        method: 'POST',
        body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
      });
      queryClient.setQueryData(sessionQueryKey, user);
      form.reset();
      onSuccess?.();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setFormError(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <InputField id="currentPassword" label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword} />
      <InputField id="newPassword" label="New password" type="password" autoComplete="new-password" error={errors.newPassword} />
      <InputField id="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword} />
      <p className="text-xs text-fg-subtle">At least 10 characters, with letters and a number or symbol. Other devices will be signed out.</p>
      <div role="alert">{formError && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{formError}</p>}</div>
      <Button type="submit" loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
