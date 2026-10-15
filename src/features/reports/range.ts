import type { DatePreset } from '@/components/ui/DatePicker';
import { addDays, addMonths, istToday } from '@/lib/dates';

export { istToday };

const shift = addDays;

export type PresetKey = 'all' | 'today' | '7d' | '30d' | 'month' | 'last_month' | '6m' | 'year' | 'custom';
type FixedPreset = Exclude<PresetKey, 'custom' | 'all'>;
export type Range = { preset: PresetKey; from: string; to: string };

export const PRESETS: { key: FixedPreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: '6m', label: '6 Months' },
  { key: 'year', label: 'This year' },
];

export function presetRange(key: FixedPreset): Range {
  const today = istToday();
  const [y, m] = today.split('-').map(Number) as [number, number];
  switch (key) {
    case 'today':
      return { preset: key, from: today, to: today };
    case '7d':
      return { preset: key, from: shift(today, -6), to: today };
    case '30d':
      return { preset: key, from: shift(today, -29), to: today };
    case 'month':
      return { preset: key, from: `${today.slice(0, 7)}-01`, to: today };
    case 'last_month': {
      const first = new Date(Date.UTC(y, m - 2, 1));
      const last = new Date(Date.UTC(y, m - 1, 0));
      return { preset: key, from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
    }
    case '6m':
      return { preset: key, from: shift(addMonths(today, -6), 1), to: today };
    case 'year':
      return { preset: key, from: `${y}-01-01`, to: today };
  }
}

const label = (key: FixedPreset) => PRESETS.find((p) => p.key === key)!.label;
const preset = (key: FixedPreset, text = label(key)): DatePreset => ({ key, label: text, range: () => presetRange(key) });

/**
 * Everything since the shop's first order or stock movement (`firstDay`, from the
 * backend), up to today. Reports cover two years at most, so older days are left out.
 */
export function allTimeRange(firstDay: string | null): Range {
  const today = istToday();
  const earliest = shift(today, -730);
  const from = !firstDay ? today : firstDay < earliest ? earliest : firstDay;
  return { preset: 'all', from, to: today };
}

/** Presets in the date picker on Reports and the dashboard. */
export const REPORT_PRESETS: DatePreset[] = [preset('today'), preset('7d', '7 Days'), preset('30d', '30 Days'), preset('month'), preset('last_month'), preset('6m'), preset('year')];

/** Presets for list filters (orders, payments, audit log), which can also be cleared. */
export const FILTER_PRESETS: DatePreset[] = [preset('today'), preset('7d', '7 Days'), preset('30d', '30 Days'), preset('month'), preset('6m')];

/** Sensible bucket size for the span. */
export function defaultGroupBy(range: Range): 'day' | 'week' | 'month' {
  const days = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000;
  return days > 120 ? 'month' : days > 45 ? 'week' : 'day';
}

const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function periodLabel(period: string, groupBy: 'day' | 'week' | 'month') {
  const date = new Date(`${period}T00:00:00Z`);
  if (groupBy === 'month') return monthFormat.format(date);
  if (groupBy === 'week') return `Wk of ${dayFormat.format(date)}`;
  return dayFormat.format(date);
}
