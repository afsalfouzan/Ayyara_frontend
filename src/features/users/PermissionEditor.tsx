import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import { useSession } from '@/features/auth/session';
import type { Permission } from '@/lib/permissions';
import type { Override, PermissionGroup } from './api';

function SensitiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-warning-bg px-1.5 py-0.5 text-[0.6875rem] font-medium text-warning">
      <Lock className="size-3" aria-hidden />
      Confidential
    </span>
  );
}

/** Checkbox list used by the role editor. Permissions the signed-in user doesn't hold are locked. */
export function RolePermissionEditor({
  groups,
  value,
  onChange,
}: {
  groups: PermissionGroup[];
  value: Permission[];
  onChange: (value: Permission[]) => void;
}) {
  const { can } = useSession();
  const selected = new Set(value);
  const toggle = (permission: Permission) => {
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange([...next]);
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <fieldset key={group.group}>
          <legend className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">{group.group}</legend>
          <div className="divide-y divide-border rounded-lg border border-border">
            {group.permissions.map((permission) => {
              const lockedForActor = !can(permission.key);
              return (
                <label
                  key={permission.key}
                  className={clsx('flex items-center gap-3 px-3 py-2.5 text-sm', lockedForActor ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-surface-muted')}
                  title={lockedForActor ? 'You can only grant permissions you hold yourself' : undefined}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={selected.has(permission.key)}
                    disabled={lockedForActor}
                    onChange={() => toggle(permission.key)}
                  />
                  <span className="flex-1 text-fg">{permission.label}</span>
                  {permission.sensitive && <SensitiveTag />}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

type State = 'role' | 'grant' | 'deny';

/** Per-user exceptions: follow the role, always grant, or always deny each permission. */
export function OverrideEditor({
  groups,
  rolePermissions,
  value,
  onChange,
  disabled,
}: {
  groups: PermissionGroup[];
  rolePermissions: Permission[];
  value: Override[];
  onChange: (value: Override[]) => void;
  disabled?: boolean;
}) {
  const { can } = useSession();
  const fromRole = new Set(rolePermissions);
  const stateOf = (permission: Permission): State => value.find((item) => item.permission === permission)?.effect ?? 'role';

  const setState = (permission: Permission, state: State) => {
    const rest = value.filter((item) => item.permission !== permission);
    onChange(state === 'role' ? rest : [...rest, { permission, effect: state }]);
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <fieldset key={group.group}>
          <legend className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">{group.group}</legend>
          <div className="divide-y divide-border rounded-lg border border-border">
            {group.permissions.map((permission) => {
              const state = stateOf(permission.key);
              const effective = state === 'grant' || (state === 'role' && fromRole.has(permission.key));
              const lockedForActor = !can(permission.key);
              return (
                <div key={permission.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                    <span className={clsx('size-1.5 rounded-full', effective ? 'bg-success' : 'bg-border-strong')} aria-hidden />
                    <span className="text-fg">{permission.label}</span>
                    {permission.sensitive && <SensitiveTag />}
                    <span className="sr-only">{effective ? '(allowed)' : '(not allowed)'}</span>
                  </div>
                  <div role="radiogroup" aria-label={permission.label} className="inline-flex self-start rounded-lg border border-border bg-surface-muted p-0.5 text-xs">
                    {(['role', 'grant', 'deny'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={state === option}
                        disabled={disabled || lockedForActor}
                        onClick={() => setState(permission.key, option)}
                        title={lockedForActor ? 'You can only change permissions you hold yourself' : undefined}
                        className={clsx(
                          'rounded-md px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          state === option
                            ? option === 'grant'
                              ? 'bg-success-bg text-success'
                              : option === 'deny'
                                ? 'bg-danger-bg text-danger'
                                : 'bg-surface text-fg shadow-panel'
                            : 'text-fg-muted hover:text-fg',
                        )}
                      >
                        {option === 'role' ? (fromRole.has(permission.key) ? 'Role ✓' : 'Role ✗') : option === 'grant' ? 'Grant' : 'Deny'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
