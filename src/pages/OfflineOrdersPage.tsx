import { clsx } from 'clsx';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { FILTER_PRESETS } from '@/features/reports/range';
import { Plus, Store } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { useSession } from '@/features/auth/session';
import { REGION_LABEL, useOrders, type OrderFilters, type OrderView, type SellingRegion } from '@/features/orders/api';
import { CreateOfflineOrderDialog } from '@/features/orders/CreateOfflineOrderDialog';
import { OrdersTable } from '@/features/orders/OrdersTable';
import { OrderSheet } from '@/features/orders/OrderSheet';

const TABS: { view: OrderView; label: string }[] = [
  { view: 'all', label: 'All' },
  { view: 'unpaid', label: 'Not paid' },
  { view: 'to_pack', label: 'To deliver' },
  { view: 'paid', label: 'Paid' },
  { view: 'cancelled', label: 'Cancelled' },
];

export default function OfflineOrdersPage() {
  const { can } = useSession();
  // Other pages can open this one on a tab, region and dates, e.g. the Profit page's "Still to collect" box.
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<OrderFilters>(() => {
    const view = TABS.find((tab) => tab.view === params.get('view'))?.view ?? 'all';
    const region = params.get('region') === 'india' || params.get('region') === 'uk' ? (params.get('region') as SellingRegion) : 'all';
    const day = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(params.get(key) ?? '') ? params.get(key)! : '');
    return { channel: 'offline', region, view, page: 1, search: '', from: day('from'), to: day('to') };
  });
  const orders = useOrders({ ...filters, search: useDeferredValue(filters.search) });
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const update = (patch: Partial<OrderFilters>) => setFilters({ ...filters, ...patch, page: patch.page ?? 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offline Orders"
        description="Sales made in person or over the phone, in India or the UK. Indian sales take bottles out of the godown; UK sales only record the amount."
        actions={
          can('orders.create_offline') && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              Create order
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Offline order status" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
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
          <SearchInput placeholder="Order number, name or phone" aria-label="Search offline orders" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          <Select aria-label="Selling region" className="w-full sm:w-40" value={filters.region ?? 'all'} onChange={(e) => update({ region: e.target.value as SellingRegion | 'all' })}>
            <option value="all">All regions</option>
            {(Object.keys(REGION_LABEL) as SellingRegion[]).map((region) => (
              <option key={region} value={region}>
                {REGION_LABEL[region]}
              </option>
            ))}
          </Select>
          <DateRangePicker label="Order date" className="w-full sm:w-64" value={{ from: filters.from, to: filters.to }} presets={FILTER_PRESETS} clearable onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
        {orders.isPending ? (
          <TableSkeleton />
        ) : orders.error ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.items.length === 0 ? (
          <EmptyState
            icon={Store}
            title={filters.search || filters.view !== 'all' || (filters.region ?? 'all') !== 'all' ? 'No matching offline orders' : 'No offline orders yet'}
            description="Record sales made at events, in person or by phone."
            action={can('orders.create_offline') && filters.view === 'all' && !filters.search && <Button onClick={() => setCreating(true)}>Create order</Button>}
          />
        ) : (
          <>
            <OrdersTable orders={orders.data.items} onOpen={setOpenId} />
            <Pagination page={orders.data.page} pageSize={orders.data.pageSize} total={orders.data.total} onPageChange={(page) => update({ page })} />
          </>
        )}
      </Panel>

      <CreateOfflineOrderDialog open={creating} onClose={() => setCreating(false)} onCreated={(order) => setOpenId(order.id)} />
      <OrderSheet orderId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
