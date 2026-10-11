const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
// dateStyle/timeStyle can't be combined with timeZoneName, so spell the fields out.
const dateTimeZone = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** Shown in the viewer's own timezone (owner in the UK, staff in India). */
export function formatDateTime(value: string | null | undefined, withZone = false) {
  if (!value) return '—';
  return (withZone ? dateTimeZone : dateTime).format(new Date(value));
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return 'Never';
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
