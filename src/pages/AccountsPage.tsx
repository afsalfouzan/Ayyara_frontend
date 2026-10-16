import { clsx } from 'clsx';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Download, Globe, Landmark, Pencil, PiggyBank, Plus, ReceiptText, RefreshCw, Scale, Store, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { DateRangePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { toast } from '@/components/ui/Toast';
import { TYPE_LABEL, useOverview, useStatement, useSyncRazorpay, type Account, type Entry, type Overview, type StatementFilters } from '@/features/accounts/api';
import { AccountDialog, CancelEntryDialog, EntryDialog, MatchDialog, TransferDialog, type AccountDialogState, type EntryDialogState, type TransferDialogState } from '@/features/accounts/forms';
import { useSession } from '@/features/auth/session';
import { FILTER_PRESETS, presetRange } from '@/features/reports/range';
import { formatDateRange, formatDay } from '@/lib/dates';
import { messageOf } from '@/lib/errors';
import { formatPaise } from '@/lib/money';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const MANUAL_TYPES = ['income', 'expense', 'transfer', 'adjustment'];

/** Money with an explicit sign: "+₹4,500" in green, "−₹1,200" in red. */
function Signed({ paise, className }: { paise: number; className?: string }) {
  return (
    <span className={clsx('font-mono font-bold tabular-nums', paise > 0 ? 'text-emerald-600' : 'text-rose-600', className)}>
      {paise > 0 ? '+' : '−'}
      {formatPaise(Math.abs(paise))}
    </span>
  );
}

function AccountCard({
  account,
  selected,
  razorpay,
  canManage,
  isOwner,
  syncing,
  onSelect,
  onDeposit,
  onMatch,
  onEdit,
  onSync,
}: {
  account: Account;
  selected: boolean;
  razorpay: Overview['razorpay'];
  canManage: boolean;
  isOwner: boolean;
  syncing: boolean;
  onSelect: () => void;
  onDeposit: () => void;
  onMatch: () => void;
  onEdit: () => void;
  onSync: () => void;
}) {
  const cash = account.kind === 'cash';
  const Icon = cash ? Banknote : Landmark;
  const showRazorpay = razorpay.configured && razorpay.accountId === account.id;
  return (
    <div className={clsx('flex flex-col rounded-2xl border bg-white shadow-sm transition-shadow', selected ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-gray-200', !account.isActive && 'opacity-60')}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex flex-1 flex-col items-stretch justify-start rounded-t-2xl p-4 text-left sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl', cash ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-white')}>
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-neutral-900">{account.name}</p>
              <p className="truncate text-[11px] font-medium text-gray-500">{cash ? 'Cash kept at the shop' : [account.bankName, account.accountLast4 && `•••• ${account.accountLast4}`].filter(Boolean).join(' · ') || 'Bank account'}</p>
            </div>
          </div>
          {!account.isActive && <Badge>Closed</Badge>}
        </div>
        <p className="mt-4 text-[11px] font-bold tracking-wide text-gray-500 uppercase">Balance</p>
        <p className={clsx('mt-0.5 font-mono text-2xl font-bold tabular-nums sm:text-3xl', account.balancePaise < 0 ? 'text-rose-600' : 'text-neutral-900')}>{formatPaise(account.balancePaise)}</p>
        {(account.receivesOnline || account.receivesOffline) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {account.receivesOnline && <Badge tone="info">Website payments</Badge>}
            {account.receivesOffline && <Badge tone="neutral">Offline UPI & card</Badge>}
          </div>
        )}
      </button>

      {showRazorpay && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 sm:mx-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-900">On the way from Razorpay</p>
            <p className="text-[11px] text-blue-800">
              <span className="font-mono text-sm font-bold">{formatPaise(razorpay.onTheWayPaise)}</span>
              {razorpay.paymentCount > 0 ? ` · ${razorpay.paymentCount} payment${razorpay.paymentCount === 1 ? '' : 's'}${razorpay.feesKnown ? ', after fees' : ', before fees'}` : ' · nothing waiting'}
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={onSync} disabled={syncing} aria-label="Check Razorpay for new payouts" title="Check Razorpay for new payouts" className="grid size-8 shrink-0 place-items-center rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50">
              <RefreshCw className={clsx('size-4', syncing && 'animate-spin')} aria-hidden />
            </button>
          )}
        </div>
      )}

      {(canManage || isOwner) && account.isActive && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
          {canManage && cash && (
            <Button size="sm" onClick={onDeposit} disabled={account.balancePaise <= 0}>
              <PiggyBank className="size-3.5" aria-hidden />
              Deposit to bank
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="secondary" onClick={onMatch}>
              <Scale className="size-3.5" aria-hidden />
              {cash ? 'Count cash' : 'Match with bank'}
            </Button>
          )}
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={onEdit} className="ml-auto" aria-label={`Edit ${account.name}`}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          )}
        </div>
      )}
      {isOwner && !account.isActive && (
        <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}

function EntryMeta({ entry }: { entry: Entry }) {
  return (
    <span className="text-[11px] text-gray-500">
      {TYPE_LABEL[entry.type]} · {entry.automatic ? 'Automatic' : (entry.createdByName ?? 'Staff')}
    </span>
  );
}

function EntryFlags({ entry }: { entry: Entry }) {
  if (entry.isReversal) return <Badge tone="neutral">Cancellation</Badge>;
  if (entry.reversedByEntryId) return <Badge tone="danger">Cancelled</Badge>;
  return null;
}

export default function AccountsPage() {
  const { can, user } = useSession();
  const canManage = can('accounts.manage');
  const isOwner = Boolean(user?.isOwner);
  const [range, setRange] = useState(() => {
    const month = presetRange('month');
    return { from: month.from, to: month.to };
  });
  const overview = useOverview(range);
  const sync = useSyncRazorpay();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [direction, setDirection] = useState<StatementFilters['direction']>('all');
  const [page, setPage] = useState(1);
  const accounts = overview.data?.accounts ?? [];
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts.find((a) => a.isActive) ?? null;
  const statement = useStatement(selected?.id ?? null, { ...range, direction, page });

  const [entryDialog, setEntryDialog] = useState<EntryDialogState>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>(null);
  const [matchAccount, setMatchAccount] = useState<Account | null>(null);
  const [accountDialog, setAccountDialog] = useState<AccountDialogState>(null);
  const [cancelEntry, setCancelEntry] = useState<Entry | null>(null);
  const [downloading, setDownloading] = useState(false);

  const select = (id: number) => {
    setSelectedId(id);
    setPage(1);
  };

  async function checkRazorpay() {
    try {
      const result = await sync.mutateAsync();
      if (result.error) toast(result.error, 'error');
      else if (result.added) toast(`${formatPaise(result.addedPaise)} from Razorpay added to your bank account`);
      else toast('No new payouts from Razorpay yet');
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  async function downloadCsv() {
    if (!selected) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const response = await fetch(`${API_URL}/admin/finance/accounts/${selected.id}/export.csv?${params}`, { credentials: 'include', headers: { 'X-Requested-With': 'ayyara-admin' } });
      if (!response.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await response.blob());
      Object.assign(document.createElement('a'), { href: url, download: `${selected.name.replace(/\s+/g, '-').toLowerCase()}-statement.csv` }).click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Could not export the statement. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  if (overview.isPending) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounts" description="Your bank and cash balances, with every rupee in and out." />
        <Panel>
          <TableSkeleton />
        </Panel>
      </div>
    );
  }
  if (overview.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounts" description="Your bank and cash balances, with every rupee in and out." />
        <Panel>
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </Panel>
      </div>
    );
  }

  const { summary, razorpay, categories, today, totalBalancePaise } = overview.data;
  const cash = accounts.find((a) => a.kind === 'cash');
  const mainBank = accounts.find((a) => a.kind === 'bank' && a.isActive);
  const needsSetup = isOwner && mainBank != null && accounts.every((a) => a.openingBalancePaise === 0 && a.entryCount === 0);
  const periodLabel = range.from || range.to ? formatDateRange(range.from, range.to) : 'All time';
  const period = statement.data?.period;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Your bank and cash balances, with every rupee in and out."
        actions={
          canManage && (
            <>
              <Button onClick={() => setEntryDialog({ direction: 'out', accountId: selected?.id ?? null })}>
                <ArrowUpRight className="size-4" aria-hidden />
                Money out
              </Button>
              <Button variant="secondary" onClick={() => setEntryDialog({ direction: 'in', accountId: selected?.id ?? null })}>
                <ArrowDownLeft className="size-4" aria-hidden />
                Money in
              </Button>
              <Button variant="secondary" onClick={() => setTransferDialog({ fromAccountId: selected?.id ?? null, toAccountId: null })}>
                <ArrowLeftRight className="size-4" aria-hidden />
                Transfer
              </Button>
            </>
          )
        }
      />

      {needsSetup && mainBank && (
        <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs font-medium text-orange-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-bold">Start by entering your bank balance.</strong> Type what your bank shows today as the opening balance. From then on, sales, expenses and salaries keep it up to date.
            </span>
          </p>
          <Button size="sm" className="shrink-0" onClick={() => setAccountDialog({ mode: 'edit', account: mainBank })}>
            Enter opening balance
          </Button>
        </div>
      )}
      {razorpay.lastError && (
        <p className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs font-medium text-orange-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Couldn’t check Razorpay for new payouts the last time. Balances are correct up to the last payout recorded; it will be tried again automatically.
        </p>
      )}

      {/* Balances */}
      <section aria-label="Account balances" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">Total balance</p>
            <p className={clsx('font-mono text-3xl font-bold tabular-nums sm:text-4xl', totalBalancePaise < 0 ? 'text-rose-600' : 'text-neutral-900')}>{formatPaise(totalBalancePaise)}</p>
            <p className="text-[11px] font-medium text-gray-500">
              Across {accounts.filter((a) => a.isActive).length} accounts, as of {formatDay(today)}
            </p>
          </div>
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setAccountDialog({ mode: 'create' })}>
              <Plus className="size-3.5" aria-hidden />
              Add bank account
            </Button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              selected={selected?.id === account.id}
              razorpay={razorpay}
              canManage={canManage}
              isOwner={isOwner}
              syncing={sync.isPending}
              onSelect={() => select(account.id)}
              onDeposit={() => setTransferDialog({ fromAccountId: account.id, toAccountId: mainBank?.id ?? null })}
              onMatch={() => setMatchAccount(account)}
              onEdit={() => setAccountDialog({ mode: 'edit', account })}
              onSync={() => void checkRazorpay()}
            />
          ))}
        </div>
      </section>

      {/* Period */}
      <section aria-label="Money in and out for the period" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] font-bold tracking-wide text-neutral-900 uppercase">Money in and out</h2>
          <DateRangePicker
            label="Period"
            className="w-full sm:w-64"
            value={range}
            presets={FILTER_PRESETS}
            clearable
            onChange={(next) => {
              setRange({ from: next.from, to: next.to });
              setPage(1);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatTile label="Online received" value={formatPaise(summary.onlinePaise)} hint="Razorpay payouts to the bank" icon={Globe} color="blue" highlight />
          <StatTile label="Offline received" value={formatPaise(summary.offlinePaise)} hint="Cash, UPI and card sales" icon={Store} color="emerald" highlight />
          <StatTile label="Other money in" value={formatPaise(summary.otherIncomePaise)} hint="Added by hand" icon={ArrowDownLeft} color="teal" />
          <StatTile label="Expenses" value={formatPaise(summary.expensesPaise)} hint="Paid out with a description" icon={ReceiptText} color="rose" />
          <StatTile label="Salaries" value={formatPaise(summary.salariesPaise)} hint="Salary, advances and bonuses" icon={Wallet} color="purple" link={can('salaries.view') ? { to: '/salaries', label: 'Salaries' } : undefined} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-emerald-900 uppercase">Total in</p>
            <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums">{formatPaise(summary.inPaise)}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-rose-900 uppercase">Total out</p>
            <p className="font-mono text-lg font-bold text-rose-700 tabular-nums">{formatPaise(summary.outPaise)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">Difference</p>
            <p className={clsx('font-mono text-lg font-bold tabular-nums', summary.inPaise - summary.outPaise < 0 ? 'text-rose-700' : 'text-neutral-900')}>
              {summary.inPaise - summary.outPaise < 0 ? '−' : ''}
              {formatPaise(Math.abs(summary.inPaise - summary.outPaise))}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          {periodLabel}, all accounts together. Moving money between your own accounts isn’t counted{summary.adjustmentsPaise !== 0 ? `; corrections of ${formatPaise(summary.adjustmentsPaise)} are shown in the statement` : ''}.
        </p>
      </section>

      {/* Statement */}
      {selected && (
        <Panel>
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 pt-4 pb-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold tracking-wide text-neutral-900 uppercase">{selected.name} · statement</h2>
              <p className="text-[11px] text-gray-500">{periodLabel}. Newest first.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Show" className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
                {(
                  [
                    ['all', 'All'],
                    ['in', 'Money in'],
                    ['out', 'Money out'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    type="button"
                    aria-selected={direction === key}
                    onClick={() => {
                      setDirection(key);
                      setPage(1);
                    }}
                    className={clsx('rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors', direction === key ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-neutral-900')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {can('reports.export') && (
                <Button variant="secondary" size="sm" onClick={downloadCsv} loading={downloading}>
                  <Download className="size-3.5" aria-hidden />
                  Export
                </Button>
              )}
            </div>
          </div>

          {period && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-gray-100 px-4 py-3 text-xs sm:grid-cols-4 sm:px-5">
              <div>
                <dt className="text-[11px] font-medium text-gray-500">Balance at start</dt>
                <dd className="font-mono font-bold tabular-nums">{formatPaise(period.startPaise)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-gray-500">Money in</dt>
                <dd className="font-mono font-bold text-emerald-600 tabular-nums">+{formatPaise(period.inPaise)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-gray-500">Money out</dt>
                <dd className="font-mono font-bold text-rose-600 tabular-nums">−{formatPaise(period.outPaise)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-gray-500">Balance at end</dt>
                <dd className="font-mono font-bold tabular-nums">{formatPaise(period.endPaise)}</dd>
              </div>
            </dl>
          )}

          {statement.isPending ? (
            <TableSkeleton />
          ) : statement.error ? (
            <ErrorState error={statement.error} onRetry={() => void statement.refetch()} />
          ) : statement.data.items.length === 0 ? (
            <EmptyState
              icon={selected.kind === 'cash' ? Banknote : Landmark}
              title="Nothing here for this period"
              description={selected.kind === 'cash' ? 'Cash sales from offline orders appear here automatically.' : 'Razorpay payouts and offline UPI or card sales appear here automatically. Add expenses with “Money out”.'}
            />
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-fg-subtle">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Details</th>
                    <th className="px-3 py-3 text-right font-medium">Money in</th>
                    <th className="px-3 py-3 text-right font-medium">Money out</th>
                    <th className="px-3 py-3 text-right font-medium">Balance</th>
                    <th className="w-12 px-3 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statement.data.items.map((entry) => {
                    const cancelled = entry.reversedByEntryId != null || entry.isReversal;
                    const canCancel = canManage && !cancelled && MANUAL_TYPES.includes(entry.type);
                    return (
                      <tr key={entry.id} className={clsx(cancelled && 'bg-gray-50/60 text-gray-500')}>
                        <td className="px-5 py-3 whitespace-nowrap text-fg-muted tabular-nums">{formatDay(entry.entryDate)}</td>
                        <td className="max-w-md px-3 py-3">
                          <p className={clsx('font-medium text-neutral-900', entry.reversedByEntryId != null && 'line-through decoration-gray-400')}>{entry.description}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <EntryMeta entry={entry} />
                            <EntryFlags entry={entry} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">{entry.amountPaise > 0 && <Signed paise={entry.amountPaise} />}</td>
                        <td className="px-3 py-3 text-right">{entry.amountPaise < 0 && <Signed paise={entry.amountPaise} />}</td>
                        <td className={clsx('px-3 py-3 text-right font-mono font-bold tabular-nums', entry.balanceAfterPaise < 0 ? 'text-rose-600' : 'text-neutral-900')}>{formatPaise(entry.balanceAfterPaise)}</td>
                        <td className="px-3 py-3 text-right">
                          {canCancel && (
                            <button type="button" onClick={() => setCancelEntry(entry)} aria-label={`Cancel entry: ${entry.description}`} title="Cancel this entry" className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                              <Undo2 className="size-4" aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="divide-y divide-border md:hidden">
                {statement.data.items.map((entry) => {
                  const cancelled = entry.reversedByEntryId != null || entry.isReversal;
                  const canCancel = canManage && !cancelled && MANUAL_TYPES.includes(entry.type);
                  return (
                    <li key={entry.id} className={clsx('px-4 py-3', cancelled && 'bg-gray-50/60')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={clsx('text-sm font-medium text-neutral-900', entry.reversedByEntryId != null && 'line-through decoration-gray-400')}>{entry.description}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {formatDay(entry.entryDate)} · {TYPE_LABEL[entry.type]}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Signed paise={entry.amountPaise} className="text-sm" />
                          <p className="font-mono text-[11px] text-gray-500 tabular-nums">Bal {formatPaise(entry.balanceAfterPaise)}</p>
                        </div>
                      </div>
                      {(cancelled || canCancel) && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <EntryFlags entry={entry} />
                          {canCancel && (
                            <button type="button" onClick={() => setCancelEntry(entry)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                              <Undo2 className="size-3.5" aria-hidden />
                              Cancel entry
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Pagination page={statement.data.page} pageSize={statement.data.pageSize} total={statement.data.total} onPageChange={setPage} />
            </>
          )}
          <p className="border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500 sm:px-5">
            Opening balance {formatPaise(selected.openingBalancePaise)} as on {formatDay(selected.openingDate)}.
            {cash?.id === selected.id ? ' Cash from offline sales is added here; use “Deposit to bank” when you pay it in.' : ' Website payments are added when Razorpay pays out to the bank, after its fees.'}
          </p>
        </Panel>
      )}

      <EntryDialog state={entryDialog} accounts={accounts} categories={categories} today={today} onClose={() => setEntryDialog(null)} />
      <TransferDialog state={transferDialog} accounts={accounts} today={today} onClose={() => setTransferDialog(null)} />
      <MatchDialog account={matchAccount} onClose={() => setMatchAccount(null)} />
      <AccountDialog state={accountDialog} today={today} onClose={() => setAccountDialog(null)} />
      <CancelEntryDialog entry={cancelEntry} onClose={() => setCancelEntry(null)} />
    </div>
  );
}
