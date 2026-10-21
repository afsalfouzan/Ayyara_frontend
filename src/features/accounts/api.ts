import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* Accounts & salaries. Amounts are integer paise; positive = money in, negative = money out. */

export type Account = {
  id: number;
  name: string;
  kind: 'bank' | 'cash';
  bankName: string | null;
  accountLast4: string | null;
  openingBalancePaise: number;
  openingDate: string;
  receivesOnline: boolean;
  receivesOffline: boolean;
  isActive: boolean;
  balancePaise: number;
  entryCount: number;
};

export type EntryType = 'razorpay_settlement' | 'offline_sale' | 'offline_refund' | 'income' | 'expense' | 'salary' | 'advance' | 'bonus' | 'transfer' | 'adjustment' | 'courier';

export type Entry = {
  id: number;
  entryDate: string;
  amountPaise: number;
  type: EntryType;
  category: string | null;
  description: string;
  isReversal: boolean;
  reversedByEntryId: number | null;
  isTransfer: boolean;
  salaryPaymentId: number | null;
  automatic: boolean;
  createdByName: string | null;
  createdAt: string;
  balanceAfterPaise: number;
};

export type MoneySummary = { onlinePaise: number; offlinePaise: number; otherIncomePaise: number; expensesPaise: number; salariesPaise: number; courierPaise: number; adjustmentsPaise: number; inPaise: number; outPaise: number };

export type RazorpayStatus = {
  configured: boolean;
  accountId: number;
  onTheWayPaise: number;
  paymentCount: number;
  feesKnown: boolean;
  lastPayout: { amountPaise: number; settledAt: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type Overview = {
  accounts: Account[];
  totalBalancePaise: number;
  summary: MoneySummary;
  razorpay: RazorpayStatus;
  categories: { expense: string[]; income: string[] };
  today: string;
};

export const TYPE_LABEL: Record<EntryType, string> = {
  razorpay_settlement: 'Razorpay payout',
  offline_sale: 'Offline sale',
  offline_refund: 'Offline refund',
  income: 'Money in',
  expense: 'Expense',
  salary: 'Salary',
  advance: 'Salary advance',
  bonus: 'Bonus',
  transfer: 'Transfer',
  adjustment: 'Correction',
  courier: 'Courier',
};

export const CATEGORY_LABEL: Record<string, string> = {
  rent: 'Rent',
  electricity: 'Electricity & water',
  courier: 'Courier & delivery',
  packaging: 'Packaging',
  production: 'Production & materials',
  marketing: 'Marketing & ads',
  transport: 'Transport & fuel',
  maintenance: 'Repairs & maintenance',
  office: 'Office & shop expenses',
  tax: 'Taxes & fees',
  bank_charges: 'Bank charges',
  other: 'Other',
  owner_funds: 'Money added by owner',
  other_sale: 'Other sale',
  interest: 'Bank interest',
  refund_received: 'Refund received',
  salary: 'Salary',
};

const rangeParams = (range: { from: string; to: string }) => {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  return params;
};

export function useOverview(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['finance', 'overview', range],
    queryFn: () => api<Overview>(`/admin/finance/accounts?${rangeParams(range)}`),
    placeholderData: keepPreviousData,
  });
}

export type StatementFilters = { from: string; to: string; direction: 'all' | 'in' | 'out'; page: number };

export type Statement = {
  account: { id: number; name: string; kind: 'bank' | 'cash'; openingBalancePaise: number; openingDate: string; balancePaise: number };
  items: Entry[];
  page: number;
  pageSize: number;
  total: number;
  period: { startPaise: number; inPaise: number; outPaise: number; endPaise: number };
};

export function useStatement(accountId: number | null, filters: StatementFilters) {
  const params = rangeParams(filters);
  params.set('direction', filters.direction);
  params.set('page', String(filters.page));
  params.set('pageSize', '25');
  return useQuery({
    queryKey: ['finance', 'statement', accountId, filters],
    queryFn: () => api<Statement>(`/admin/finance/accounts/${accountId}/entries?${params}`),
    enabled: accountId != null,
    placeholderData: keepPreviousData,
  });
}

/** Every money change touches balances, statements and summaries, so they all refresh together. */
function useFinanceMutation<TInput, TResult = unknown>(run: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: run, onSuccess: () => client.invalidateQueries({ queryKey: ['finance'] }) });
}

export type EntryInput = { requestId: string; accountId: number; direction: 'in' | 'out'; amountPaise: number; entryDate: string; category: string; description: string };
export const useAddEntry = () => useFinanceMutation((body: EntryInput) => api<{ id: number }>('/admin/finance/entries', { method: 'POST', body }));

export type TransferInput = { requestId: string; fromAccountId: number; toAccountId: number; amountPaise: number; entryDate: string; note: string };
export const useTransfer = () => useFinanceMutation((body: TransferInput) => api('/admin/finance/transfers', { method: 'POST', body }));

export const useReverseEntry = () => useFinanceMutation(({ id, reason }: { id: number; reason: string }) => api(`/admin/finance/entries/${id}/reverse`, { method: 'POST', body: { reason } }));

export const useMatchBalance = () =>
  useFinanceMutation(({ accountId, ...body }: { accountId: number; requestId: string; actualBalancePaise: number; note: string }) =>
    api<{ matched: boolean; differencePaise: number; balancePaise: number }>(`/admin/finance/accounts/${accountId}/match`, { method: 'POST', body }),
  );

export type AccountInput = { name: string; bankName: string; accountLast4: string; openingBalancePaise: number; openingDate: string };
export const useCreateAccount = () => useFinanceMutation((body: AccountInput) => api<{ id: number }>('/admin/finance/accounts', { method: 'POST', body }));
export const useUpdateAccount = () =>
  useFinanceMutation(({ id, ...body }: { id: number } & Partial<AccountInput> & { receivesOnline?: true; receivesOffline?: true; isActive?: boolean }) => api(`/admin/finance/accounts/${id}`, { method: 'PATCH', body }));

export const useSyncRazorpay = () => useFinanceMutation(() => api<{ configured: boolean; added: number; addedPaise: number; error?: string }>('/admin/finance/razorpay/sync', { method: 'POST' }));

/* ── Salaries ─────────────────────────────────────────────────────────── */

export type Employee = {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  monthlySalaryPaise: number;
  isActive: boolean;
  advanceOutstandingPaise: number;
  month: { salary: { id: number; grossPaise: number; advanceDeductedPaise: number; paidPaise: number; paidOn: string } | null; advancePaise: number; bonusPaise: number };
};

export type Payroll = {
  month: string;
  items: Employee[];
  summary: { employees: number; monthlyBillPaise: number; paidCount: number; paidOutPaise: number; advanceOutstandingPaise: number };
};

/** An account a salary can be paid from. The balance is null for staff who may not see accounts. */
export type PayAccount = { id: number; name: string; kind: 'bank' | 'cash'; openingDate: string; isActive: boolean; balancePaise: number | null };

export function useSalaryAccounts(enabled: boolean) {
  return useQuery({ queryKey: ['finance', 'salary-accounts'], queryFn: () => api<{ accounts: PayAccount[]; today: string }>('/admin/finance/salary-accounts'), enabled });
}

export function usePayroll(month: string) {
  return useQuery({ queryKey: ['finance', 'payroll', month], queryFn: () => api<Payroll>(`/admin/finance/employees?month=${month}`), placeholderData: keepPreviousData });
}

export type SalaryKind = 'salary' | 'advance' | 'bonus';
export type SalaryPayment = {
  id: number;
  employeeId: number;
  employeeName: string;
  kind: SalaryKind;
  periodMonth: string;
  grossPaise: number;
  advanceDeductedPaise: number;
  paidPaise: number;
  accountName: string;
  paidOn: string;
  note: string;
  status: 'paid' | 'reversed';
  createdByName: string | null;
};

export function useSalaryPayments(month: string) {
  return useQuery({ queryKey: ['finance', 'salary-payments', month], queryFn: () => api<{ items: SalaryPayment[] }>(`/admin/finance/salary-payments?month=${month}`), placeholderData: keepPreviousData });
}

export type EmployeeInput = { name: string; role: string; phone: string; monthlySalaryPaise: number };
export const useCreateEmployee = () => useFinanceMutation((body: EmployeeInput) => api<{ id: number }>('/admin/finance/employees', { method: 'POST', body }));
export const useUpdateEmployee = () => useFinanceMutation(({ id, ...body }: { id: number } & Partial<EmployeeInput> & { isActive?: boolean }) => api(`/admin/finance/employees/${id}`, { method: 'PATCH', body }));

export type PayInput = { requestId: string; employeeId: number; kind: SalaryKind; periodMonth?: string; amountPaise: number; advanceDeductedPaise?: number; accountId: number; paidOn: string; note: string };
export const usePaySalary = () => useFinanceMutation((body: PayInput) => api<{ id: number; paidPaise: number }>('/admin/finance/salary-payments', { method: 'POST', body }));
export const useReverseSalary = () => useFinanceMutation(({ id, reason }: { id: number; reason: string }) => api(`/admin/finance/salary-payments/${id}/reverse`, { method: 'POST', body: { reason } }));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-10" → "October 2026". */
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export function shiftMonth(month: string, by: number) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}
