import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type GroupBy = 'day' | 'week' | 'month';

export type Report = {
  range: { from: string; to: string };
  groupBy: GroupBy;
  totals: {
    netSalesPaise: number;
    grossSalesPaise: number;
    refundsPaise: number;
    refundCount: number;
    orders: number;
    averageOrderPaise: number;
    unitsSold: number;
    toCollectPaise: number;
    toCollectOrders: number;
    paymentsSuccessful: number;
    paymentsFailed: number;
  };
  channels: { channel: 'online' | 'offline'; orders: number; salesPaise: number }[];
  /** Where sales were made. India covers the website and Indian offline sales; UK sales are offline only. */
  regions: { region: 'india' | 'uk'; orders: number; salesPaise: number; unitsSold: number }[];
  timeseries: { period: string; onlineSalesPaise: number; offlineSalesPaise: number; salesPaise: number; refundsPaise: number; orders: number; unitsSold: number; unitsReceived: number }[];
  products: { variantId: number; productName: string; sizeMl: number; units: number; revenue: number; online: number; offline: number; uk: number; share: number }[];
  orderStatus: { completed: number; inProgress: number; awaitingPayment: number; cancelled: number; expired: number; returned: number };
  stockFlow: { received: number; sold: number; cancelled: number; returned: number; adjusted: number; unitsSold: number };
  financial: null | {
    costOfGoodsPaise: number;
    grossProfitPaise: number | null;
    marginPercent: number | null;
    unitsWithoutCost: number;
    revenueWithoutCostPaise: number;
    stockValuePaise: number;
    byProduct: { variantId: number; avgUnitCostPaise: number | null; costPaise: number | null; profitPaise: number | null }[];
  };
};

export type Attention = {
  awaitingPayment: number;
  toPackOnline: number;
  toPackOffline: number;
  toCollectOrders: number;
  toCollectPaise: number;
  stock: { onHand: number; available: number; lowStock: number; outOfStock: number };
  lowStock: { variantId: number; productName: string; sizeMl: number; available: number; threshold: number }[];
  recentOrders: { id: number; orderNumber: string; channel: 'online' | 'offline'; customerName: string; totalPaise: number; status: string; paymentStatus: string; fulfilmentStatus: string; deliveryRequired: boolean; createdAt: string }[];
};

const params = (from: string, to: string, groupBy: GroupBy) => new URLSearchParams({ from, to, groupBy }).toString();

export function useDashboard(from: string, to: string, groupBy: GroupBy) {
  return useQuery({
    queryKey: ['dashboard', from, to, groupBy],
    queryFn: () => api<{ report: Report; attention: Attention }>(`/admin/reports/dashboard?${params(from, to, groupBy)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useReport(from: string, to: string, groupBy: GroupBy) {
  return useQuery({
    queryKey: ['report', from, to, groupBy],
    queryFn: () => api<{ report: Report }>(`/admin/reports/summary?${params(from, to, groupBy)}`).then((d) => d.report),
    placeholderData: keepPreviousData,
  });
}
