import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type GroupBy = 'day' | 'week' | 'month';
/** Where sales were made: India (website and Indian offline sales) or the UK (offline only, no godown stock). */
export type ReportRegion = 'all' | 'india' | 'uk';

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
  /** Bottles received per size, and what was paid (null without permission to see costs): in the chosen period, and in total since the start. */
  purchased: { variantId: number; productName: string; sizeMl: number; inPeriod: number; total: number; periodCostPaise: number | null; totalCostPaise: number | null }[];
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
    enabled: Boolean(from),
    refetchInterval: 60_000,
  });
}

/** The first day with any order or stock movement (null before there is any), where "All time" starts. */
export function useFirstDay() {
  return useQuery({ queryKey: ['report', 'first-day'], queryFn: () => api<{ firstDay: string | null }>('/admin/reports/first-day').then((d) => d.firstDay), staleTime: 5 * 60_000 });
}

/** Waits while `from` is empty (the period is still being worked out). */
export function useReport(from: string, to: string, groupBy: GroupBy, region: ReportRegion = 'all') {
  return useQuery({
    enabled: Boolean(from),
    queryKey: ['report', from, to, groupBy, region],
    queryFn: () => api<{ report: Report }>(`/admin/reports/summary?${params(from, to, groupBy)}&region=${region}`).then((d) => d.report),
    placeholderData: keepPreviousData,
  });
}
