import { FileDown } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import type { OrderSummary } from './api';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

/** An invoice exists once an order has gone through; unpaid website orders, expired and cancelled ones have none. */
export const hasInvoice = (order: Pick<OrderSummary, 'status'>) => order.status === 'confirmed';

/** Fetches the invoice PDF for an order and saves it to the device. */
export async function downloadInvoice(order: Pick<OrderSummary, 'id' | 'orderNumber'>) {
  const response = await fetch(`${API_URL}/admin/orders/${order.id}/invoice.pdf`, { credentials: 'include', headers: { 'X-Requested-With': 'ayyara-admin' } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? 'Could not download the invoice. Please try again.');
  }
  const url = URL.createObjectURL(await response.blob());
  Object.assign(document.createElement('a'), { href: url, download: `Ayyara-invoice-${order.orderNumber}.pdf` }).click();
  // Give the browser a moment to start the download before the link is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Invoice" download button. Shows nothing for orders that have no invoice. */
export function InvoiceButton({ order, variant = 'secondary', size = 'sm', label = 'Invoice', className }: { order: Pick<OrderSummary, 'id' | 'orderNumber' | 'status'>; variant?: 'primary' | 'secondary'; size?: 'sm' | 'md'; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  if (!hasInvoice(order)) return null;

  async function download(event: MouseEvent) {
    // The button sits inside clickable rows; downloading must not also open the order.
    event.stopPropagation();
    setBusy(true);
    try {
      await downloadInvoice(order);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not download the invoice. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} loading={busy} onClick={download} className={className} aria-label={`Download invoice for order ${order.orderNumber}`} title="Download invoice (PDF)">
      {!busy && <FileDown className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />}
      {label}
    </Button>
  );
}
