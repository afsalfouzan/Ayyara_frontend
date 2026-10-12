import { clsx } from 'clsx';
import { CalendarDays, ChevronDown, Triangle, X } from 'lucide-react';
import { useState } from 'react';
import { formatDateRange, formatDay, isoDate, istToday, parseDate } from '@/lib/dates';
import { controlClass, Select } from './controls';
import { popoverReset, useAnchoredPopover } from './Popover';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FIRST_YEAR = 2024;

type View = { year: number; month: number };

function viewOf(date: string | undefined): View {
  const { year, month } = parseDate(date || istToday());
  return { year, month };
}

/**
 * One month grid. The selected span is drawn as a continuous black band per
 * week row, rounded at the span's ends and at row edges.
 */
function Calendar({ view, onView, from, to, preview, max, min, onPick, onHover }: { view: View; onView: (view: View) => void; from?: string; to?: string; preview?: boolean; max?: string; min?: string; onPick: (date: string) => void; onHover?: (date: string | null) => void }) {
  const today = istToday();
  const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ date: '', day: prevDays - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: isoDate(view.year, view.month, d), day: d, inMonth: true });
  for (let d = 1; cells.length % 7; d++) cells.push({ date: '', day: d, inMonth: false });

  const lo = from && to ? (from < to ? from : to) : from;
  const hi = from && to ? (from < to ? to : from) : from;
  const maxYear = parseDate(max || today).year;
  const years = Array.from({ length: Math.max(1, maxYear - FIRST_YEAR + 1) }, (_, i) => FIRST_YEAR + i);
  const step = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    onView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };
  const canNext = !max || isoDate(view.year, view.month, daysInMonth) < max;

  return (
    <div className="w-[19.5rem] max-w-full">
      <div className="flex items-center justify-between gap-1">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-md bg-gray-100 text-neutral-900 hover:bg-gray-200">
          <Triangle className="size-2.5 -rotate-90 fill-current" aria-hidden />
        </button>
        <div className="flex items-center">
          <Select aria-label="Month" value={view.month} onChange={(e) => onView({ ...view, month: Number(e.target.value) })} className="h-8 w-[7.5rem] border-transparent text-xs font-bold hover:bg-gray-50 sm:text-xs">
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </Select>
          <Select aria-label="Year" value={view.year} onChange={(e) => onView({ ...view, year: Number(e.target.value) })} className="h-8 w-[5.25rem] border-transparent text-xs font-bold hover:bg-gray-50 sm:text-xs">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next month" className="grid size-7 place-items-center rounded-md bg-gray-100 text-neutral-900 hover:bg-gray-200 disabled:opacity-40">
          <Triangle className="size-2.5 rotate-90 fill-current" aria-hidden />
        </button>
      </div>
      <p className="mt-3 mb-2 px-1 text-xs font-bold text-gray-400">
        {MONTHS[view.month]!.slice(0, 3)} {view.year}
      </p>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onPointerLeave={() => onHover?.(null)}>
        {cells.map((cell, i) => {
          const col = i % 7;
          const inRange = cell.inMonth && lo && hi && cell.date >= lo && cell.date <= hi;
          const isEnd = cell.date === lo || cell.date === hi;
          const blocked = !cell.inMonth || (max && cell.date > max) || (min && cell.date < min);
          const band = inRange && (preview && !isEnd ? 'bg-gray-200 text-neutral-900' : 'bg-neutral-900 text-white');
          return (
            <div
              key={i}
              className={clsx(
                band,
                inRange && (cell.date === lo || col === 0 || cell.day === 1) && 'rounded-l-full',
                inRange && (cell.date === hi || col === 6 || cell.day === daysInMonth) && 'rounded-r-full',
              )}
            >
              <button
                type="button"
                disabled={Boolean(blocked)}
                onClick={() => onPick(cell.date)}
                onPointerEnter={() => cell.inMonth && onHover?.(cell.date)}
                aria-label={cell.inMonth ? formatDay(cell.date) : undefined}
                aria-pressed={cell.inMonth ? Boolean(inRange) : undefined}
                tabIndex={cell.inMonth ? 0 : -1}
                className={clsx(
                  'relative mx-auto grid h-8 w-full place-items-center rounded-full text-xs font-medium',
                  !cell.inMonth && 'text-gray-300',
                  cell.inMonth && blocked && 'text-gray-300',
                  cell.inMonth && !blocked && !inRange && 'text-neutral-800 hover:bg-gray-100',
                )}
              >
                {cell.day}
                {cell.date === today && <span className={clsx('absolute bottom-1 h-0.5 w-3.5 rounded-full', inRange && !(preview && !isEnd) ? 'bg-white' : 'bg-neutral-900')} aria-hidden />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type DatePreset = { key: string; label: string; range: () => { from: string; to: string } };

/**
 * Date-range field: quick presets on the left, a month calendar on the right.
 * Pick a start and an end day (either order); presets apply immediately.
 * `onChange` reports which preset matched, or 'custom'.
 */
export function DateRangePicker({
  value,
  onChange,
  presets,
  max = istToday(),
  placeholder = 'All dates',
  label = 'Date range',
  clearable = false,
  iconOnly = false,
  className,
}: {
  value: { from: string; to: string };
  onChange: (range: { from: string; to: string; preset: string }) => void;
  presets: DatePreset[];
  max?: string;
  placeholder?: string;
  label?: string;
  clearable?: boolean;
  /** Show only a calendar icon as the trigger (e.g. next to tabs). */
  iconOnly?: boolean;
  className?: string;
}) {
  const { anchorRef, popoverRef, open, show, hide } = useAnchoredPopover<HTMLButtonElement>();
  const [view, setView] = useState<View>(() => viewOf(value.to || value.from));
  const [start, setStart] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);

  const matched = presets.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  });
  const hasValue = Boolean(value.from || value.to);
  const activeKey = customMode || start ? 'custom' : (matched?.key ?? (hasValue ? 'custom' : ''));

  function openPicker() {
    setView(viewOf(value.to || value.from));
    setStart(null);
    setHover(null);
    setCustomMode(false);
    show();
  }

  function pick(date: string) {
    if (!start) {
      setStart(date);
      return;
    }
    const [from, to] = start <= date ? [start, date] : [date, start];
    setStart(null);
    hide();
    const preset = presets.find((p) => {
      const r = p.range();
      return r.from === from && r.to === to;
    });
    onChange({ from, to, preset: preset?.key ?? 'custom' });
  }

  function applyPreset(preset: DatePreset) {
    hide();
    onChange({ ...preset.range(), preset: preset.key });
  }

  const text = hasValue ? formatDateRange(value.from, value.to) : placeholder;

  return (
    <>
      {iconOnly ? (
        <button
          ref={anchorRef}
          type="button"
          onClick={() => (open ? hide() : openPicker())}
          aria-label={`${label}: ${text}`}
          aria-expanded={open}
          className={clsx('grid size-[38px] shrink-0 place-items-center rounded-xl border bg-white text-gray-600 hover:bg-gray-50', activeKey === 'custom' ? 'border-neutral-900 text-neutral-900' : 'border-gray-200', className)}
        >
          <CalendarDays className="size-4" aria-hidden />
        </button>
      ) : (
        <span className={clsx('relative inline-flex', className)}>
          <button
            ref={anchorRef}
            type="button"
            onClick={() => (open ? hide() : openPicker())}
            aria-label={`${label}: ${text}`}
            aria-expanded={open}
            data-field
            className={clsx(controlClass, 'inline-flex w-full items-center gap-2 text-left', open && 'border-neutral-900', clearable && hasValue && 'pr-8')}
          >
            <CalendarDays className="size-4 shrink-0 text-gray-500" aria-hidden />
            <span className={clsx('flex-1 truncate font-medium', !hasValue && 'text-neutral-500')}>{text}</span>
            {!(clearable && hasValue) && <ChevronDown className={clsx('size-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden />}
          </button>
          {clearable && hasValue && (
            <button type="button" onClick={() => onChange({ from: '', to: '', preset: '' })} aria-label="Clear dates" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-neutral-900">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      )}
      <div ref={popoverRef} popover="auto" className={popoverReset}>
        <div role="dialog" aria-label={label} className="flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-pop sm:flex-row">
          <ul className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0 sm:p-3">
            {presets.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={clsx('w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-bold whitespace-nowrap', activeKey === p.key ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-gray-100')}
                >
                  {p.label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  setStart(null);
                }}
                className={clsx('w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-bold whitespace-nowrap', activeKey === 'custom' ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-gray-100')}
              >
                Custom
              </button>
            </li>
          </ul>
          <div className="p-4">
            <Calendar
              view={view}
              onView={setView}
              from={start ?? value.from}
              to={start ? (hover ?? start) : value.to}
              preview={Boolean(start)}
              max={max}
              onPick={pick}
              onHover={setHover}
            />
            <p className="mt-3 h-4 text-center text-[11px] font-medium text-gray-500">{start ? `From ${formatDay(start)} — now pick the end date` : hasValue ? formatDateRange(value.from, value.to) : 'Pick a start date'}</p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Single date field with the same calendar. */
export function DatePicker({ value, onChange, max, min, label = 'Date', id, className }: { value: string; onChange: (date: string) => void; max?: string; min?: string; label?: string; id?: string; className?: string }) {
  const { anchorRef, popoverRef, open, show, hide } = useAnchoredPopover<HTMLButtonElement>();
  const [view, setView] = useState<View>(() => viewOf(value));
  const today = istToday();
  const todayAllowed = (!max || today <= max) && (!min || today >= min);

  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        onClick={() => {
          if (open) return hide();
          setView(viewOf(value));
          show();
        }}
        aria-label={`${label}: ${value ? formatDay(value) : 'not set'}`}
        aria-expanded={open}
        data-field
        className={clsx(controlClass, 'inline-flex items-center gap-2 text-left', open && 'border-neutral-900', className)}
      >
        <CalendarDays className="size-4 shrink-0 text-gray-500" aria-hidden />
        <span className={clsx('flex-1 truncate font-medium', !value && 'text-neutral-500')}>{value ? formatDay(value) : 'Pick a date'}</span>
        <ChevronDown className={clsx('size-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div ref={popoverRef} popover="auto" className={popoverReset}>
        <div role="dialog" aria-label={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-pop">
          <Calendar
            view={view}
            onView={setView}
            from={value}
            to={value}
            max={max}
            min={min}
            onPick={(date) => {
              hide();
              onChange(date);
            }}
          />
          {todayAllowed && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  hide();
                  onChange(today);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-neutral-900 hover:bg-gray-100"
              >
                Today
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
