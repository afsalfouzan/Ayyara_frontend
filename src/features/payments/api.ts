import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type PaymentRow = {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  provider: 'razorpay' | 'offline';
  reference: string | null;
  razorpayPaymentId: string | null;
  amountPaise: number;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';
  method: string | null;
  errorDescription: string | null;
  refundedPaise: number;
  createdAt: string;
};

export type PaymentFilters = { status: 'all' | 'successful' | 'failed' | 'refunded'; page: number; search: string; from: string; to: string };

export function usePayments(filters: PaymentFilters) {
  const params = new URLSearchParams({ status: filters.status, page: String(filters.page), pageSize: '25' });
  for (const key of ['search', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key]);
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () =>
      api<{
        items: PaymentRow[];
        page: number;
        pageSize: number;
        total: number;
        summary: { receivedPaise: number; successful: number; failed: number; refundedPaise: number; awaitingPayment: number };
        configured: { payments: boolean; webhook: boolean; mode: 'live' | 'test' | null };
      }>(`/admin/payments?${params}`),
    placeholderData: keepPreviousData,
  });
}

export type RefundRow = {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  amountPaise: number;
  reason: string;
  status: 'pending' | 'processed' | 'failed';
  stockAction: 'none' | 'cancel_restock' | 'returned';
  automatic: boolean;
  razorpayRefundId: string | null;
  failureReason: string | null;
  initiatedBy: string | null;
  processedAt: string | null;
  createdAt: string;
};

export function useRefunds(status: string, page: number) {
  return useQuery({
    queryKey: ['refunds', status, page],
    queryFn: () => api<{ items: RefundRow[]; page: number; pageSize: number; total: number }>(`/admin/refunds?status=${status}&page=${page}&pageSize=25`),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(['payments', 'refunds', 'orders', 'stock', 'customers'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useSyncRefund() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: (id: number) => api<{ refund: RefundRow }>(`/admin/refunds/${id}/sync`, { method: 'POST' }), onSuccess: invalidate });
}

export function useCreateRefund(orderId: number) {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: { amountPaise: number; reason: string; stockAction: 'none' | 'cancel_restock' | 'returned'; idempotencyKey: string }) =>
      api<{ refund: RefundRow }>(`/admin/orders/${orderId}/refunds`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export const REFUND_STATUS_LABEL = { pending: 'Processing', processed: 'Refunded', failed: 'Failed' } as const;
export const STOCK_ACTION_LABEL = { none: 'Money only', cancel_restock: 'Cancelled · restocked', returned: 'Returned · restocked' } as const;

const METHOD_LABEL: Record<string, string> = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later', cardless_emi: 'Cardless EMI', cash: 'Cash', bank_transfer: 'Bank transfer', other: 'Other' };
export const methodLabel = (method: string | null) => (method ? (METHOD_LABEL[method] ?? method) : '—');

export const PAYMENT_STATUS_LABEL: Record<string, string> = { created: 'Pending', authorized: 'Authorised', captured: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partly refunded' };
