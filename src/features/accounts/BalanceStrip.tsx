import { clsx } from 'clsx';
import { Banknote, ChevronRight, Landmark } from 'lucide-react';
import { Link } from 'react-router';
import { formatPaise } from '@/lib/money';
import { useOverview } from './api';

const NO_RANGE = { from: '', to: '' };

/**
 * Dashboard card: what the business holds right now, in total and per account.
 * It is today's balance, so it does not change with the dashboard's date range.
 * Render it only for users who may see accounts (`accounts.view`).
 */
export function BalanceStrip() {
  const overview = useOverview(NO_RANGE);
  if (overview.isPending) return <div className="h-24 animate-pulse rounded-2xl bg-gray-200/60" />;
  // The dashboard is still useful without this card, so a failure here stays quiet.
  if (overview.error) return null;

  const { totalBalancePaise, razorpay } = overview.data;
  const accounts = overview.data.accounts.filter((account) => account.isActive);

  return (
    <section aria-label="Account balance" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0">
          <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">Account balance now</p>
          <p className={clsx('mt-1 font-mono text-2xl font-bold tabular-nums lg:text-3xl', totalBalancePaise < 0 ? 'text-rose-600' : 'text-neutral-900')}>{formatPaise(totalBalancePaise)}</p>
          {razorpay.configured && razorpay.onTheWayPaise > 0 && (
            <p className="mt-0.5 text-[11px] text-blue-700">
              + <span className="font-mono font-bold">{formatPaise(razorpay.onTheWayPaise)}</span> on the way from Razorpay
            </p>
          )}
        </div>

        <ul className="flex flex-1 flex-wrap gap-2 lg:justify-end">
          {accounts.map((account) => {
            const Icon = account.kind === 'cash' ? Banknote : Landmark;
            return (
              <li key={account.id} className="flex min-w-36 flex-1 items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 sm:flex-none">
                <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg text-white', account.kind === 'cash' ? 'bg-emerald-600' : 'bg-neutral-900')}>
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-gray-500">{account.name}</span>
                  <span className={clsx('block font-mono text-sm font-bold tabular-nums', account.balancePaise < 0 ? 'text-rose-600' : 'text-neutral-900')}>{formatPaise(account.balancePaise)}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <Link to="/accounts" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-neutral-900 hover:underline">
          Accounts
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
