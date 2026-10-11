import { KeyRound, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, Select, Switch } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/DataState';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { fieldErrorsOf, generateTemporaryPassword, messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import {
  useCreateUser,
  usePermissionCatalog,
  useResetPassword,
  useRoles,
  useUpdateUser,
  useUser,
  type Override,
  type Role,
  type UserDetail,
} from './api';
import { OverrideEditor } from './PermissionEditor';

const passwordRule = z
  .string()
  .min(10, 'At least 10 characters')
  .max(128)
  .refine((value) => /[a-zA-Z]/.test(value) && /[^a-zA-Z]/.test(value), 'Use letters and at least one number or symbol');

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  email: z.email('Enter a valid email'),
  temporaryPassword: passwordRule,
});

type Mode = { kind: 'create' } | { kind: 'edit'; id: number };

export function UserSheet({ mode, onClose }: { mode: Mode | null; onClose: () => void }) {
  return (
    <Sheet
      open={mode != null}
      onClose={onClose}
      title={mode?.kind === 'create' ? 'Add user' : 'Edit user'}
      description={mode?.kind === 'create' ? 'They will be asked to set their own password at first sign-in.' : undefined}
    >
      {mode?.kind === 'create' && <CreateUserForm onDone={onClose} />}
      {mode?.kind === 'edit' && <EditUser id={mode.id} onDone={onClose} />}
    </Sheet>
  );
}

function RoleSelect({ id, roles, value, onChange, disabled }: { id: string; roles: Role[]; value: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  return (
    <Select id={id} className="w-full" value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">No role (overrides only)</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </Select>
  );
}

function TemporaryPasswordField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <FormField label="Temporary password" htmlFor="temporaryPassword" error={error} hint="Share it with the person securely. They must change it when they first sign in.">
      <div className="flex gap-2">
        <input id="temporaryPassword" className={`${controlClass} flex-1 font-mono`} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" spellCheck={false} />
        <Button variant="secondary" onClick={() => onChange(generateTemporaryPassword())}>
          <RefreshCw className="size-3.5" aria-hidden />
          Generate
        </Button>
      </div>
    </FormField>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const roles = useRoles();
  const createUser = useCreateUser();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [password, setPassword] = useState(generateTemporaryPassword);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = createSchema.safeParse({ ...data, temporaryPassword: password });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0] ?? ''])));
      return;
    }
    setErrors({});
    try {
      await createUser.mutateAsync({ ...parsed.data, roleId });
      toast(`${parsed.data.name} has been added`);
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormField label="Full name" htmlFor="name" error={errors.name}>
        <input id="name" name="name" className={`${controlClass} w-full`} autoComplete="off" />
      </FormField>
      <FormField label="Email" htmlFor="email" error={errors.email}>
        <input id="email" name="email" type="email" className={`${controlClass} w-full`} autoComplete="off" />
      </FormField>
      <FormField label="Role" htmlFor="roleId" error={errors.roleId} hint="Fine-tune individual permissions after creating the user.">
        <RoleSelect id="roleId" roles={roles.data ?? []} value={roleId} onChange={setRoleId} />
      </FormField>
      <TemporaryPasswordField value={password} onChange={setPassword} error={errors.temporaryPassword} />
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={createUser.isPending}>
          Add user
        </Button>
      </div>
    </form>
  );
}

function EditUser({ id, onDone }: { id: number; onDone: () => void }) {
  const user = useUser(id);
  if (user.isPending) return <div className="h-64 animate-pulse rounded-lg bg-surface-muted" />;
  if (user.error) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  // Re-mount the form whenever fresh data arrives so local edits start from the saved state.
  return <EditUserForm key={JSON.stringify(user.data)} user={user.data} onDone={onDone} />;
}

function EditUserForm({ user, onDone }: { user: UserDetail; onDone: () => void }) {
  const { user: me } = useSession();
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const updateUser = useUpdateUser(user.id);
  const resetPassword = useResetPassword(user.id);

  const [name, setName] = useState(user.name);
  const [roleId, setRoleId] = useState(user.roleId);
  const [overrides, setOverrides] = useState<Override[]>(user.overrides);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState(generateTemporaryPassword);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSelf = me?.id === user.id;
  const locked = user.isOwner || isSelf;
  const rolePermissions = roles.data?.find((role) => role.id === roleId)?.permissions ?? [];

  async function save() {
    try {
      await updateUser.mutateAsync({
        name: name !== user.name ? name : undefined,
        ...(locked ? {} : { roleId, overrides }),
      });
      toast('Changes saved');
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast(messageOf(error), 'error');
    }
  }

  async function setActive(isActive: boolean) {
    try {
      await updateUser.mutateAsync({ isActive });
      toast(isActive ? `${user.name} can sign in again` : `${user.name} has been deactivated and signed out`);
      setConfirmDeactivate(false);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  async function doReset() {
    const parsed = passwordRule.safeParse(tempPassword);
    if (!parsed.success) {
      setErrors({ temporaryPassword: parsed.error.issues[0]?.message ?? 'Invalid password' });
      return;
    }
    try {
      await resetPassword.mutateAsync(tempPassword);
      toast(`Password reset. ${user.name} has been signed out everywhere.`);
      setResetOpen(false);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-fg-muted">{user.email}</p>
          {user.isOwner && <Badge tone="info">Owner</Badge>}
          {!user.isActive && <Badge tone="danger">Inactive</Badge>}
          {user.mustChangePassword && <Badge tone="warning">Temporary password</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-fg-subtle">Last sign-in</dt>
            <dd className="text-fg">{formatDateTime(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-fg-subtle">Created</dt>
            <dd className="text-fg">{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
        <FormField label="Full name" htmlFor="edit-name" error={errors.name}>
          <input id="edit-name" className={`${controlClass} w-full`} value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
      </section>

      {user.isOwner ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-fg-muted">The owner always has full access. Owner permissions cannot be restricted.</p>
      ) : isSelf ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-fg-muted">You can’t change your own role or permissions. Ask the owner if you need different access.</p>
      ) : (
        <section className="space-y-4">
          <FormField label="Role" htmlFor="edit-role" error={errors.roleId}>
            <RoleSelect id="edit-role" roles={roles.data ?? []} value={roleId} onChange={setRoleId} />
          </FormField>
          <div>
            <h3 className="text-sm font-medium text-fg">Individual permissions</h3>
            <p className="mt-0.5 mb-4 text-xs text-fg-muted">
              “Role” follows the selected role. Use Grant or Deny for exceptions for this person only.
            </p>
            {catalog.data ? (
              <OverrideEditor groups={catalog.data} rolePermissions={rolePermissions} value={overrides} onChange={setOverrides} />
            ) : (
              <div className="h-40 animate-pulse rounded-lg bg-surface-muted" />
            )}
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} loading={updateUser.isPending}>
          Save changes
        </Button>
      </div>

      {!locked && (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-fg">Account access</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-fg">Active</p>
              <p className="text-xs text-fg-muted">Deactivating signs them out immediately and blocks sign-in.</p>
            </div>
            <Switch label="Active" checked={user.isActive} disabled={updateUser.isPending} onChange={(value) => (value ? void setActive(true) : setConfirmDeactivate(true))} />
          </div>
          <div className="border-t border-border pt-3">
            {resetOpen ? (
              <div className="space-y-3">
                <TemporaryPasswordField value={tempPassword} onChange={setTempPassword} error={errors.temporaryPassword} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setResetOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={doReset} loading={resetPassword.isPending}>
                    Reset password
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
                <KeyRound className="size-3.5" aria-hidden />
                Reset password
              </Button>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmDeactivate}
        title={`Deactivate ${user.name}?`}
        message="They will be signed out on every device and won’t be able to sign in until reactivated. Their history is kept."
        confirmLabel="Deactivate"
        loading={updateUser.isPending}
        onConfirm={() => void setActive(false)}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
}
