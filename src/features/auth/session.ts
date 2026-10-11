import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Permission } from '@/lib/permissions';

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
  mustChangePassword: boolean;
  permissions: Permission[];
};

export const sessionQueryKey = ['session'] as const;

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const { user } = await api<{ user: SessionUser }>('/admin/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  });

  const user = query.data ?? null;
  const can = useCallback(
    (permission: Permission) => Boolean(user && (user.isOwner || user.permissions.includes(permission))),
    [user],
  );

  return { user, can, isLoading: query.isPending, error: query.error, refetch: query.refetch };
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await api('/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    // Drop every cached response so nothing from this session survives in memory.
    queryClient.clear();
    queryClient.setQueryData(sessionQueryKey, null);
  }, [queryClient]);
}
