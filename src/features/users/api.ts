import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Permission } from '@/lib/permissions';

export type Override = { permission: Permission; effect: 'grant' | 'deny' };

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  roleId: number | null;
  roleName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserDetail = UserListItem & {
  lockedUntil: string | null;
  overrides: Override[];
  effectivePermissions: Permission[];
};

export type Role = {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
};

export type PermissionGroup = {
  group: string;
  permissions: { key: Permission; label: string; sensitive?: boolean }[];
};

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

export type UserFilters = { page: number; search: string; status: 'all' | 'active' | 'inactive' };

export function useUsers(filters: UserFilters) {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: '20', status: filters.status });
  if (filters.search) params.set('search', filters.search);
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => api<Page<UserListItem>>(`/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => api<{ user: UserDetail }>(`/admin/users/${id}`).then((data) => data.user),
    enabled: id != null,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: () => api<{ items: Role[] }>('/admin/roles').then((data) => data.items) });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['permission-catalog'],
    queryFn: () => api<{ groups: PermissionGroup[] }>('/admin/permissions').then((data) => data.groups),
    staleTime: Infinity,
  });
}

function useInvalidateAccess() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: ['users'] }), queryClient.invalidateQueries({ queryKey: ['roles'] })]);
}

export type CreateUserInput = { name: string; email: string; roleId: number | null; temporaryPassword: string; overrides?: Override[] };

export function useCreateUser() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api<{ user: UserDetail }>('/admin/users', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export type UpdateUserInput = { name?: string; roleId?: number | null; isActive?: boolean; overrides?: Override[] };

export function useUpdateUser(id: number) {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => api<{ user: UserDetail }>(`/admin/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useResetPassword(id: number) {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (temporaryPassword: string) => api<{ user: UserDetail }>(`/admin/users/${id}/reset-password`, { method: 'POST', body: { temporaryPassword } }),
    onSuccess: invalidate,
  });
}

export type RoleInput = { name: string; description: string; permissions: Permission[] };

export function useSaveRole(id: number | null) {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (input: RoleInput) =>
      id == null ? api<{ role: Role }>('/admin/roles', { method: 'POST', body: input }) : api<{ role: Role }>(`/admin/roles/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (id: number) => api(`/admin/roles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
