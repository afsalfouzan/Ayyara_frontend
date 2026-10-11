import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Eye, Info, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

type Template = { key: string; label: string; enabled: boolean };
type Row = { id: number; orderNumber: string | null; template: string; recipient: string | null; subject: string | null; status: 'queued' | 'sent' | 'failed'; attempts: number; error: string | null; sentAt: string | null; createdAt: string };
type ListResponse = { items: Row[]; page: number; pageSize: number; total: number; templates: Template[]; delivery: { driver: 'log' | 'resend'; from: string } };

const DESCRIPTIONS: Record<string, string> = {
  order_confirmed: 'When an online order is paid, or an offline order is saved with an email address.',
  order_dispatched: 'When an order is marked dispatched, with the courier and tracking number.',
  order_delivered: 'When an order is marked delivered.',
  order_cancelled: 'When staff cancel an order.',
  refund_processed: 'When Razorpay confirms a refund, or an offline refund is recorded.',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'queued' | 'sent' | 'failed'>('all');
  const [preview, setPreview] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['notifications', page, status], queryFn: () => api<ListResponse>(`/admin/notifications?page=${page}&pageSize=25&status=${status}`), refetchInterval: 20_000 });
  const toggle = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) => api('/admin/notifications/settings', { method: 'PUT', body: { templates: { [input.key]: input.enabled } } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (e) => toast(messageOf(e), 'error'),
  });
  const resend = useMutation({
    mutationFn: (id: number) => api(`/admin/notifications/${id}/resend`, { method: 'POST' }),
    onSuccess: () => {
      toast('Email queued to send again');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const labelOf = (key: string) => list.data?.templates.find((t) => t.key === key)?.label ?? key;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Emails sent to customers about their orders." />

      {list.data?.delivery.driver === 'log' && (
        <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-bg px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Emails are recorded below but not actually sent yet. To send real emails, the developer connects an email service (Resend) for the store’s domain.
        </p>
      )}

      <Panel>
        <PanelHeader title="Customer emails" description={list.data ? `Sent from ${list.data.delivery.from}` : undefined} />
        <ul className="divide-y divide-border">
          {(list.data?.templates ?? []).map((t) => (
            <li key={t.key} className="flex items-center gap-4 px-5 py-3.5">
              <Mail className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-fg-muted">{DESCRIPTIONS[t.key]}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreview(t.key)}>
                <Eye className="size-3.5" aria-hidden />
                Preview
              </Button>
              <Switch label={`${t.label} email`} checked={t.enabled} disabled={toggle.isPending} onChange={(enabled) => toggle.mutate({ key: t.key, enabled })} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title="Sent emails"
          actions={
            <div className="flex gap-1">
              {(['all', 'sent', 'queued', 'failed'] as const).map((s) => (
                <button key={s} type="button" onClick={() => { setStatus(s); setPage(1); }} className={clsx('rounded-md px-2.5 py-1 text-xs capitalize', status === s ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-surface-muted')}>
                  {s}
                </button>
              ))}
            </div>
          }
        />
        {list.isPending ? (
          <TableSkeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={Mail} title="No emails yet" description="Emails appear here as orders are paid, dispatched, cancelled or refunded." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {list.data.items.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{labelOf(row.template)}</span>
                      {row.orderNumber && <span className="font-mono text-xs text-fg-muted">{row.orderNumber}</span>}
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      To {row.recipient} · {formatDateTime(row.sentAt ?? row.createdAt)}
                    </p>
                    {row.error && row.status !== 'sent' && <p className="truncate text-xs text-danger" title={row.error}>{row.error}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {row.status === 'sent' ? <Badge tone="success">Sent</Badge> : row.status === 'failed' ? <Badge tone="danger">Failed</Badge> : <Badge tone="warning">{row.attempts ? `Retrying (${row.attempts})` : 'Queued'}</Badge>}
                    {row.status !== 'queued' && (
                      <Button variant="ghost" size="sm" loading={resend.isPending && resend.variables === row.id} onClick={() => resend.mutate(row.id)}>
                        <RefreshCw className="size-3.5" aria-hidden />
                        Resend
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />
          </>
        )}
      </Panel>

      <PreviewDialog template={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewDialog({ template, onClose }: { template: string | null; onClose: () => void }) {
  const preview = useQuery({
    queryKey: ['notifications', 'preview', template],
    queryFn: () => api<{ subject: string; html: string }>(`/admin/notifications/preview/${template}`),
    enabled: template != null,
  });
  return (
    <Modal open={template != null} onClose={onClose} title="Email preview" description={preview.data?.subject ?? 'Sample with example data'}>
      {preview.data ? (
        // Rendered in a sandboxed frame: no scripts, isolated from the admin.
        <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[32rem] w-full rounded-lg border border-border bg-white" />
      ) : (
        <div className="h-[32rem] animate-pulse rounded-lg bg-surface-muted" />
      )}
    </Modal>
  );
}
