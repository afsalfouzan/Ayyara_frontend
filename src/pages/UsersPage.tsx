import { clsx } from 'clsx';
import { ChevronRight, Plus, ShieldCheck, Users } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { useRoles, useUsers, type Role, type UserFilters, type UserListItem } from '@/features/users/api';
import { RoleSheet } from '@/features/users/RoleSheet';
import { UserSheet } from '@/features/users/UserSheet';
import { formatRelative } from '@/lib/format';

export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'roles' ? 'roles' : 'users';
  const [userSheet, setUserSheet] = useState<{ kind: 'create' } | { kind: 'edit'; id: number } | null>(null);
  const [roleSheet, setRoleSheet] = useState<{ kind: 'create' } | { kind: 'edit'; role: Role } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Permissions"
        description="Staff accounts, roles and what each person can see and do."
        actions={
          tab === 'users' ? (
            <Button onClick={() => setUserSheet({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              Add user
            </Button>
          ) : (
            <Button onClick={() => setRoleSheet({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              New role
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Section" className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(['users', 'roles'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setParams(value === 'users' ? {} : { tab: value }, { replace: true })}
            className={clsx('rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-colors', tab === value ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UsersTable onEdit={(id) => setUserSheet({ kind: 'edit', id })} /> : <RolesTable onEdit={(role) => setRoleSheet({ kind: 'edit', role })} />}

      <UserSheet mode={userSheet} onClose={() => setUserSheet(null)} />
      <RoleSheet mode={roleSheet} onClose={() => setRoleSheet(null)} />
    </div>
  );
}

function StatusBadge({ user }: { user: UserListItem }) {
  if (!user.isActive) return <Badge tone="danger">Inactive</Badge>;
  if (user.mustChangePassword) return <Badge tone="warning">Pending first sign-in</Badge>;
  return <Badge tone="success">Active</Badge>;
}

function UsersTable({ onEdit }: { onEdit: (id: number) => void }) {
  const [filters, setFilters] = useState<UserFilters>({ page: 1, search: '', status: 'all' });
  const deferredSearch = useDeferredValue(filters.search);
  const users = useUsers({ ...filters, search: deferredSearch });

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:px-5">
        <SearchInput
          className="sm:max-w-xs sm:flex-1"
          placeholder="Search name or email"
          aria-label="Search users"
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
        />
        <Select aria-label="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as UserFilters['status'], page: 1 })}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {users.isPending ? (
        <TableSkeleton />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description={filters.search ? 'Try a different search.' : 'Add your first staff member.'} />
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-fg-subtle">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.data.items.map((user) => (
                <tr key={user.id} className="hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <p className="font-medium text-fg">{user.name}</p>
                    <p className="text-xs text-fg-muted">{user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-fg-muted">{user.isOwner ? <Badge tone="info">Owner</Badge> : (user.roleName ?? 'No role')}</td>
                  <td className="px-5 py-3"><StatusBadge user={user} /></td>
                  <td className="px-5 py-3 text-fg-muted">{formatRelative(user.lastLoginAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(user.id)} aria-label={`Edit ${user.name}`}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile list */}
          <ul className="divide-y divide-border md:hidden">
            {users.data.items.map((user) => (
              <li key={user.id}>
                <button type="button" onClick={() => onEdit(user.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{user.name}</p>
                    <p className="truncate text-xs text-fg-muted">{user.isOwner ? 'Owner' : (user.roleName ?? 'No role')} · {formatRelative(user.lastLoginAt)}</p>
                  </div>
                  <StatusBadge user={user} />
                  <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPageChange={(page) => setFilters({ ...filters, page })} />
        </>
      )}
    </Panel>
  );
}

function RolesTable({ onEdit }: { onEdit: (role: Role) => void }) {
  const roles = useRoles();
  return (
    <Panel>
      {roles.isPending ? (
        <TableSkeleton rows={3} />
      ) : roles.error ? (
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      ) : roles.data.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No roles yet" description="Create a role to group permissions for similar staff." />
      ) : (
        <ul className="divide-y divide-border">
          {roles.data.map((role) => (
            <li key={role.id}>
              <button type="button" onClick={() => onEdit(role)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-surface-muted sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {role.name}
                    {role.isSystem && <Badge>Built-in</Badge>}
                  </p>
                  {role.description && <p className="mt-0.5 text-sm text-fg-muted">{role.description}</p>}
                </div>
                <div className="hidden shrink-0 text-right text-xs text-fg-muted sm:block">
                  <p>{role.permissions.length} permissions</p>
                  <p>
                    {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
