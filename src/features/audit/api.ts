import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AuditLog = {
  id: number;
  actorUserId: number | null;
  actorLabel: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditFilters = { page: number; search: string; action: string; from: string; to: string };

export function useAuditLogs(filters: AuditFilters) {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: '25' });
  for (const key of ['search', 'action', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key]);
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => api<{ items: AuditLog[]; page: number; pageSize: number; total: number }>(`/admin/audit-logs?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useAuditActions() {
  return useQuery({ queryKey: ['audit-logs', 'actions'], queryFn: () => api<{ items: string[] }>('/admin/audit-logs/actions').then((data) => data.items) });
}
