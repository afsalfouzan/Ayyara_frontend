import { ChevronDown, ScrollText } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { FILTER_PRESETS } from '@/features/reports/range';
import { useDeferredValue, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { useAuditActions, useAuditLogs, type AuditFilters, type AuditLog } from '@/features/audit/api';
import { formatDateTime } from '@/lib/format';

const EMPTY: AuditFilters = { page: 1, search: '', action: '', from: '', to: '' };

function toneOf(action: string) {
  if (/failed|locked|blocked|deactivated|deleted/.test(action)) return 'danger' as const;
  if (/password|role|permission/.test(action)) return 'warning' as const;
  if (/created|login$/.test(action)) return 'success' as const;
  return 'neutral' as const;
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY);
  const deferredSearch = useDeferredValue(filters.search);
  const logs = useAuditLogs({ ...filters, search: deferredSearch });
  const actions = useAuditActions();
  const filtered = Object.entries(filters).some(([key, value]) => key !== 'page' && value);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="A permanent record of sign-ins and administrative changes. Times are shown in your local timezone." />
      <Panel>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <SearchInput placeholder="Search summary or user" aria-label="Search audit log" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
          <Select aria-label="Action" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value, page: 1 })}>
            <option value="">All actions</option>
            {actions.data?.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
          <DateRangePicker label="Date" className="w-full sm:w-64" value={{ from: filters.from, to: filters.to }} presets={FILTER_PRESETS} clearable onChange={(r) => setFilters({ ...filters, from: r.from, to: r.to, page: 1 })} />
          {filtered && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilters(EMPTY)}>
              Clear
            </Button>
          )}
        </div>

        {logs.isPending ? (
          <TableSkeleton rows={8} />
        ) : logs.error ? (
          <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
        ) : logs.data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No matching entries" description={filtered ? 'Try widening the filters.' : 'Activity will appear here.'} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {logs.data.items.map((log) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </ul>
            <Pagination page={logs.data.page} pageSize={logs.data.pageSize} total={logs.data.total} onPageChange={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </Panel>
    </div>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const hasDetails = Boolean(log.metadata && Object.keys(log.metadata).length) || log.ip;
  return (
    <li>
      <details className="group">
        <summary className={`grid list-none gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-4 sm:px-5 ${hasDetails ? 'cursor-pointer hover:bg-surface-muted' : ''}`}>
          <time dateTime={log.createdAt} className="text-xs text-fg-muted tabular-nums">
            {formatDateTime(log.createdAt)}
          </time>
          <div className="min-w-0">
            <p className="text-sm text-fg">{log.summary}</p>
            <p className="truncate text-xs text-fg-muted">{log.actorLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={toneOf(log.action)} className="font-mono">
              {log.action}
            </Badge>
            {hasDetails && <ChevronDown className="size-4 text-fg-subtle transition-transform group-open:rotate-180" aria-hidden />}
          </div>
        </summary>
        {hasDetails && (
          <div className="space-y-3 border-t border-border bg-surface-muted px-4 py-3 text-xs sm:px-5">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="text-fg-subtle">Time</dt>
              <dd className="text-fg">{formatDateTime(log.createdAt, true)}</dd>
              {log.entityType && (
                <>
                  <dt className="text-fg-subtle">Record</dt>
                  <dd className="text-fg">
                    {log.entityType} #{log.entityId}
                  </dd>
                </>
              )}
              {log.ip && (
                <>
                  <dt className="text-fg-subtle">IP address</dt>
                  <dd className="font-mono text-fg">{log.ip}</dd>
                </>
              )}
              {log.userAgent && (
                <>
                  <dt className="text-fg-subtle">Device</dt>
                  <dd className="break-all text-fg-muted">{log.userAgent}</dd>
                </>
              )}
            </dl>
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-[0.75rem] leading-relaxed text-fg">{JSON.stringify(log.metadata, null, 2)}</pre>
            )}
          </div>
        )}
      </details>
    </li>
  );
}
