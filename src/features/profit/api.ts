import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** One day's figures in paise. Profit is sales minus every cost line. */
export type ProfitAmounts = {
  salesPaise: number;
  onlineSalesPaise: number;
  offlineSalesPaise: number;
  refundsPaise: number;
  feesPaise: number;
  goodsCostPaise: number;
  courierPaise: number;
  salariesPaise: number;
  fixedCostsPaise: number;
  expensesPaise: number;
  stockLossPaise: number;
  promotionCostPaise: number;
  profitPaise: number;
  /** Online money received that Razorpay has not yet paid into the bank. */
  notCreditedPaise: number;
  /** Razorpay payouts that reached the bank. */
  creditedPaise: number;
  /** Bottles on bills made in the period (UK counted apart), those on bills not paid yet, and what those bills come to. */
  bottlesSold: number;
  bottlesWaiting: number;
  waitingPaise: number;
  bottlesUk: number;
  /** UK sales on their own (already inside the totals). */
  ukSalesPaise: number;
  ukRefundsPaise: number;
  ukCostPaise: number;
  ukProfitPaise: number;
  ukBottlesWaiting: number;
  ukWaitingPaise: number;
  bottlesPromotion: number;
  /** Money received in the period for bills made on earlier days. */
  receivedEarlierPaise: number;
};
export type ProfitDay = ProfitAmounts & { date: string; investedPaise: number; recoveredPaise: number; remainingPaise: number };
export type Investment = { id: number; entryDate: string; amountPaise: number; description: string };

export type ProfitOverview = {
  today: string;
  startDate: string;
  /** False while the start date is only a guess from the earliest sale or investment. */
  startDateChosen: boolean;
  range: { from: string; to: string };
  position: { investedPaise: number; recoveredPaise: number; remainingPaise: number };
  todayFigures: ProfitDay | null;
  monthTotals: ProfitAmounts;
  allTotals: ProfitAmounts;
  rangeTotals: ProfitAmounts;
  /** Newest day first. */
  days: ProfitDay[];
  investments: Investment[];
};

export const COST_LINES: { key: keyof ProfitAmounts; label: string }[] = [
  { key: 'refundsPaise', label: 'Refunds' },
  { key: 'feesPaise', label: 'Razorpay fees' },
  { key: 'goodsCostPaise', label: 'Cost of bottles sold' },
  { key: 'courierPaise', label: 'Courier charges' },
  { key: 'salariesPaise', label: 'Salaries (daily share and bonuses)' },
  { key: 'fixedCostsPaise', label: 'Rent, electricity and maintenance (daily share)' },
  { key: 'expensesPaise', label: 'Other expenses' },
  { key: 'promotionCostPaise', label: 'Bottles given for promotion' },
  { key: 'stockLossPaise', label: 'Stock written off' },
];
export const costsOf = (amounts: ProfitAmounts) => amounts.salesPaise - amounts.profitPaise;

export function useProfit(range: { from: string; to: string }, enabled = true) {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  return useQuery({ queryKey: ['profit', range], queryFn: () => api<ProfitOverview>(`/admin/profit?${params}`), placeholderData: keepPreviousData, enabled });
}

function useProfitMutation<TInput>(run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: run, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profit'] }) });
}

export type InvestmentInput = { entryDate: string; amountPaise: number; description: string };
export const useSaveInvestment = (id: number | null) =>
  useProfitMutation((input: InvestmentInput) => api(id == null ? '/admin/profit/investments' : `/admin/profit/investments/${id}`, { method: id == null ? 'POST' : 'PUT', body: input }));
export const useDeleteInvestment = () => useProfitMutation((id: number) => api(`/admin/profit/investments/${id}`, { method: 'DELETE' }));
export const useSetStartDate = () => useProfitMutation((startDate: string) => api('/admin/profit/start-date', { method: 'PUT', body: { startDate } }));
export const useSendReport = () => useMutation({ mutationFn: (date: string) => api<{ sent: number; to: string }>('/admin/profit/report/send', { method: 'POST', body: { date } }) });

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

/** Fetches one day's report and saves it as a PDF. */
export async function downloadReport(date: string) {
  const response = await fetch(`${API_URL}/admin/profit/report.pdf?date=${date}`, { credentials: 'include', headers: { 'X-Requested-With': 'ayyara-admin' } });
  if (!response.ok) throw new Error('The report could not be downloaded.');
  const url = URL.createObjectURL(await response.blob());
  Object.assign(document.createElement('a'), { href: url, download: `ayyara-daily-report-${date}.pdf` }).click();
  URL.revokeObjectURL(url);
}
