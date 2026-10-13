import { clsx } from 'clsx';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { FILTER_PRESETS } from '@/features/reports/range';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Download, Globe, Hourglass, Landmark, RotateCcw, Store, XCircle } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { OrderSheet } from '@/features/orders/OrderSheet';
import { RazorpayDialog } from '@/features/settings/RazorpayDialog';
import { methodLabel, usePayments, type PaymentFilters, type PaymentRow, type PaymentSummary } from '@/features/payments/api';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';

const CHANNELS: { channel: PaymentFilters['channel']; label: string }[] = [
  { channel: 'online', label: 'Online' },
  { channel: 'offline', label: 'Offline' },
];

const TABS: { status: PaymentFilters['status']; label: string }[] = [
  { status: 'all', label: 'All' },
  { status: 'successful', label: 'Successful' },
  { status: 'failed', label: 'Failed' },
  { status: 'refunded', label: 'Refunded' },
];

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const payments = (count: number) => `${count} payment${count === 1 ? '' : 's'}`;

/** Online money first (received, on its way, in the bank), then offline, then the rest. */
function SummaryCards({ summary }: { summary: PaymentSummary }) {
  const { online, offline, refunded, payouts } = summary;
  const refundedPaise = refunded.onlinePaise + refunded.offlinePaise;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      <StatTile label="Online received" value={formatPaise(online.receivedPaise)} hint={`${payments(online.count)} on the website`} icon={Globe} color="blue" highlight />
      {payouts && (
        <>
          <StatTile
            label="On the way to bank"
            value={formatPaise(payouts.onTheWayPaise)}
            hint={
              payouts.onTheWayCount === 0
                ? 'Nothing waiting at Razorpay'
                : `${payments(payouts.onTheWayCount)} · ${payouts.feesKnown ? `after ${formatPaise(payouts.feesPaise)} Razorpay fees` : 'before some Razorpay fees'}`
            }
            icon={Hourglass}
            color="orange"
            highlight={payouts.onTheWayPaise > 0}
          />
          <StatTile
            label="Credited to bank"
            value={formatPaise(payouts.creditedPaise)}
            hint={payouts.payoutCount === 0 ? 'No Razorpay payouts yet' : `${payouts.payoutCount} payout${payouts.payoutCount === 1 ? '' : 's'}${payouts.lastPayoutAt ? ` · last on ${shortDate.format(new Date(payouts.lastPayoutAt))}` : ''}`}
            icon={Landmark}
            color="emerald"
            highlight={payouts.creditedPaise > 0}
            link={{ to: '/accounts', label: 'Accounts' }}
          />
        </>
      )}
      <StatTile
        label="Offline received"
        value={formatPaise(offline.receivedPaise)}
        hint={offline.count === 0 ? 'No offline payments' : `${payments(offline.count)} · ${formatPaise(offline.cashPaise)} cash · ${formatPaise(offline.otherPaise)} UPI, card & other`}
        icon={Store}
        color="emerald"
        highlight
      />
      <StatTile
        label="Refunded"
        value={formatPaise(refundedPaise)}
        hint={refundedPaise === 0 ? 'No refunds' : `${formatPaise(refunded.onlinePaise)} online · ${formatPaise(refunded.offlinePaise)} offline`}
        icon={RotateCcw}
        color="purple"
      />
      <StatTile label="Failed attempts" value={online.failed} hint="Website payments that didn’t go through" icon={XCircle} color={online.failed ? 'rose' : 'gray'} highlight={online.failed > 0} />
      <StatTile label="Awaiting payment" value={summary.awaitingPayment} hint="Website orders with stock reserved" icon={Clock} color="orange" />
    </div>
  );
}

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

function StatusBadge({ payment }: { payment: PaymentRow }) {
  if (payment.status === 'failed') return <Badge tone="danger"><XCircle className="size-3" aria-hidden />Failed</Badge>;
  if (payment.status === 'refunded') return <Badge tone="neutral"><RotateCcw className="size-3" aria-hidden />Refunded</Badge>;
  if (payment.status === 'partially_refunded') return <Badge tone="warning"><RotateCcw className="size-3" aria-hidden />Partly refunded</Badge>;
  if (payment.status === 'captured') return <Badge tone="success"><CheckCircle2 className="size-3" aria-hidden />Successful</Badge>;
  return <Badge tone="warning"><Clock className="size-3" aria-hidden />Pending</Badge>;
}

export default function PaymentsPage() {
  const { can, user } = useSession();
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [filters, setFilters] = useState<PaymentFilters>({ channel: 'online', status: 'all', page: 1, search: '', from: '', to: '' });
  const list = usePayments({ ...filters, search: useDeferredValue(filters.search) });
  const offline = filters.channel === 'offline';
  const [orderId, setOrderId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const update = (patch: Partial<PaymentFilters>) => setFilters({ ...filters, ...patch, page: patch.page ?? 1 });

  async function downloadCsv() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ channel: filters.channel, status: filters.status });
      for (const key of ['search', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key]);
      const response = await fetch(`${API_URL}/admin/payments/export.csv?${params}`, { credentials: 'include', headers: { 'X-Requested-With': 'ayyara-admin' } });
      if (!response.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement('a'), { href: url, download: `ayyara-${filters.channel}-payments-${new Date().toISOString().slice(0, 10)}.csv` });
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Could not export payments. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  const summary = list.data?.summary;
  const configured = list.data?.configured;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Transactions"
        description="Every payment received: website payments through Razorpay, and payments taken on offline bills."
        actions={
          can('reports.export') && (
            <Button variant="secondary" onClick={downloadCsv} loading={downloading}>
              <Download className="size-4" aria-hidden />
              Export {offline ? 'offline' : 'online'} CSV
            </Button>
          )
        }
      />

      {configured && !configured.payments && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">Razorpay is not connected, so customers can’t pay online yet.</span>
          {user?.isOwner && (
            <Button size="sm" onClick={() => setCredentialsOpen(true)}>
              Connect Razorpay
            </Button>
          )}
        </p>
      )}
      {configured?.payments && !configured.webhook && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">The Razorpay webhook secret isn’t set. Payments still work, but orders won’t be confirmed if a customer closes the browser right after paying.</span>
          {user?.isOwner && (
            <Button size="sm" variant="secondary" onClick={() => setCredentialsOpen(true)}>
              Add webhook secret
            </Button>
          )}
        </p>
      )}
      {configured?.mode === 'test' && <Badge tone="info">Razorpay test mode — no real money moves</Badge>}

      {summary && <SummaryCards summary={summary} />}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Online or offline payments" className="flex w-fit max-w-full gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {CHANNELS.map(({ channel, label }) => (
            <button
              key={channel}
              role="tab"
              type="button"
              aria-selected={filters.channel === channel}
              // Offline payments are recorded once taken, so they have no failed attempts to show.
              onClick={() => update({ channel, status: channel === 'offline' && filters.status === 'failed' ? 'all' : filters.status })}
              className={clsx('shrink-0 rounded-lg px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors', filters.channel === channel ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Payment status" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {TABS.filter(({ status }) => !(offline && status === 'failed')).map(({ status, label }) => (
            <button
              key={status}
              role="tab"
              type="button"
              aria-selected={filters.status === status}
              onClick={() => update({ status })}
              className={clsx('shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors', filters.status === status ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_auto_auto] sm:px-5">
          <SearchInput placeholder={offline ? 'Order number, reference or customer' : 'Order number, payment ID or customer'} aria-label="Search payments" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
          <DateRangePicker label="Order date" className="w-full sm:w-64" value={{ from: filters.from, to: filters.to }} presets={FILTER_PRESETS} clearable onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
        {list.isPending ? (
          <TableSkeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={CreditCard} title={offline ? 'No offline payments here' : 'No online payments here'} description={offline ? 'Payments appear as paid offline bills are saved.' : 'Payments appear as customers pay through Razorpay.'} />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-subtle">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">{offline ? 'Reference' : 'Payment ID'}</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.items.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOrderId(p.orderId)}>
                    <td className="px-5 py-3 text-fg-muted tabular-nums">{formatDateTime(p.createdAt)}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="font-mono text-sm hover:underline" onClick={() => setOrderId(p.orderId)}>
                        {p.orderNumber}
                      </button>
                      <p className="text-xs text-fg-muted">{p.customerName}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-fg-muted">{p.razorpayPaymentId ?? (p.reference || '—')}</td>
                    <td className="px-3 py-3">{methodLabel(p.method)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge payment={p} />
                      {p.errorDescription && <p className="mt-0.5 max-w-48 truncate text-xs text-fg-muted" title={p.errorDescription}>{p.errorDescription}</p>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatPaise(p.amountPaise)}
                      {p.refundedPaise > 0 && <p className="text-xs text-fg-muted">−{formatPaise(p.refundedPaise)} refunded</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-border md:hidden">
              {list.data.items.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOrderId(p.orderId)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm">{p.orderNumber}</p>
                      <p className="text-xs text-fg-muted">
                        {formatDateTime(p.createdAt)} · {methodLabel(p.method)}
                      </p>
                      <div className="mt-1">
                        <StatusBadge payment={p} />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatPaise(p.amountPaise)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={(page) => update({ page })} />
          </>
        )}
      </Panel>
      <OrderSheet orderId={orderId} onClose={() => setOrderId(null)} />
      <RazorpayDialog open={credentialsOpen} onClose={() => setCredentialsOpen(false)} />
    </div>
  );
}
