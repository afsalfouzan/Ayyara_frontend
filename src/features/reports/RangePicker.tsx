import { DateRangePicker } from '@/components/ui/DatePicker';
import { REPORT_PRESETS, type PresetKey, type Range } from './range';

/** Reporting period: presets plus a custom span picked on the calendar. */
export function RangePicker({ value, onChange, iconOnly = false }: { value: Range; onChange: (range: Range) => void; iconOnly?: boolean }) {
  return (
    <DateRangePicker
      label="Period"
      value={value}
      presets={REPORT_PRESETS}
      iconOnly={iconOnly}
      className={iconOnly ? undefined : 'w-60'}
      onChange={(r) => onChange({ preset: (r.preset || 'custom') as PresetKey, from: r.from, to: r.to })}
    />
  );
}
