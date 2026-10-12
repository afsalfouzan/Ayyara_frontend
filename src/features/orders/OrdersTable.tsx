import { ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import type { OrderSummary } from './api';
import { InvoiceButton } from './invoice';
import { OrderStateBadge } from './labels';

/**
 * Order list shared by Online Orders and Offline Orders: a table with one
 * column per kind of information on wide screens, and a card per order on
 * phones. Clicking a row opens the order; the Invoice button downloads its PDF.
 */
export function OrdersTable({ orders, onOpen }: { orders: OrderSummary[]; onOpen: (id: number) => void }) {
  const offline = orders[0]?.channel === 'offline';
  // Online orders are delivered, so the place matters; offline customers are known by phone.
  const contact = (order: OrderSummary) => (offline ? order.phone : [order.shipping.city, order.shipping.state].filter(Boolean).join(', '));

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-subtle">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Items</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-3 py-3 font-medium">Invoice</th>
              <th className="w-10 py-3 pr-4" aria-label="Open" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id} onClick={() => onOpen(order.id)} className="cursor-pointer hover:bg-surface-muted">
                <td className="px-5 py-3 whitespace-nowrap">
                  <button type="button" onClick={() => onOpen(order.id)} className="font-mono text-sm font-bold text-neutral-900 hover:underline">
                    {order.orderNumber}
                  </button>
                  <p className="mt-0.5 text-[11px] text-fg-muted tabular-nums">{formatDateTime(order.createdAt)}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-48 truncate font-medium text-neutral-900" title={order.customerName}>
                    {order.customerName}
                  </p>
                  <p className="mt-0.5 max-w-48 truncate text-[11px] text-fg-muted">{contact(order) || '—'}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-xs truncate text-neutral-900" title={order.itemSummary}>
                    {order.itemSummary ?? '—'}
                  </p>
                  {order.units != null && (
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                      {order.units} bottle{order.units === 1 ? '' : 's'}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <OrderStateBadge order={order} />
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">{formatPaise(order.totalPaise)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{order.status === 'confirmed' ? <InvoiceButton order={order} label="PDF" /> : <span className="text-fg-subtle">—</span>}</td>
                <td className="py-3 pr-4">
                  <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {orders.map((order) => (
          <li key={order.id} className="px-4 py-3.5">
            <button type="button" onClick={() => onOpen(order.id)} className="flex w-full items-start gap-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-neutral-900">{order.orderNumber}</p>
                <p className="mt-0.5 text-[11px] text-fg-muted tabular-nums">{formatDateTime(order.createdAt)}</p>
              </div>
              <span className="font-mono text-sm font-bold tabular-nums">{formatPaise(order.totalPaise)}</span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
            </button>
            <dl className="mt-2.5 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-fg-muted">Customer</dt>
              <dd className="min-w-0 truncate text-neutral-900">
                {order.customerName}
                {contact(order) && <span className="text-fg-muted"> · {contact(order)}</span>}
              </dd>
              <dt className="text-fg-muted">Items</dt>
              <dd className="min-w-0 text-neutral-900">{order.itemSummary ?? '—'}</dd>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <OrderStateBadge order={order} />
              <InvoiceButton order={order} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
