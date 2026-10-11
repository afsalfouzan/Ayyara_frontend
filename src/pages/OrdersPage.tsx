import { clsx } from 'clsx';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { FILTER_PRESETS } from '@/features/reports/range';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { SearchInput } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { useOrders, type OrderFilters, type OrderView } from '@/features/orders/api';
import { OrderStateBadge } from '@/features/orders/labels';
import { OrderSheet } from '@/features/orders/OrderSheet';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';

const TABS: { view: OrderView; label: string }[] = [
  { view: 'all', label: 'All' },
  { view: 'awaiting_payment', label: 'Awaiting payment' },
  { view: 'to_pack', label: 'To pack' },
  { view: 'dispatched', label: 'Dispatched' },
  { view: 'delivered', label: 'Delivered' },
  { view: 'closed', label: 'Cancelled / expired' },
];

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({ channel: 'online', view: 'all', page: 1, search: '', from: '', to: '' });
  const orders = useOrders({ ...filters, search: useDeferredValue(filters.search) });
  const [openId, setOpenId] = useState<number | null>(null);
  const update = (patch: Partial<OrderFilters>) => setFilters({ ...filters, ...patch, page: patch.page ?? 1 });

  return (
    <div className="space-y-6">
      <PageHeader title="Online Orders" description="Website orders. Payment and packing are tracked separately. In-person sales are under Offline Orders." />

      <div role="tablist" aria-label="Order status" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map(({ view, label }) => (
          <button
            key={view}
            role="tab"
            type="button"
            aria-selected={filters.view === view}
            onClick={() => update({ view })}
            className={clsx('group flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors', filters.view === view ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
          >
            {label}
            {orders.data && orders.data.counts[view] > 0 && <span className="rounded-md bg-gray-100 px-1.5 text-[10px] font-bold tabular-nums text-gray-600 group-aria-selected:bg-white/20 group-aria-selected:text-white">{orders.data.counts[view]}</span>}
          </button>
        ))}
      </div>

      <Panel>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_auto_auto] sm:px-5">
          <SearchInput placeholder="Order number, name, email or phone" aria-label="Search orders" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          <DateRangePicker label="Order date" className="w-full sm:w-64" value={{ from: filters.from, to: filters.to }} presets={FILTER_PRESETS} clearable onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
        {orders.isPending ? (
          <TableSkeleton />
        ) : orders.error ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.items.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No orders here" description={filters.search ? 'Try a different search.' : 'New orders from the website appear here automatically.'} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {orders.data.items.map((order) => (
                <li key={order.id}>
                  <button type="button" onClick={() => setOpenId(order.id)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-surface-muted sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{order.orderNumber}</span>
                        <OrderStateBadge order={order} />
                      </p>
                      <p className="mt-0.5 truncate text-sm text-fg">
                        {order.customerName} <span className="text-fg-muted">· {order.shipping.city}</span>
                      </p>
                      <p className="truncate text-xs text-fg-muted">
                        {formatDateTime(order.createdAt)} · {order.itemSummary}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatPaise(order.totalPaise)}</span>
                    <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={orders.data.page} pageSize={orders.data.pageSize} total={orders.data.total} onPageChange={(page) => update({ page })} />
          </>
        )}
      </Panel>

      <OrderSheet orderId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
