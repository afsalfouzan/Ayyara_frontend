import { Badge } from '@/components/ui/Badge';
import type { FulfilmentStatus, OrderSummary, PaymentStatus } from './api';

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  unfulfilled: 'Not packed',
  processing: 'Processing',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

/** One badge summarising where the order is. */
export function OrderStateBadge({ order }: { order: Pick<OrderSummary, 'status' | 'paymentStatus' | 'fulfilmentStatus'> & { channel?: OrderSummary['channel']; deliveryRequired?: boolean } }) {
  if (order.status === 'cancelled') return <Badge tone="neutral">Cancelled</Badge>;
  if (order.channel === 'offline') {
    if (order.paymentStatus === 'pending') return <Badge tone="warning">Not paid</Badge>;
    if (!order.deliveryRequired) return <Badge tone="success">Paid · handed over</Badge>;
  }
  if (order.status === 'expired') return <Badge tone="neutral">Expired — not paid</Badge>;
  if (order.status === 'pending_payment') return <Badge tone="warning">Awaiting payment</Badge>;
  const tone = { unfulfilled: 'info', processing: 'info', packed: 'info', dispatched: 'success', delivered: 'success', cancelled: 'neutral', returned: 'danger' } as const;
  // Money returned in full before anything was sent: there is nothing to pack.
  if (order.paymentStatus === 'refunded' && ['unfulfilled', 'processing', 'packed'].includes(order.fulfilmentStatus)) return <Badge tone="warning">Refunded · not sent</Badge>;
  if (order.fulfilmentStatus === 'unfulfilled') return <Badge tone="info">{order.paymentStatus === 'partially_refunded' ? 'Partly refunded · to pack' : 'Paid · to pack'}</Badge>;
  return <Badge tone={tone[order.fulfilmentStatus]}>{FULFILMENT_LABEL[order.fulfilmentStatus]}</Badge>;
}

export const HISTORY_LABEL: Record<string, string> = {
  ...FULFILMENT_LABEL,
  pending_payment: 'Order placed',
  confirmed: 'Order confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired (not paid)',
  paid: 'Payment received',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
  refund_requested: 'Refund requested',
  whatsapp_invoice: 'Invoice prepared for WhatsApp',
  whatsapp_dispatch: 'Dispatch update prepared for WhatsApp',
  email_invoice: 'Invoice sent by email',
  contact_updated: 'Contact details updated',
};
