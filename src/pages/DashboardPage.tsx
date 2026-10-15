import { clsx } from 'clsx';
import { BarChart3, Boxes, IndianRupee, Layers, PackageCheck, PieChart as PieIcon, ReceiptText, RefreshCw, ShoppingBag, Sparkles, Store, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/ui/DataState';
import { ACCENTS } from '@/components/ui/accents';
import { ModuleCard, Panel, SectionCard } from '@/components/ui/Panel';
import { KpiCard } from '@/components/ui/StatTile';
import { BalanceStrip } from '@/features/accounts/BalanceStrip';
import { useSession } from '@/features/auth/session';
import { OrderStateBadge } from '@/features/orders/labels';
import { useDashboard, type Attention, type Report } from '@/features/reports/api';
import { ChannelPie, LowStockCard, PerfumeBarChart, SalesTrendChart } from '@/features/reports/charts';
import { defaultGroupBy, presetRange, type PresetKey, type Range } from '@/features/reports/range';
import { RangePicker } from '@/features/reports/RangePicker';
import { formatRelative } from '@/lib/format';
import { formatPaise } from '@/lib/money';

const RANGE_TABS: { key: Exclude<PresetKey, 'custom' | 'all'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'month', label: 'This Month' },
];

export default function DashboardPage() {
  const { user, can } = useSession();
  const [range, setRange] = useState<Range>(() => presetRange('7d'));
  const query = useDashboard(range.from, range.to, defaultGroupBy(range));
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-neutral-900 sm:text-xl">Welcome back{firstName ? `, ${firstName}` : ''} 👋</h1>
              {user?.role && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">
                  <Sparkles className="size-3" aria-hidden />
                  {user.role}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
              <Store className="size-3.5" aria-hidden />
              Ayyara Rebirth
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                Online store + offline sales · India time
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Period" className="flex min-w-0 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1">
            {RANGE_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={range.preset === tab.key}
                onClick={() => setRange(presetRange(tab.key))}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
                  range.preset === tab.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-gray-500 hover:text-neutral-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <RangePicker value={range} onChange={setRange} iconOnly />
          <button
            type="button"
            onClick={() => void query.refetch()}
            aria-label="Refresh"
            className="grid size-[38px] shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={clsx('size-4', query.isFetching && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </section>

      {can('accounts.view') && <BalanceStrip />}

      {query.error && !query.data ? (
        <Panel>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Panel>
      ) : !query.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
      ) : (
        <DashboardBody report={query.data.report} attention={query.data.attention} canSeeOrders={can('orders.view')} canSeeStock={can('inventory.view')} />
      )}
    </div>
  );
}

/* ---------- Page body ---------- */

function DashboardBody({ report, attention, canSeeOrders, canSeeStock }: { report: Report; attention: Attention; canSeeOrders: boolean; canSeeStock: boolean }) {
  const t = report.totals;
  const f = report.financial;
  const online = report.channels.find((c) => c.channel === 'online')!;
  const offline = report.channels.find((c) => c.channel === 'offline')!;
  const lowCount = attention.stock.lowStock + attention.stock.outOfStock;
  const toHandle = attention.toPackOnline + attention.toPackOffline;
  const top = report.products.slice(0, 5);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <li>
          <KpiCard label="Net Sales" value={formatPaise(t.netSalesPaise)} icon={IndianRupee} color="blue" highlight pill={t.refundsPaise ? `−${formatPaise(t.refundsPaise)} refunds` : plural(t.orders, 'order')} link={{ to: '/reports', label: 'Reports' }} />
        </li>
        <li>
          {f ? (
            <KpiCard
              label="Gross Profit"
              value={f.grossProfitPaise != null ? formatPaise(f.grossProfitPaise) : '—'}
              icon={TrendingUp}
              color="emerald"
              highlight
              pill={f.marginPercent != null ? `${f.marginPercent}% margin` : 'No costs yet'}
              pillColor={f.marginPercent != null ? 'emerald' : 'orange'}
              link={{ to: '/reports', label: 'Profit' }}
            />
          ) : (
            <KpiCard label="To Collect" value={formatPaise(attention.toCollectPaise)} icon={Wallet} color="emerald" highlight pill={`${attention.toCollectOrders} unpaid`} link={{ to: '/offline-orders', label: 'Offline' }} />
          )}
        </li>
        <li>
          <KpiCard label="Online Sales" value={formatPaise(online.salesPaise)} icon={ShoppingBag} color="indigo" pill={plural(online.orders, 'order')} link={{ to: '/orders', label: 'Orders' }} />
        </li>
        <li>
          <KpiCard label="Offline Sales" value={formatPaise(offline.salesPaise)} icon={Store} color="orange" pill={plural(offline.orders, 'order')} link={{ to: '/offline-orders', label: 'Orders' }} />
        </li>
        <li>
          <KpiCard label="Bottles Sold" value={t.unitsSold} icon={PackageCheck} color="purple" pill={t.orders ? `Avg ${formatPaise(t.averageOrderPaise)}` : 'No orders yet'} />
        </li>
        <li>
          <KpiCard
            label="In Stock Now"
            value={attention.stock.available}
            icon={Boxes}
            color="teal"
            highlight={lowCount > 0}
            pill={lowCount ? `${lowCount} running low` : 'All well stocked'}
            pillColor={lowCount ? 'rose' : 'teal'}
            link={{ to: '/stock', label: 'Stock' }}
          />
        </li>
      </ul>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <SectionCard icon={BarChart3} title="Daily Sales Trend" subtitle={`Online + offline revenue per ${report.groupBy} (₹)`} link={{ to: '/reports', label: 'All Reports', external: true }}>
          <SalesTrendChart report={report} />
        </SectionCard>
        <SectionCard icon={Trophy} iconClass="text-amber-500" title="Top Selling Perfumes" subtitle="Highest revenue items" link={canSeeStock ? { to: '/stock', label: 'Stock' } : undefined}>
          {top.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No sales in this period</p>
          ) : (
            <ol className="space-y-2.5">
              {top.map((p, i) => (
                <li key={p.variantId} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[11px] font-bold text-white">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {p.productName} <span className="font-medium text-gray-400">· {p.sizeMl} ML</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{p.units} sold</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-600">{formatPaise(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <SectionCard icon={PieIcon} iconClass="text-blue-600" title="Online vs Offline" subtitle="Share of sales in this period">
          <ChannelPie report={report} />
        </SectionCard>
        <SectionCard icon={BarChart3} iconClass="text-indigo-600" title="Sales by Perfume" subtitle="Top perfumes by sales value" link={{ to: '/reports', label: 'Full Report' }}>
          <PerfumeBarChart products={report.products} height={260} />
        </SectionCard>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
            <Layers className="size-4 text-gray-500" aria-hidden />
            Store Operations Overview
          </h2>
          <span className="hidden text-[11px] font-medium text-gray-500 sm:block">1-Click Direct Page Access</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ModuleCard
            icon={ReceiptText}
            accent="emerald"
            title="Sales"
            badge={{ text: 'Active', accent: 'emerald' }}
            rows={[
              { label: 'Online orders:', value: `${online.orders} · ${formatPaise(online.salesPaise)}`, to: '/orders' },
              { label: 'Offline orders:', value: `${offline.orders} · ${formatPaise(offline.salesPaise)}`, to: '/offline-orders' },
              { label: 'Refunds:', value: formatPaise(t.refundsPaise), to: '/refunds' },
              { label: 'Net sales:', value: formatPaise(t.netSalesPaise), accent: 'emerald' },
            ]}
          />
          <ModuleCard
            icon={PackageCheck}
            accent="blue"
            title="Orders to Handle"
            badge={toHandle > 0 ? { text: `${toHandle} pending`, accent: 'orange' } : { text: 'All clear', accent: 'blue' }}
            rows={[
              { label: 'Online to pack / dispatch:', value: attention.toPackOnline, to: '/orders', accent: attention.toPackOnline ? 'orange' : undefined },
              { label: 'Offline to deliver:', value: attention.toPackOffline, to: '/offline-orders', accent: attention.toPackOffline ? 'orange' : undefined },
              { label: 'Awaiting payment:', value: attention.awaitingPayment, to: '/orders' },
              { label: 'Money to collect:', value: formatPaise(attention.toCollectPaise), to: '/offline-orders', accent: attention.toCollectPaise ? 'rose' : undefined },
            ]}
          />
          <ModuleCard
            icon={Boxes}
            accent="orange"
            title="Stock & Inventory"
            badge={{ text: `${lowCount} low alert`, accent: lowCount ? 'rose' : 'orange' }}
            rows={[
              { label: 'Bottles in godown:', value: attention.stock.onHand, to: '/stock' },
              { label: 'Available to sell:', value: attention.stock.available },
              { label: 'Received this period:', value: report.stockFlow.received },
              { label: 'Reorder needed:', value: plural(lowCount, 'item'), to: '/stock', accent: lowCount ? 'rose' : undefined },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {canSeeOrders && (
          <SectionCard icon={ReceiptText} iconClass="text-gray-500" title="Latest Orders" subtitle="Online and offline">
            {attention.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No orders yet.</p>
            ) : (
              <ul className="-mx-5 -my-4 divide-y divide-gray-100">
                {attention.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link to={o.channel === 'offline' ? '/offline-orders' : '/orders'} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-900">{o.orderNumber}</span>
                          <span className={clsx('rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase', o.channel === 'offline' ? ACCENTS.orange.pill : ACCENTS.indigo.pill)}>{o.channel}</span>
                          <OrderStateBadge order={o as Parameters<typeof OrderStateBadge>[0]['order']} />
                        </p>
                        <p className="truncate text-[11px] text-gray-500">
                          {o.customerName} · {formatRelative(o.createdAt)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-neutral-900">{formatPaise(o.totalPaise)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
        {canSeeStock && <LowStockCard items={attention.lowStock} />}
      </div>
    </>
  );
}
