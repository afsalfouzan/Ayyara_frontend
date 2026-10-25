import { clsx } from 'clsx';
import { CalendarDays, ChevronRight, Download, Landmark, Mail, Pencil, PiggyBank, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { controlClass, FormField } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { DatePicker, DateRangePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { toast } from '@/components/ui/Toast';
import { costsOf, downloadReport, useDeleteInvestment, useProfit, useSaveInvestment, useSendReport, useSetStartDate, type Investment, type ProfitAmounts, type ProfitDay, type ProfitOverview } from '@/features/profit/api';
import { FILTER_PRESETS, presetRange } from '@/features/reports/range';
import { formatDay, istToday } from '@/lib/dates';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatPaise, paiseToInput, parseRupees } from '@/lib/money';

/** A signed amount: losses and costs read with a minus sign. */
const signed = (paise: number) => (paise < 0 ? `−${formatPaise(-paise)}` : formatPaise(Math.abs(paise)));
const profitClass = (paise: number) => (paise < 0 ? 'text-rose-600' : paise > 0 ? 'text-emerald-700' : 'text-fg-muted');

/** What was still to earn back at the end of a day, in words. Nothing is owed before anything was invested. */
/** "3", or "3 · 1 waiting" when some are not paid yet. */
function bottlesText(figures: Pick<ProfitAmounts, 'bottlesSold' | 'bottlesWaiting' | 'bottlesUk'>) {
  const parts = [String(figures.bottlesSold)];
  if (figures.bottlesWaiting > 0) parts.push(`${figures.bottlesWaiting} waiting`);
  if (figures.bottlesUk > 0) parts.push(`${figures.bottlesUk} UK`);
  return parts.join(' · ');
}

function earnBackText(day: Pick<ProfitDay, 'investedPaise' | 'remainingPaise'>) {
  if (day.investedPaise <= 0) return 'No investment yet';
  if (day.remainingPaise > 0) return formatPaise(day.remainingPaise);
  return day.remainingPaise < 0 ? `Earned back · ${formatPaise(-day.remainingPaise)} extra` : 'Earned back';
}

type InvestmentDialogState = { open: boolean; entry: Investment | null };

export default function ProfitPage() {
  // The day-by-day table opens on the last 7 days and asks the server for 7 more each time "See previous 7 days" is pressed.
  // The date picker can still choose any range, and clearing it shows every day.
  const [range, setRange] = useState(() => {
    const { from, to } = presetRange('7d');
    return { from, to };
  });
  const loadPreviousWeek = () => setRange((current) => ({ from: shiftDay(current.from, -DAYS_PER_STEP), to: current.to }));
  const profit = useProfit(range);
  const [investmentDialog, setInvestmentDialog] = useState<InvestmentDialogState>({ open: false, entry: null });
  const [startOpen, setStartOpen] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const sendReport = useSendReport();
  const [params, setParams] = useSearchParams();

  async function download(date: string) {
    setBusyDate(date);
    try {
      await downloadReport(date);
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusyDate(null);
    }
  }

  // Arriving from the evening alert: open that day's report straight away.
  const requested = params.get('report');
  useEffect(() => {
    if (!requested || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return;
    setParams({}, { replace: true });
    void download(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  async function emailToday() {
    try {
      const result = await sendReport.mutateAsync(istToday());
      toast(`Today’s report was emailed to ${result.to}`);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  const data = profit.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Investment"
        description="What the business earned each day after every cost, and how much of your investment it has earned back. Only you can see this page."
        actions={
          <>
            <Button variant="secondary" onClick={() => void download(istToday())} loading={busyDate === istToday()}>
              <Download className="size-4" aria-hidden />
              Today’s report
            </Button>
            <Button variant="secondary" onClick={emailToday} loading={sendReport.isPending}>
              <Mail className="size-4" aria-hidden />
              Email it to me
            </Button>
            <Button onClick={() => setInvestmentDialog({ open: true, entry: null })}>
              <Plus className="size-4" aria-hidden />
              Add investment
            </Button>
          </>
        }
      />

      {profit.isPending ? (
        <Panel>
          <TableSkeleton />
        </Panel>
      ) : profit.error || !data ? (
        <Panel>
          <ErrorState error={profit.error} onRetry={() => void profit.refetch()} />
        </Panel>
      ) : (
        <>
          <Position data={data} onChangeStart={() => setStartOpen(true)} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Breakdown title="Today" subtitle={formatDay(data.today)} amounts={data.todayFigures} resultLabel={['Profit today', 'Loss today']} period={{ from: data.today, to: data.today }} bankNotes />
            <Breakdown title="This month" subtitle={`${formatDay(data.startDate > `${data.today.slice(0, 7)}-01` ? data.startDate : `${data.today.slice(0, 7)}-01`)} until today`} amounts={data.monthTotals} resultLabel={['Profit this month', 'Loss this month']} period={{ from: data.startDate > `${data.today.slice(0, 7)}-01` ? data.startDate : `${data.today.slice(0, 7)}-01`, to: data.today }} />
            <Breakdown title="Total profit" subtitle={`${formatDay(data.startDate)} until today`} amounts={data.allTotals} resultLabel={['Total profit earned', 'Total loss']} period={{ from: data.startDate, to: data.today }} />
            <div className="lg:self-start">
              <Investments entries={data.investments} total={data.position.investedPaise} onAdd={() => setInvestmentDialog({ open: true, entry: null })} onEdit={(entry) => setInvestmentDialog({ open: true, entry })} />
            </div>
          </div>

          <Panel>
            <PanelHeader
              icon={CalendarDays}
              iconClass="text-indigo-600"
              title="Day by day"
              description="Each day’s sales, costs and profit, and what was still to earn back at the end of it."
              stackActions
              actions={<DateRangePicker label="Days to show" className="w-full sm:w-64" value={range} presets={FILTER_PRESETS} clearable onChange={(next) => setRange({ from: next.from, to: next.to })} />}
            />
            <DayTable
              days={data.days}
              totals={data.rangeTotals}
              busyDate={busyDate}
              onDownload={download}
              // Earlier days exist only while the shown range starts after the first day profit is counted from.
              onLoadMore={range.from && data.range.from > data.startDate ? loadPreviousWeek : undefined}
              loading={profit.isFetching}
            />
          </Panel>

          <p className="px-1 text-xs text-gray-500">
            A sale counts on the day its payment was received. Monthly salaries, rent, electricity and maintenance are shared out over the days of their month. The cost of each bottle comes from the purchase it belonged to, newest purchase first. Courier charges come
            from dispatched orders.
          </p>
        </>
      )}

      <InvestmentDialog state={investmentDialog} onClose={() => setInvestmentDialog((current) => ({ ...current, open: false }))} />
      {data && <StartDateDialog open={startOpen} current={data.startDate} onClose={() => setStartOpen(false)} />}
    </div>
  );
}

function Position({ data, onChangeStart }: { data: ProfitOverview; onChangeStart: () => void }) {
  const { investedPaise, recoveredPaise, remainingPaise } = data.position;
  const share = investedPaise > 0 ? Math.max(0, Math.min(1, recoveredPaise / investedPaise)) : 0;
  const done = investedPaise > 0 && remainingPaise <= 0;
  return (
    <Panel className="p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total invested" value={formatPaise(investedPaise)} hint={`${data.investments.length} entr${data.investments.length === 1 ? 'y' : 'ies'}`} icon={PiggyBank} color="blue" highlight />
        <StatTile
          label={recoveredPaise < 0 ? 'Lost so far' : 'Earned back so far'}
          value={formatPaise(Math.abs(recoveredPaise))}
          hint={`Profit since ${formatDay(data.startDate)}`}
          icon={TrendingUp}
          color={recoveredPaise < 0 ? 'rose' : 'emerald'}
          highlight
        />
        <StatTile
          label={done ? 'Profit beyond your investment' : 'Still to earn back'}
          value={formatPaise(Math.abs(remainingPaise))}
          hint={investedPaise === 0 ? 'Add what you invested to track this' : done ? 'Your investment is fully earned back' : `${Math.round(share * 100)}% earned back`}
          icon={Target}
          color={done ? 'emerald' : 'orange'}
          highlight
        />
      </div>
      {investedPaise > 0 && (
        <div className="mt-4" role="progressbar" aria-label="Investment earned back" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${share * 100}%` }} />
          </div>
        </div>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
        <span>
          Profit is counted from <span className="font-semibold text-neutral-900">{formatDay(data.startDate)}</span>
          {!data.startDateChosen && ' (your first sale or investment)'}.
        </span>
        <button type="button" className="font-semibold text-neutral-900 underline underline-offset-2" onClick={onChangeStart}>
          Change
        </button>
      </p>
    </Panel>
  );
}

/** One line of the card: a label on the left, an amount on the right. */
function Row({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-3', className)}>
      <dt>
        {label}
        {hint && <span className="block text-xs font-normal text-gray-500">{hint}</span>}
      </dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{children}</p>;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * A profit card, written for the owner: money in, money out, what is left;
 * then how India and the UK each did, and the bottles behind it.
 * The UK figures are part of the totals, never added on top.
 */
function Breakdown({ title, subtitle, amounts, resultLabel, period, bankNotes }: { title: string; subtitle: string; amounts: ProfitAmounts | null; resultLabel: [string, string]; period: { from: string; to: string }; bankNotes?: boolean }) {
  if (!amounts) {
    return (
      <Panel>
        <PanelHeader icon={TrendingUp} iconClass="text-emerald-600" title={title} description={subtitle} />
        <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing counted for today yet.</p>
      </Panel>
    );
  }
  const a = amounts;
  const hasUk = Boolean(a.ukSalesPaise || a.ukRefundsPaise || a.ukCostPaise || a.bottlesUk || a.ukWaitingPaise);
  const indiaSales = a.salesPaise - a.ukSalesPaise;
  const indiaShop = a.offlineSalesPaise - a.ukSalesPaise;
  const indiaCost = a.goodsCostPaise - a.ukCostPaise;
  const indiaRefunds = a.refundsPaise - a.ukRefundsPaise;
  // What each region earned from its own sales, and the running costs of the business, which belong to neither.
  const indiaProfit = indiaSales - indiaRefunds - a.feesPaise - indiaCost - a.courierPaise - a.promotionCostPaise;
  const sharedCosts = a.salariesPaise + a.fixedCostsPaise + a.expensesPaise + a.stockLossPaise;
  const moneyOut = a.salesPaise - a.profitPaise;

  // Money going out, leaving out lines that are zero so the card stays short.
  const outLines: [string, number, string?][] = [
    [hasUk ? 'Perfumes sold in India (their cost)' : 'Perfumes sold (their cost)', indiaCost],
    ['Perfumes sold in the UK (their cost)', a.ukCostPaise],
    ['Money refunded to customers', a.refundsPaise],
    ['Razorpay fees', a.feesPaise],
    ['Courier charges', a.courierPaise],
    ['Salaries', a.salariesPaise, 'Each month’s salary shared over its days, plus bonuses'],
    ['Rent, electricity and maintenance', a.fixedCostsPaise, 'Shared over the days of the month'],
    ['Other expenses', a.expensesPaise],
    ['Bottles given free for promotion', a.promotionCostPaise],
    ['Stock written off', a.stockLossPaise],
  ];
  const profitLabel = a.profitPaise < 0 ? resultLabel[1] : resultLabel[0];

  return (
    <Panel>
      <PanelHeader icon={TrendingUp} iconClass="text-emerald-600" title={title} description={subtitle} />
      <div className="space-y-5 px-5 py-4 text-sm">
        <section className="space-y-2">
          <SectionTitle>Money in</SectionTitle>
          <dl className="space-y-2 text-gray-700">
            <Row label={hasUk ? 'India sales' : 'Sales'} value={formatPaise(indiaSales)} hint={`Website ${formatPaise(a.onlineSalesPaise)} · Shop ${formatPaise(indiaShop)}`} />
            {hasUk && <Row label="UK sales" value={formatPaise(a.ukSalesPaise)} />}
            <Row label="Total money in" value={formatPaise(a.salesPaise)} className="border-t border-gray-100 pt-2 font-semibold text-neutral-900" />
          </dl>
        </section>

        <section className="space-y-2">
          <SectionTitle>Money out</SectionTitle>
          <dl className="space-y-2 text-gray-700">
            {outLines
              .filter(([, value]) => value !== 0)
              .map(([label, value, hint]) => (
                <Row key={label} label={label} value={signed(-value)} hint={hint} />
              ))}
            <Row label="Total money out" value={signed(-moneyOut)} className="border-t border-gray-100 pt-2 font-semibold text-neutral-900" />
          </dl>
        </section>

        <div className={clsx('flex items-baseline justify-between gap-3 rounded-lg px-4 py-3', a.profitPaise < 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
          <div>
            <p className="text-base font-bold text-neutral-900">{profitLabel}</p>
            <p className="text-xs text-gray-600">Money in − money out{hasUk ? ', India and UK together' : ''}</p>
          </div>
          <p className={clsx('text-xl font-bold tabular-nums', profitClass(a.profitPaise))}>{signed(a.profitPaise)}</p>
        </div>

        {hasUk && (
          <section className="space-y-2">
            <SectionTitle>Where the profit came from</SectionTitle>
            <dl className="space-y-2 text-gray-700">
              <Row label="India" value={signed(indiaProfit)} hint="India sales minus their perfume cost, refunds, fees, courier and promotion" />
              <Row label="UK" value={signed(a.ukSalesPaise - a.ukRefundsPaise - a.ukCostPaise)} hint="UK sales minus their perfume cost" />
              <Row label="Running costs" value={signed(-sharedCosts)} hint="Salaries, rent and other expenses, for the whole business" />
              <Row label={profitLabel} value={signed(a.profitPaise)} className={clsx('border-t border-gray-100 pt-2 font-semibold', profitClass(a.profitPaise))} />
            </dl>
          </section>
        )}

        <section className="space-y-2">
          <SectionTitle>Bottles</SectionTitle>
          <dl className="space-y-2 text-gray-700">
            <Row
              label={hasUk ? 'Sold in India' : 'Sold'}
              value={String(a.bottlesSold)}
              hint={a.bottlesSold > 0 ? `${a.bottlesSold - a.bottlesWaiting} paid${a.bottlesWaiting > 0 ? ` · ${a.bottlesWaiting} not paid yet` : ''}` : undefined}
            />
            {a.bottlesPromotion > 0 && <Row label="Given free for promotion" value={String(a.bottlesPromotion)} />}
            {hasUk && <Row label="Sold in the UK" value={String(a.bottlesUk)} hint={a.ukBottlesWaiting > 0 ? `${a.bottlesUk - a.ukBottlesWaiting} paid · ${a.ukBottlesWaiting} not paid yet` : undefined} />}
          </dl>
          {(a.waitingPaise > 0 || a.ukWaitingPaise > 0) && (
            // Opens Offline Orders on "Not paid", for the same days, and for one region when only one has bills waiting.
            <Link
              to={`/offline-orders?${new URLSearchParams({ view: 'unpaid', from: period.from, to: period.to, ...(a.waitingPaise > 0 && a.ukWaitingPaise > 0 ? {} : { region: a.ukWaitingPaise > 0 ? 'uk' : 'india' }) })}`}
              className="group block space-y-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 transition-colors hover:border-orange-300 hover:bg-orange-100"
            >
              <p className="flex items-center justify-between gap-2 font-semibold">
                Still to collect (not counted in profit until paid)
                <ChevronRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </p>
              {a.waitingPaise > 0 && <p>{hasUk ? 'India: ' : ''}{formatPaise(a.waitingPaise)} for {plural(a.bottlesWaiting, 'bottle')}</p>}
              {a.ukWaitingPaise > 0 && <p>UK: {formatPaise(a.ukWaitingPaise)} for {plural(a.ukBottlesWaiting, 'bottle')}</p>}
              <p className="font-semibold underline underline-offset-2">See the unpaid bills</p>
            </Link>
          )}
          {a.receivedEarlierPaise > 0 && <p className="text-xs text-gray-500">{formatPaise(a.receivedEarlierPaise)} of the money in is for bills made on earlier days.</p>}
        </section>

        {bankNotes && a.notCreditedPaise > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {formatPaise(a.notCreditedPaise)} of today’s website sales (after Razorpay fees) is not yet credited to your bank. Razorpay pays it out in about two working days.
          </p>
        )}
        {bankNotes && a.creditedPaise > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {formatPaise(a.creditedPaise)} was credited to your bank by Razorpay today.
          </p>
        )}
      </div>
    </Panel>
  );
}

/** How many days each "See previous" press adds. */
const DAYS_PER_STEP = 7;

/** "2026-10-18" moved by a number of days. */
function shiftDay(isoDay: string, by: number) {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + by);
  return date.toISOString().slice(0, 10);
}

function DayTable({ days, totals, busyDate, onDownload, onLoadMore, loading }: { days: ProfitDay[]; totals: ProfitAmounts; busyDate: string | null; onDownload: (date: string) => void; onLoadMore?: () => void; loading: boolean }) {
  if (days.length === 0) return <EmptyState icon={CalendarDays} title="No days to show" description="Choose different dates, or change the day profit is counted from." />;
  const more = (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-fg-muted">
        {days.length} {days.length === 1 ? 'day' : 'days'}: {formatDay(days.at(-1)!.date)} to {formatDay(days[0]!.date)}
      </p>
      {onLoadMore ? (
        <Button size="sm" variant="secondary" className="w-full whitespace-nowrap sm:w-auto" loading={loading} onClick={onLoadMore}>
          See previous {DAYS_PER_STEP} days
        </Button>
      ) : (
        <span className="text-xs text-fg-subtle">No earlier days</span>
      )}
    </div>
  );
  const reportButton = (date: string) => (
    <Button size="sm" variant="ghost" aria-label={`Download the report for ${formatDay(date)}`} loading={busyDate === date} onClick={() => onDownload(date)}>
      <Download className="size-3.5" aria-hidden />
      PDF
    </Button>
  );
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-subtle">
              <th className="px-5 py-3 font-medium">Day</th>
              <th className="px-3 py-3 text-right font-medium">Sales</th>
              <th className="px-3 py-3 text-right font-medium">Bottles</th>
              <th className="px-3 py-3 text-right font-medium">Costs</th>
              <th className="px-3 py-3 text-right font-medium">Profit</th>
              <th className="px-3 py-3 text-right font-medium">Still to earn back</th>
              <th className="px-5 py-3 text-right font-medium">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {days.map((day) => (
              <tr key={day.date}>
                <td className="px-5 py-3 whitespace-nowrap">{formatDay(day.date)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatPaise(day.salesPaise)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{bottlesText(day)}</td>
                <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{formatPaise(costsOf(day))}</td>
                <td className={clsx('px-3 py-3 text-right font-semibold tabular-nums', profitClass(day.profitPaise))}>{signed(day.profitPaise)}</td>
                <td className={clsx('px-3 py-3 text-right tabular-nums', day.investedPaise > 0 && day.remainingPaise <= 0 && 'text-emerald-700', day.investedPaise <= 0 && 'text-fg-muted')}>{earnBackText(day)}</td>
                <td className="px-5 py-2 text-right">{reportButton(day.date)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-gray-50 font-semibold">
              <td className="px-5 py-3">Total for these {days.length} days</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatPaise(totals.salesPaise)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{bottlesText(totals)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatPaise(costsOf(totals))}</td>
              <td className={clsx('px-3 py-3 text-right tabular-nums', profitClass(totals.profitPaise))}>{signed(totals.profitPaise)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Phones: one card per day with labelled figures, then the total for the days shown. */}
      <ul className="divide-y divide-border md:hidden">
        {days.map((day) => (
          <li key={day.date} className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{formatDay(day.date)}</p>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium text-fg-subtle uppercase">Profit</span>
                <span className={clsx('text-base font-bold tabular-nums', profitClass(day.profitPaise))}>{signed(day.profitPaise)}</span>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <dt className="text-fg-subtle">Sales</dt>
                <dd className="font-medium tabular-nums">{formatPaise(day.salesPaise)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Costs</dt>
                <dd className="font-medium tabular-nums">{formatPaise(costsOf(day))}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-subtle">Bottles sold</dt>
                <dd className="font-medium tabular-nums">{bottlesText(day)}</dd>
              </div>
              <div className="col-span-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <dt className="text-fg-subtle">Still to earn back</dt>
                  <dd className={clsx('font-medium tabular-nums', day.investedPaise > 0 && day.remainingPaise <= 0 && 'text-emerald-700', day.investedPaise <= 0 && 'text-fg-muted')}>{earnBackText(day)}</dd>
                </div>
                {reportButton(day.date)}
              </div>
            </dl>
          </li>
        ))}
        <li className="bg-gray-50 px-4 py-3.5">
          <p className="text-xs font-semibold text-fg-muted">Total for these {days.length} days</p>
          <dl className="mt-1.5 grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="text-fg-subtle">Sales</dt>
              <dd className="text-sm font-semibold tabular-nums">{formatPaise(totals.salesPaise)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Costs</dt>
              <dd className="text-sm font-semibold tabular-nums">{formatPaise(costsOf(totals))}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Profit</dt>
              <dd className={clsx('text-sm font-bold tabular-nums', profitClass(totals.profitPaise))}>{signed(totals.profitPaise)}</dd>
            </div>
          </dl>
        </li>
      </ul>
      {more}
    </>
  );
}

function Investments({ entries, total, onAdd, onEdit }: { entries: Investment[]; total: number; onAdd: () => void; onEdit: (entry: Investment) => void }) {
  const remove = useDeleteInvestment();
  const [confirming, setConfirming] = useState<Investment | null>(null);

  async function confirmRemove() {
    if (!confirming) return;
    try {
      await remove.mutateAsync(confirming.id);
      toast('Investment entry removed');
      setConfirming(null);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <Panel>
      <PanelHeader
        icon={PiggyBank}
        iconClass="text-blue-600"
        title="What you invested"
        description="Money you put into the business to set it up: equipment, the first stock, deposits. Day-to-day spending goes in Accounts, not here."
        actions={
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        }
      />
      {entries.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No investment entered yet" description="Add what you put into the business, and this page will show how much of it has been earned back." />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{entry.description}</p>
                <p className="text-xs text-fg-muted">{formatDay(entry.entryDate)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatPaise(entry.amountPaise)}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`Edit ${entry.description}`} onClick={() => onEdit(entry)}>
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Remove ${entry.description}`} onClick={() => setConfirming(entry)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between bg-gray-50 px-5 py-3 text-sm font-semibold">
            <span>Total invested</span>
            <span className="tabular-nums">{formatPaise(total)}</span>
          </li>
        </ul>
      )}
      <Modal size="md" open={confirming != null} onClose={() => setConfirming(null)} title="Remove this investment entry?">
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{confirming.description}</span> · {formatPaise(confirming.amountPaise)} on {formatDay(confirming.entryDate)}. Your total invested goes down by this amount.
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                Keep it
              </Button>
              <Button variant="danger" onClick={confirmRemove} loading={remove.isPending}>
                Remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
}

function InvestmentDialog({ state, onClose }: { state: InvestmentDialogState; onClose: () => void }) {
  return (
    <Modal size="md" open={state.open} onClose={onClose} title={state.entry ? 'Edit investment' : 'Add investment'} description="Money you put into the business. It isn’t taken from any account here.">
      {state.open && <InvestmentForm entry={state.entry} onDone={onClose} />}
    </Modal>
  );
}

function InvestmentForm({ entry, onDone }: { entry: Investment | null; onDone: () => void }) {
  const save = useSaveInvestment(entry?.id ?? null);
  const [date, setDate] = useState(entry?.entryDate ?? istToday());
  const [amount, setAmount] = useState(entry ? paiseToInput(entry.amountPaise) : '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amountPaise = parseRupees(amount);
    if (amountPaise == null || Number.isNaN(amountPaise) || amountPaise < 1) next.amountPaise = 'Enter an amount';
    if (description.trim().length < 2) next.description = 'Say what this was for';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({ entryDate: date, amountPaise: amountPaise!, description: description.trim() });
      toast(entry ? 'Investment updated' : 'Investment added');
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormField label="Amount (₹)" htmlFor="investment-amount" error={errors.amountPaise}>
        <input id="investment-amount" inputMode="decimal" className={`${controlClass} w-full`} value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
      </FormField>
      <FormField label="What was it for?" htmlFor="investment-description" error={errors.description}>
        <input id="investment-description" maxLength={255} placeholder="e.g. Shop fit-out and first stock" className={`${controlClass} w-full`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      <FormField label="Date" htmlFor="investment-date" error={errors.entryDate}>
        <DatePicker id="investment-date" label="Investment date" max={istToday()} className="w-full" value={date} onChange={setDate} />
      </FormField>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {entry ? 'Save changes' : 'Add investment'}
        </Button>
      </div>
    </form>
  );
}

function StartDateDialog({ open, current, onClose }: { open: boolean; current: string; onClose: () => void }) {
  return (
    <Modal size="md" open={open} onClose={onClose} title="Count profit from" description="Sales and costs before this day are left out. Choose the day the shop really started.">
      {open && <StartDateForm current={current} onDone={onClose} />}
    </Modal>
  );
}

function StartDateForm({ current, onDone }: { current: string; onDone: () => void }) {
  const save = useSetStartDate();
  const [date, setDate] = useState(current);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await save.mutateAsync(date);
      toast(`Profit is now counted from ${formatDay(date)}`);
      onDone();
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="First day to count" htmlFor="profit-start">
        <DatePicker id="profit-start" label="First day to count" max={istToday()} className="w-full" value={date} onChange={setDate} />
      </FormField>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
