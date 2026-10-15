import { DateRangePicker } from '@/components/ui/DatePicker';
import { allTimeRange, REPORT_PRESETS, type PresetKey, type Range } from './range';

/** Reporting period: presets plus a custom span picked on the calendar. */
/** `firstDay` adds an "All time" preset starting on the shop's first day of activity. */
export function RangePicker({ value, onChange, iconOnly = false, firstDay }: { value: Range; onChange: (range: Range) => void; iconOnly?: boolean; firstDay?: string | null }) {
  return (
    <DateRangePicker
      label="Period"
      value={value}
      presets={firstDay === undefined ? REPORT_PRESETS : [{ key: 'all', label: 'All time', range: () => allTimeRange(firstDay) }, ...REPORT_PRESETS]}
      iconOnly={iconOnly}
      className={iconOnly ? undefined : 'w-60'}
      onChange={(r) => onChange({ preset: (r.preset || 'custom') as PresetKey, from: r.from, to: r.to })}
    />
  );
}
