import { clsx } from 'clsx';
import { ChevronRight, Globe, Lock, Mail, Store, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useDeferredValue, useState } from 'react';
import { SearchInput } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { Sheet } from '@/components/ui/Sheet';
import { useCustomer, useCustomers, useSubscribers } from '@/features/customers/api';
import type { Channel } from '@/features/orders/api';
import { OrderStateBadge } from '@/features/orders/labels';
import { OrderSheet } from '@/features/orders/OrderSheet';
import { formatDateTime, formatRelative } from '@/lib/format';
import { formatPaise } from '@/lib/money';

type Tab = Channel | 'subscribers';

const TABS: { channel: Tab; label: string; icon: typeof Globe }[] = [
  { channel: 'online', label: 'Online customers', icon: Globe },
  { channel: 'offline', label: 'Offline customers', icon: Store },
  { channel: 'subscribers', label: 'Subscribers', icon: Mail },
];

export default function CustomersPage() {
  const [tab, setTab] = useState<Tab>('online');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const isSubscribers = tab === 'subscribers';
  // The customer list also supplies the counts shown on every tab.
  const channel: Channel = isSubscribers ? 'online' : tab;
  const customers = useCustomers(channel, isSubscribers ? 1 : page, isSubscribers ? '' : deferredSearch);
  const subscribers = useSubscribers(page, deferredSearch, isSubscribers);
  const [openId, setOpenId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="People who have ordered from you — online through the website, or offline in person and by phone." />

      <div role="tablist" aria-label="Customer type" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map(({ channel: value, label, icon: Icon }) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setPage(1);
              setSearch('');
            }}
            className={clsx(
              'group flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
              tab === value ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            <span className="rounded-md bg-gray-100 px-1.5 text-[10px] font-bold tabular-nums text-gray-600 group-aria-selected:bg-white/20 group-aria-selected:text-white">{customers.data?.counts[value] ?? '…'}</span>
          </button>
        ))}
      </div>
      {(isSubscribers ? subscribers.data?.piiHidden : customers.data?.piiHidden) && (
        <p className="flex items-center gap-2 rounded-lg bg-info-bg px-4 py-2.5 text-sm text-info">
          <Lock className="size-4" aria-hidden />
          Contact details are partly hidden. Ask the owner for the “view personal data” permission if you need them.
        </p>
      )}
      {isSubscribers ? (
        <SubscribersPanel
          query={subscribers}
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onPage={setPage}
        />
      ) : (
        <Panel>
          <div className="border-b border-border p-4 sm:px-5">
            <SearchInput
              className="sm:max-w-sm"
              placeholder={customers.data?.piiHidden ? 'Search by name' : 'Name, email or phone'}
              aria-label="Search customers"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {customers.isPending ? (
            <TableSkeleton />
          ) : customers.error ? (
            <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />
          ) : customers.data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? 'No matching customers' : channel === 'online' ? 'No online customers yet' : 'No offline customers yet'}
              description={search ? 'Try a different search.' : channel === 'online' ? 'Customers appear here when they order from the website.' : 'Customers appear here when you create an offline order.'}
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {customers.data.items.map((customer) => (
                  <li key={customer.id}>
                    <button type="button" onClick={() => setOpenId(customer.id)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-surface-muted sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{customer.name}</p>
                        <p className="truncate text-xs text-fg-muted">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="hidden text-right text-xs text-fg-muted sm:block">
                        <p>
                          {customer.orders} {customer.orders === 1 ? 'order' : 'orders'} · last {formatRelative(customer.lastOrderAt)}
                        </p>
                        <p className="text-sm font-medium text-fg tabular-nums">{formatPaise(customer.totalSpentPaise)} spent</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={customers.data.page} pageSize={customers.data.pageSize} total={customers.data.total} onPageChange={setPage} />
            </>
          )}
        </Panel>
      )}

      <CustomerSheet customerId={openId} onClose={() => setOpenId(null)} onOpenOrder={setOrderId} />
      <OrderSheet orderId={orderId} onClose={() => setOrderId(null)} />
    </div>
  );
}

function CustomerSheet({ customerId, onClose, onOpenOrder }: { customerId: number | null; onClose: () => void; onOpenOrder: (id: number) => void }) {
  const query = useCustomer(customerId);
  const data = query.data;
  return (
    <Sheet open={customerId != null} onClose={onClose} title={data?.customer.name ?? 'Customer'} description={data ? `Customer since ${formatDateTime(data.customer.createdAt)}` : undefined}>
      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-muted" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-surface-muted p-4 text-center">
            <div>
              <dt className="text-xs text-fg-subtle">Orders</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{data!.customer.orders}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Paid</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{data!.customer.paidOrders}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Spent</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatPaise(data!.customer.totalSpentPaise)}</dd>
            </div>
          </dl>
          <section className="space-y-1 text-sm">
            <h3 className="mb-1 font-semibold">Contact</h3>
            {data!.customer.email && <p>{data!.customer.email}</p>}
            <p>{data!.customer.phone}</p>
            {data!.customer.lastAddress && (
              <p className="pt-2 text-fg-muted">
                {data!.customer.lastAddress.line1}
                {data!.customer.lastAddress.line2 && `, ${data!.customer.lastAddress.line2}`}
                <br />
                {data!.customer.lastAddress.city}, {data!.customer.lastAddress.state} {data!.customer.lastAddress.pincode}
              </p>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Orders</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data!.orders.map((order) => (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-muted">
                    <span className="font-mono">{order.orderNumber}</span>
                    <Badge tone={order.channel === 'offline' ? 'info' : 'neutral'}>{order.channel === 'offline' ? 'Offline' : 'Online'}</Badge>
                    <OrderStateBadge order={order} />
                    <span className="ml-auto tabular-nums">{formatPaise(order.totalPaise)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Sheet>
  );
}

function SubscribersPanel({ query, search, onSearch, onPage }: { query: ReturnType<typeof useSubscribers>; search: string; onSearch: (value: string) => void; onPage: (page: number) => void }) {
  return (
    <Panel>
      <div className="border-b border-border p-4 sm:px-5">
        <SearchInput className="sm:max-w-sm" placeholder={query.data?.piiHidden ? 'Search by name' : 'Name or email'} aria-label="Search subscribers" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Mail} title={search ? 'No matching subscribers' : 'No subscribers yet'} description={search ? 'Try a different search.' : 'People who sign up with “Stay updated” on the website appear here.'} />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {query.data.items.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="truncate text-xs text-fg-muted">{s.email}</p>
                </div>
                <p className="text-right text-xs text-fg-muted">Joined {formatRelative(s.createdAt)}</p>
              </li>
            ))}
          </ul>
          <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPageChange={onPage} />
        </>
      )}
    </Panel>
  );
}
