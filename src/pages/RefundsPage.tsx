import { clsx } from 'clsx';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { OrderSheet } from '@/features/orders/OrderSheet';
import { REFUND_STATUS_LABEL, STOCK_ACTION_LABEL, useRefunds, useSyncRefund } from '@/features/payments/api';
import { messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';

const TABS = [
  { status: 'all', label: 'All' },
  { status: 'pending', label: 'Processing' },
  { status: 'processed', label: 'Refunded' },
  { status: 'failed', label: 'Failed' },
] as const;

export default function RefundsPage() {
  const { can } = useSession();
  const [status, setStatus] = useState<(typeof TABS)[number]['status']>('all');
  const [page, setPage] = useState(1);
  const refunds = useRefunds(status, page);
  const sync = useSyncRefund();
  const [orderId, setOrderId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Refunds" description="Refunds are issued from an order. They show as refunded only after Razorpay confirms them." />
      <div role="tablist" aria-label="Refund status" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            role="tab"
            type="button"
            aria-selected={status === tab.status}
            onClick={() => {
              setStatus(tab.status);
              setPage(1);
            }}
            className={clsx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors', status === tab.status ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Panel>
        {refunds.isPending ? (
          <TableSkeleton />
        ) : refunds.error ? (
          <ErrorState error={refunds.error} onRetry={() => void refunds.refetch()} />
        ) : refunds.data.items.length === 0 ? (
          <EmptyState icon={RotateCcw} title="No refunds" description="To refund a customer, open the order and choose Issue refund." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {refunds.data.items.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setOrderId(r.orderId)} className="font-mono text-sm hover:underline">
                        {r.orderNumber}
                      </button>
                      <Badge tone={r.status === 'processed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{REFUND_STATUS_LABEL[r.status]}</Badge>
                      <span className="text-xs text-fg-muted">{STOCK_ACTION_LABEL[r.stockAction]}</span>
                      {r.automatic && <Badge tone="info">Automatic</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-sm">{r.reason}</p>
                    <p className="text-xs text-fg-muted">
                      {r.customerName} · {formatDateTime(r.createdAt)}
                      {r.initiatedBy && ` · by ${r.initiatedBy}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status === 'pending' && can('refunds.create') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={sync.isPending && sync.variables === r.id}
                        onClick={() => sync.mutate(r.id, { onSuccess: (d) => toast(`Refund ${REFUND_STATUS_LABEL[d.refund.status].toLowerCase()}`), onError: (e) => toast(messageOf(e), 'error') })}
                      >
                        <RefreshCw className="size-3.5" aria-hidden />
                        Check
                      </Button>
                    )}
                    <span className="text-sm font-semibold tabular-nums">−{formatPaise(r.amountPaise)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={refunds.data.page} pageSize={refunds.data.pageSize} total={refunds.data.total} onPageChange={setPage} />
          </>
        )}
      </Panel>
      <OrderSheet orderId={orderId} onClose={() => setOrderId(null)} />
    </div>
  );
}
