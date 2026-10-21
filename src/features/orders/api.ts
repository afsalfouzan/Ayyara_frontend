import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OrderStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type FulfilmentStatus = 'unfulfilled' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';
export type OrderView = 'all' | 'awaiting_payment' | 'to_pack' | 'dispatched' | 'delivered' | 'closed' | 'unpaid' | 'paid' | 'cancelled';
export type Channel = 'online' | 'offline';
/** Where an offline sale was made. UK sales record the money only: no stock change, invoice, email or delivery. */
export type SellingRegion = 'india' | 'uk';
export const REGION_LABEL: Record<SellingRegion, string> = { india: 'India', uk: 'UK' };

type Shipping = { city: string; state: string; pincode: string; name?: string; line1?: string; line2?: string };

export type OrderSummary = {
  id: number;
  orderNumber: string;
  channel: Channel;
  sellingRegion: SellingRegion;
  deliveryRequired: boolean;
  customerId: number;
  customerName: string;
  email: string | null;
  phone: string;
  piiHidden: boolean;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  totalPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  reservationExpiresAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
  /** What the shop paid the courier for this parcel; null until someone enters it. */
  courierChargePaise: number | null;
  /** Where the courier charge was paid from; the money-out is in Accounts. */
  courierPaidFrom: CourierPaidFrom | null;
  createdAt: string;
  paidAt: string | null;
  customerNotes: string;
  shipping: Shipping;
  itemSummary?: string;
  units?: number;
};

export type OrderDetail = OrderSummary & {
  /** `unitCostPaise`: UK sales only, and only for staff who may see purchase costs. */
  items: { id: number; productName: string; sizeMl: number; quantity: number; unitPricePaise: number; lineTotalPaise: number; unitCostPaise?: number | null }[];
  history: { id: number; field: 'status' | 'payment' | 'fulfilment'; fromStatus: string | null; toStatus: string; note: string | null; actor: string | null; createdAt: string }[];
  payments: { id: number; provider: 'razorpay' | 'offline'; reference: string | null; razorpayPaymentId: string | null; amountPaise: number; status: string; method: string | null; errorDescription: string | null; createdAt: string }[];
  refunds: { id: number; amountPaise: number; status: 'pending' | 'processed' | 'failed'; reason: string; stockAction: 'none' | 'cancel_restock' | 'returned'; automatic: boolean; razorpayRefundId: string | null; processedAt: string | null; createdAt: string }[];
  /** The bank a courier charge is paid from (the one receiving offline payments); null when none is set. */
  courierBankName: string | null;
  refundablePaise: number;
  nextFulfilmentSteps: ('processing' | 'packed' | 'dispatched' | 'delivered')[];
  canCancel: boolean;
  /** Refunded in full but never sent: can be cancelled with its bottles put back in stock. */
  canCancelRefunded: boolean;
  canRecordPayment: boolean;
  /** False for UK sales, which have no invoice. */
  hasInvoice: boolean;
  /** Ready-written WhatsApp messages for the customer; null for staff who can't see contact details. */
  whatsapp: { invoice: WhatsAppMessage | null; dispatch: WhatsAppMessage | null } | null;
};

export type WhatsAppMessage = { text: string; url: string };

export type OrderFilters = { channel?: Channel; region?: SellingRegion | 'all'; view: OrderView; page: number; search: string; from: string; to: string };

export function useOrders(filters: OrderFilters) {
  const params = new URLSearchParams({ channel: filters.channel ?? 'online', view: filters.view, page: String(filters.page), pageSize: '20' });
  for (const key of ['search', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key]);
  if (filters.region && filters.region !== 'all') params.set('region', filters.region);
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => api<{ items: OrderSummary[]; counts: Record<OrderView, number>; page: number; pageSize: number; total: number }>(`/admin/orders?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => api<{ order: OrderDetail }>(`/admin/orders/${id}`).then((d) => d.order),
    enabled: id != null,
  });
}

function useOrderMutation<TInput>(id: number, path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => api<{ order: OrderDetail }>(`/admin/orders/${id}/${path}`, { method: 'POST', body: input }).then((d) => d.order),
    onSuccess: (order) => {
      queryClient.setQueryData(['orders', 'detail', id], order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      // A courier charge paid at dispatch changes account balances and profit.
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
      void queryClient.invalidateQueries({ queryKey: ['profit'] });
    },
  });
}

export type CourierPaidFrom = 'bank' | 'cash';

export const useUpdateFulfilment = (id: number) => useOrderMutation<{ status: string; courier?: string; trackingNumber?: string; courierChargePaise?: number; courierPaidFrom?: CourierPaidFrom; note?: string }>(id, 'fulfilment');

/** Adds or corrects the courier charge after an order has been dispatched. */
export function useSetCourierCharge(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { courierChargePaise: number | null; courierPaidFrom?: CourierPaidFrom | null }) => api<{ order: OrderDetail }>(`/admin/orders/${id}/courier-charge`, { method: 'PUT', body: input }).then((d) => d.order),
    onSuccess: (order) => {
      queryClient.setQueryData(['orders', 'detail', id], order);
      void queryClient.invalidateQueries({ queryKey: ['profit'] });
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
export const useCancelOrder = (id: number) => useOrderMutation<{ reason: string }>(id, 'cancel');
export const useCancelRefundedOrder = (id: number) => useOrderMutation<{ reason: string }>(id, 'cancel-refunded');

export const useRecordOfflinePayment = (id: number) => useOrderMutation<{ method: OfflineMethod; reference?: string }>(id, 'offline-payment');
export const useCancelOfflineOrder = (id: number) => useOrderMutation<{ reason: string }>(id, 'offline-cancel');

export const OFFLINE_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'other'] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
export const OFFLINE_METHOD_LABEL: Record<OfflineMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other' };

export type OfflineOrderInput = {
  requestId: string;
  region: SellingRegion;
  saleDate: string;
  items: { variantId: number; quantity: number; unitPricePaise: number; unitCostPaise?: number }[];
  customer: { name: string; phone?: string; email?: string };
  delivery: { required: false } | { required: true; addressLine1: string; addressLine2: string; city: string; state: string; pincode: string };
  payment: { status: 'unpaid' } | { status: 'paid'; method: OfflineMethod; reference: string };
  note: string;
};

export function useCreateOfflineOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OfflineOrderInput) => api<{ order: OrderDetail }>('/admin/orders/offline', { method: 'POST', body: input }).then((d) => d.order),
    onSuccess: () => Promise.all(['orders', 'stock', 'customers', 'payments'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
}

/** An item sold only in the UK (e.g. a special edition): a name and its sizes. Price and cost are typed on each sale. */
export type UkItem = { id: number; name: string; variants: { id: number; sizeMl: number }[] };

export function useUkItems(enabled: boolean) {
  return useQuery({ queryKey: ['uk-items'], queryFn: () => api<{ items: UkItem[] }>('/admin/uk-items').then((d) => d.items), enabled });
}

/** Creates a UK item (or adds a size to one with that name) and answers with the size to put on the sale line. */
export function useCreateUkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sizeMl: number }) => api<{ productId: number; variantId: number; items: UkItem[] }>('/admin/uk-items', { method: 'POST', body: input }),
    onSuccess: (result) => queryClient.setQueryData(['uk-items'], result.items),
  });
}

/** Notes in the order history that a WhatsApp message was opened or copied for the customer. */
export const useNoteWhatsApp = (id: number) => useOrderMutation<{ kind: 'invoice' | 'dispatch'; via: 'whatsapp' | 'copy' }>(id, 'whatsapp-sent');
