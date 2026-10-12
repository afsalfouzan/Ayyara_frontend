import { BarChart3, Boxes, CalendarDays, Download, IndianRupee, Lock, PieChart, ReceiptText, ShoppingBag, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/DataState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { useReport, type GroupBy, type Report } from '@/features/reports/api';
import { ChannelPie, SalesTrendChart } from '@/features/reports/charts';
import { defaultGroupBy, periodLabel, presetRange, type Range } from '@/features/reports/range';
import { RangePicker } from '@/features/reports/RangePicker';
import { formatPaise } from '@/lib/money';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export default function ReportsPage() {
  const { can } = useSession();
  const [range, setRange] = useState<Range>(() => presetRange('30d'));
  const [groupBy, setGroupBy] = useState<GroupBy | 'auto'>('auto');
  const effectiveGroup = groupBy === 'auto' ? defaultGroupBy(range) : groupBy;
  const report = useReport(range.from, range.to, effectiveGroup);
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportCsv(kind: 'sales' | 'products') {
    setExporting(kind);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, groupBy: effectiveGroup, kind });
      const response = await fetch(`${API_URL}/admin/reports/export.csv?${params}`, { credentials: 'include', headers: { 'X-Requested-With': 'ayyara-admin' } });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      Object.assign(document.createElement('a'), { href: url, download: `ayyara-${kind}-${range.from}-to-${range.to}.csv` }).click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Could not export the report. Please try again.', 'error');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Online and offline sales, products and stock movement. Days are in India time."
        actions={
          can('reports.export') && (
            <>
              <Button variant="secondary" size="sm" loading={exporting === 'sales'} onClick={() => void exportCsv('sales')}>
                <Download className="size-3.5" aria-hidden />
                Sales CSV
              </Button>
              <Button variant="secondary" size="sm" loading={exporting === 'products'} onClick={() => void exportCsv('products')}>
                <Download className="size-3.5" aria-hidden />
                Products CSV
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <RangePicker value={range} onChange={setRange} />
        <Select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy | 'auto')}>
          <option value="auto">Group: automatic</option>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </Select>
      </div>

      {report.error && !report.data ? (
        <Panel>
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        </Panel>
      ) : !report.data ? (
        <div className="h-96 animate-pulse rounded-xl bg-gray-200/60" />
      ) : (
        <ReportBody report={report.data} />
      )}
    </div>
  );
}

function ReportBody({ report }: { report: Report }) {
  const t = report.totals;
  const f = report.financial;
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <StatTile label="Net sales" value={formatPaise(t.netSalesPaise)} hint={`${formatPaise(t.grossSalesPaise)} sales − ${formatPaise(t.refundsPaise)} refunds`} icon={IndianRupee} color="blue" highlight />
        </li>
        <li>
          <StatTile label="Orders" value={t.orders} hint={report.channels.map((c) => `${c.orders} ${c.channel}`).join(' · ')} icon={ReceiptText} color="neutral" />
        </li>
        <li>
          <StatTile label="Bottles sold" value={t.unitsSold} hint={`Average order ${formatPaise(t.averageOrderPaise)}`} icon={ShoppingBag} color="purple" />
        </li>
        <li>
          <StatTile label="Bottles received" value={report.stockFlow.received} hint="From purchases" icon={Boxes} color="teal" />
        </li>
      </ul>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel>
          <PanelHeader icon={BarChart3} iconClass="text-emerald-600" title="Sales Trend" description={`Per ${report.groupBy} · online + offline`} />
          <div className="px-5 pt-3 pb-5">
            <SalesTrendChart report={report} height={280} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader icon={PieChart} iconClass="text-blue-600" title="Online vs Offline" description="Share of sales in this period" />
          <div className="p-5">
            <ChannelPie report={report} />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader icon={Trophy} iconClass="text-amber-500" title="Sales by perfume" description="Booked orders in this period" />
        {report.products.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-fg-muted">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-subtle">
                  <th className="px-5 py-3 font-medium">Perfume</th>
                  <th className="px-3 py-3 text-right font-medium">Online</th>
                  <th className="px-3 py-3 text-right font-medium">Offline</th>
                  <th className="px-3 py-3 text-right font-medium">Units</th>
                  <th className="px-3 py-3 text-right font-medium">Revenue</th>
                  <th className="px-3 py-3 text-right font-medium">Share</th>
                  {f && <th className="px-3 py-3 text-right font-medium">Cost</th>}
                  {f && <th className="px-5 py-3 text-right font-medium">Gross profit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.products.map((p) => {
                  const cost = f?.byProduct.find((b) => b.variantId === p.variantId);
                  return (
                    <tr key={p.variantId}>
                      <td className="px-5 py-2.5">
                        {p.productName} <span className="text-fg-muted">· {p.sizeMl} ML</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.online}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.offline}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{p.units}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatPaise(p.revenue)}</td>
                      <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{(p.share * 100).toFixed(1)}%</td>
                      {f && <td className="px-3 py-2.5 text-right tabular-nums">{cost?.costPaise != null ? formatPaise(cost.costPaise) : <span className="text-fg-subtle">no cost</span>}</td>}
                      {f && <td className="px-5 py-2.5 text-right tabular-nums">{cost?.profitPaise != null ? formatPaise(cost.profitPaise) : '—'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader icon={ReceiptText} iconClass="text-indigo-600" title="Orders by status" description="All orders placed in this period" />
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
            {(
              [
                ['Completed', report.orderStatus.completed],
                ['In progress', report.orderStatus.inProgress],
                ['Awaiting payment', report.orderStatus.awaitingPayment],
                ['Cancelled', report.orderStatus.cancelled],
                ['Expired (not paid)', report.orderStatus.expired],
                ['Returned', report.orderStatus.returned],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="bg-surface px-5 py-4">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border px-5 py-3 text-xs text-fg-muted">
            Online payments: {t.paymentsSuccessful} successful · {t.paymentsFailed} failed attempts
            {t.toCollectOrders > 0 && ` · ${formatPaise(t.toCollectPaise)} to collect from ${t.toCollectOrders} offline orders`}
          </p>
        </Panel>

        <Panel>
          <PanelHeader icon={Boxes} iconClass="text-orange-500" title="Stock movement" description="Bottles in and out of the godown in this period" />
          <dl className="divide-y divide-border text-sm">
            {(
              [
                ['Received from purchases', report.stockFlow.received, '+'],
                ['Sold', report.stockFlow.sold, '−'],
                ['Back from cancelled orders', report.stockFlow.cancelled, '+'],
                ['Returned by customers', report.stockFlow.returned, '+'],
                ['Corrections', report.stockFlow.adjusted, report.stockFlow.adjusted >= 0 ? '+' : '−'],
              ] as const
            ).map(([label, value, sign]) => (
              <div key={label} className="flex justify-between px-5 py-2.5">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="tabular-nums">
                  {value ? sign : ''}
                  {Math.abs(value)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between bg-surface-muted px-5 py-2.5 font-medium">
              <dt>Net bottles sold</dt>
              <dd className="tabular-nums">{report.stockFlow.unitsSold}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {f ? (
        <Panel>
          <PanelHeader icon={TrendingUp} iconClass="text-emerald-600" title="Profit" description="Cost uses the average purchase price of each size" actions={<Badge tone="warning"><Lock className="size-3" aria-hidden />Confidential</Badge>} />
          <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <li><StatTile label="Cost of goods sold" value={formatPaise(f.costOfGoodsPaise)} icon={Boxes} color="cost" /></li>
            <li><StatTile label="Gross profit" value={f.grossProfitPaise != null ? formatPaise(f.grossProfitPaise) : '—'} hint={f.marginPercent != null ? `${f.marginPercent}% margin` : 'Needs purchase costs'} icon={TrendingUp} color="emerald" highlight /></li>
            <li><StatTile label="Stock value now" value={formatPaise(f.stockValuePaise)} hint="At average cost" icon={Boxes} color="neutral" /></li>
            <li><StatTile label="Sold without a cost" value={f.unitsWithoutCost} hint={f.unitsWithoutCost ? `${formatPaise(f.revenueWithoutCostPaise)} of sales left out of profit. Add costs in Purchase history.` : 'All costs recorded'} icon={IndianRupee} color={f.unitsWithoutCost ? 'rose' : 'emerald'} highlight={f.unitsWithoutCost > 0} /></li>
          </ul>
        </Panel>
      ) : null}

      <PeriodDetails report={report} />
    </>
  );
}

/** Table of the period's days (or weeks / months). Quiet ones are left out; the chart above still shows them. */
function PeriodDetails({ report }: { report: Report }) {
  // The chart needs every day, including quiet ones; the table lists only periods where something happened.
  const activePeriods = report.timeseries.filter((row) => row.orders > 0 || row.salesPaise !== 0 || row.refundsPaise !== 0 || row.unitsSold !== 0 || row.unitsReceived !== 0);
  const hiddenPeriods = report.timeseries.length - activePeriods.length;
  const unit = report.groupBy;

  return (
    <Panel>
      <PanelHeader
        icon={CalendarDays}
        title="Period details"
        description={
          hiddenPeriods > 0
            ? `Only ${unit}s with activity are listed. ${hiddenPeriods} ${unit}${hiddenPeriods === 1 ? '' : 's'} with nothing sold, refunded or received ${hiddenPeriods === 1 ? 'is' : 'are'} hidden.`
            : undefined
        }
      />
      {activePeriods.length === 0 && <p className="px-5 py-8 text-center text-xs text-gray-500">Nothing was sold, refunded or received in this period.</p>}
      <div className={activePeriods.length === 0 ? 'hidden' : 'max-h-96 overflow-auto'}>
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-xs text-fg-subtle">
              <th className="px-5 py-2.5 font-medium">Period</th>
              <th className="px-3 py-2.5 text-right font-medium">Orders</th>
              <th className="px-3 py-2.5 text-right font-medium">Sales</th>
              <th className="px-3 py-2.5 text-right font-medium">Refunds</th>
              <th className="px-3 py-2.5 text-right font-medium">Sold</th>
              <th className="px-5 py-2.5 text-right font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activePeriods.map((row) => (
              <tr key={row.period}>
                <td className="px-5 py-2">{periodLabel(row.period, report.groupBy)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.orders}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(row.salesPaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.refundsPaise ? `−${formatPaise(row.refundsPaise)}` : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.unitsSold}</td>
                <td className="px-5 py-2 text-right tabular-nums">{row.unitsReceived}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
