import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Channel, FulfilmentStatus, OrderStatus, PaymentStatus } from '@/features/orders/api';

export type CustomerSummary = {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  orders: number;
  paidOrders: number;
  totalSpentPaise: number;
  lastOrderAt: string | null;
  createdAt: string;
};

export type CustomerDetail = Omit<CustomerSummary, 'lastOrderAt'> & {
  lastAddress: { line1: string; line2: string; city: string; state: string; pincode: string } | null;
  piiHidden: boolean;
};

export function useCustomers(channel: Channel, page: number, search: string) {
  const params = new URLSearchParams({ channel, page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  return useQuery({
    queryKey: ['customers', channel, page, search],
    queryFn: () => api<{ items: CustomerSummary[]; piiHidden: boolean; counts: Record<Channel | 'subscribers', number>; page: number; pageSize: number; total: number }>(`/admin/customers?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number | null) {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () =>
      api<{ customer: CustomerDetail; orders: { id: number; orderNumber: string; channel: Channel; deliveryRequired: boolean; status: OrderStatus; paymentStatus: PaymentStatus; fulfilmentStatus: FulfilmentStatus; totalPaise: number; createdAt: string }[] }>(`/admin/customers/${id}`),
    enabled: id != null,
  });
}

export type Subscriber = { id: number; name: string; email: string; source: string; createdAt: string };

export function useSubscribers(page: number, search: string, enabled: boolean) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  return useQuery({
    queryKey: ['customers', 'subscribers', page, search],
    queryFn: () => api<{ items: Subscriber[]; piiHidden: boolean; page: number; pageSize: number; total: number }>(`/admin/customers/subscribers?${params}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}
