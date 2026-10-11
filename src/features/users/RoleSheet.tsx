import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import type { Permission } from '@/lib/permissions';
import { useDeleteRole, usePermissionCatalog, useSaveRole, type Role } from './api';
import { RolePermissionEditor } from './PermissionEditor';

type Mode = { kind: 'create' } | { kind: 'edit'; role: Role };

export function RoleSheet({ mode, onClose }: { mode: Mode | null; onClose: () => void }) {
  return (
    <Sheet open={mode != null} onClose={onClose} title={mode?.kind === 'edit' ? `Edit role: ${mode.role.name}` : 'New role'}>
      {mode && <RoleForm key={mode.kind === 'edit' ? mode.role.id : 'new'} role={mode.kind === 'edit' ? mode.role : null} onDone={onClose} />}
    </Sheet>
  );
}

function RoleForm({ role, onDone }: { role: Role | null; onDone: () => void }) {
  const catalog = usePermissionCatalog();
  const saveRole = useSaveRole(role?.id ?? null);
  const deleteRole = useDeleteRole();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Permission[]>(role?.permissions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    if (name.trim().length < 2) {
      setErrors({ name: 'Enter a role name' });
      return;
    }
    try {
      await saveRole.mutateAsync({ name: name.trim(), description: description.trim(), permissions });
      toast(role ? 'Role updated' : 'Role created');
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast(messageOf(error), 'error');
    }
  }

  async function remove() {
    if (!role) return;
    try {
      await deleteRole.mutateAsync(role.id);
      toast('Role deleted');
      onDone();
    } catch (error) {
      toast(messageOf(error), 'error');
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormField label="Role name" htmlFor="role-name" error={errors.name}>
        <input id="role-name" className={`${controlClass} w-full`} value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <FormField label="Description" htmlFor="role-description" error={errors.description}>
        <input id="role-description" className={`${controlClass} w-full`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      {role && role.userCount > 0 && (
        <p className="rounded-lg bg-info-bg px-3 py-2 text-sm text-info">
          Changes apply immediately to {role.userCount} {role.userCount === 1 ? 'user' : 'users'} with this role.
        </p>
      )}
      <div>
        <h3 className="mb-3 text-sm font-medium text-fg">Permissions</h3>
        {catalog.data ? <RolePermissionEditor groups={catalog.data} value={permissions} onChange={setPermissions} /> : <div className="h-64 animate-pulse rounded-lg bg-surface-muted" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
        {role && !role.isSystem ? (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={role.userCount > 0} title={role.userCount > 0 ? 'Reassign its users first' : undefined}>
            <Trash2 className="size-4" aria-hidden />
            Delete role
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save} loading={saveRole.isPending}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${role?.name}”?`}
        message="This role will be removed permanently."
        confirmLabel="Delete"
        loading={deleteRole.isPending}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
