/** Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings; business days are India time. */

export function istToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { year: y, month: m - 1, day: d };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same day `months` later (clamped to the month's last day). */
export function addMonths(date: string, months: number) {
  const { year, month, day } = parseDate(date);
  const last = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month + months, Math.min(day, last)));
  return d.toISOString().slice(0, 10);
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function formatDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/** "1 Oct – 11 Oct 2026", or a single day when both ends match. */
export function formatDateRange(from: string, to: string) {
  if (!from && !to) return '';
  if (!to || from === to) return formatDay(from || to);
  if (!from) return `Until ${formatDay(to)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? dayMonthFormat.format(new Date(`${from}T00:00:00Z`)) : formatDay(from)} – ${formatDay(to)}`;
}
