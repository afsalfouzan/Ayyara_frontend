import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type PieLabelRenderProps, type TooltipContentProps } from 'recharts';
import { formatPaise } from '@/lib/money';
import { periodLabel } from './range';
import type { GroupBy, Report } from './api';

/** Chart colours in fixed order (style guide). */
export const CHART_COLORS = ['#3b82f6', '#f97316', '#6366f1', '#10b981', '#ef4444', '#8b5cf6'];
const CHANNEL_COLORS = { online: '#3b82f6', offline: '#f97316' } as const;
const AXIS_TICK = { fill: '#94a3b8', fontSize: 11, fontWeight: 500 };
const GRID = '#e5e7eb';
const TREND = '#10b981';

/** ₹ axis ticks in Indian units: 1.2K, 3.4L, 1.1Cr. */
export function compactRupees(paise: number) {
  const r = paise / 100;
  if (r >= 1e7) return `₹${+(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${+(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${+(r / 1e3).toFixed(1)}K`;
  return `₹${Math.round(r)}`;
}
const tooltipBox = 'rounded-lg bg-white px-3 py-2 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.1)]';

function Empty({ height, text = 'No sales in this period' }: { height: number; text?: string }) {
  return (
    <div className="grid place-items-center text-sm text-gray-400" style={{ height }}>
      {text}
    </div>
  );
}

type Point = Report['timeseries'][number] & { label: string };

function TrendTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload as Point;
  return (
    <div className={tooltipBox}>
      <p className="mb-1 font-bold text-gray-800">{p.label}</p>
      <p className="font-mono text-sm font-bold text-gray-900">{formatPaise(p.salesPaise)}</p>
      <p className="mt-1 text-gray-500">
        {formatPaise(p.onlineSalesPaise)} online · {formatPaise(p.offlineSalesPaise)} offline
      </p>
      <p className="text-gray-500">{p.orders} {p.orders === 1 ? 'order' : 'orders'}</p>
    </div>
  );
}

/** Sales trend: smooth area with a gradient glow. Has a table view for accessibility. */
export function SalesTrendChart({ report, height = 250 }: { report: Report; height?: number }) {
  const [asTable, setAsTable] = useState(false);
  const data: Point[] = report.timeseries.map((t) => ({ ...t, label: periodLabel(t.period, report.groupBy as GroupBy) }));
  const empty = data.every((d) => d.salesPaise === 0);

  return (
    <div>
      <div className="-mt-1 mb-1 flex justify-end">
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800">
          {asTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-gray-100">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100 text-left">
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Online</th>
                <th className="px-3 py-2 text-right">Offline</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((d) => (
                <tr key={d.period}>
                  <td className="px-3 py-1.5">{d.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPaise(d.onlineSalesPaise)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatPaise(d.offlineSalesPaise)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold">{formatPaise(d.salesPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : empty ? (
        <Empty height={height} />
      ) : (
        <div role="img" aria-label={`Sales per ${report.groupBy}`}>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TREND} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={TREND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={GRID} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={16} dy={8} />
              <YAxis tickFormatter={compactRupees} axisLine={false} tickLine={false} tick={AXIS_TICK} width={56} allowDecimals={false} />
              <Tooltip content={(props) => <TrendTooltip {...(props as TooltipContentProps<number, string>)} />} cursor={{ stroke: '#e2e8f0' }} />
              <Area
                type="monotone"
                dataKey="salesPaise"
                name="Sales"
                stroke={TREND}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#salesGlow)"
                dot={data.length <= 31 ? { r: 4, fill: '#fff', strokeWidth: 2, stroke: TREND } : false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, outerRadius, name, percent }: PieLabelRenderProps) {
  const radius = Number(outerRadius) + 20;
  const x = Number(cx) + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = Number(cy) + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > Number(cx) ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
    </text>
  );
}

/** Online vs offline share of sales. */
export function ChannelPie({ report, height = 260 }: { report: Report; height?: number }) {
  const data = report.channels.filter((c) => c.salesPaise > 0).map((c) => ({ name: c.channel === 'online' ? 'Online' : 'Offline', value: c.salesPaise, orders: c.orders, color: CHANNEL_COLORS[c.channel] }));
  if (data.length === 0) return <Empty height={height} />;
  return (
    <div>
      <div role="img" aria-label={data.map((d) => `${d.name} ${formatPaise(d.value)}`).join(', ')}>
        <ResponsiveContainer width="100%" height={height - 40}>
          <PieChart>
            <Pie data={data} cx="50%" cy="46%" outerRadius={75} dataKey="value" label={PieLabel} labelLine={false} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={data.length > 1 ? 2 : 0} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className={tooltipBox}>
                    <p className="font-bold text-gray-800">{payload[0]!.name}</p>
                    <p className="font-mono font-bold text-gray-900">{formatPaise(Number(payload[0]!.value))}</p>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
        {report.channels.map((c) => (
          <li key={c.channel} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: CHANNEL_COLORS[c.channel] }} aria-hidden />
            <span className="font-medium text-gray-600 capitalize">{c.channel}</span>
            <span className="font-mono font-bold text-gray-900">{formatPaise(c.salesPaise)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sales value per perfume and size, one colour per bar. */
export function PerfumeBarChart({ products, height = 280, limit = 6 }: { products: Report['products']; height?: number; limit?: number }) {
  const data = products.slice(0, limit).map((p, i) => ({ name: `${p.productName} ${p.sizeMl}ml`, value: p.revenue, units: p.units, color: CHART_COLORS[i % CHART_COLORS.length] }));
  if (data.length === 0) return <Empty height={height} />;
  return (
    <div role="img" aria-label={`Sales by perfume: ${data.map((d) => `${d.name} ${formatPaise(d.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ ...AXIS_TICK, fill: '#64748b' }} interval={0} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className={tooltipBox}>
                  <p className="font-bold text-gray-800">{payload[0]!.payload.name}</p>
                  <p className="font-mono font-bold text-gray-900">{formatPaise(Number(payload[0]!.value))}</p>
                  <p className="text-gray-500">{payload[0]!.payload.units} sold</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" barSize={35} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rose alert card for perfumes at or below their alert level. */
export function LowStockCard({ items, limit = 6 }: { items: { variantId: number; productName: string; sizeMl: number; available: number }[]; limit?: number }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500">
          <span className="text-[10px] font-bold">!</span>
        </div>
        <h3 className="text-[13px] font-bold tracking-wide text-rose-900 uppercase">Low Stock Perfumes</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Everything is well stocked.</p>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, limit).map((s) => (
            <li key={s.variantId} className="flex justify-between gap-3 rounded-lg border border-rose-100/50 bg-rose-50/50 p-2.5 text-xs font-medium text-rose-800">
              <span>
                {s.productName} · {s.sizeMl} ML
              </span>
              <span className="font-bold underline">{s.available <= 0 ? 'Out of stock' : `Only ${s.available} left`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
