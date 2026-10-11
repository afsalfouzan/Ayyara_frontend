import { clsx } from 'clsx';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ACCENTS, type Accent } from './accents';

/** Older colour names used across pages, mapped onto accents. */
const LEGACY: Record<string, Accent> = { paid: 'emerald', unpaid: 'rose', neutral: 'gray', sale: 'emerald', profit: 'blue', cost: 'purple', items: 'orange' };
export type StatColor = Accent | 'paid' | 'unpaid' | 'neutral' | 'sale' | 'profit' | 'cost' | 'items';

/** KPI card: uppercase label, icon square, big value, optional pill, hint and link. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  color = 'gray',
  tone,
  highlight,
  pill,
  pillColor,
  link,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  color?: StatColor;
  /** Alert shorthand: warning → orange, danger → rose (highlighted). */
  tone?: 'neutral' | 'warning' | 'danger';
  highlight?: boolean;
  pill?: string;
  pillColor?: StatColor;
  link?: { to: string; label: string };
}) {
  const accent: Accent = tone === 'danger' ? 'rose' : tone === 'warning' ? 'orange' : (LEGACY[color] ?? (color as Accent));
  const isHighlighted = highlight ?? (tone === 'danger' || tone === 'warning');
  const a = ACCENTS[accent];
  const pillAccent: Accent = pillColor ? (LEGACY[pillColor] ?? (pillColor as Accent)) : accent;
  return (
    <div className={clsx('flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm', isHighlighted ? a.border : 'border-gray-200')}>
      <div className="flex items-start justify-between gap-3">
        <p className={clsx('text-[11px] leading-snug font-bold tracking-wide uppercase', isHighlighted ? a.label : 'text-gray-500')}>{label}</p>
        <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', isHighlighted ? a.solid : a.soft)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-xl font-bold text-neutral-900 tabular-nums lg:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-gray-500">{hint}</p>}
      {(pill || link) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {pill ? <span className={clsx('truncate rounded-md border px-1.5 py-0.5 text-[11px] font-bold', ACCENTS[pillAccent].pill)}>{pill}</span> : <span />}
          {link && (
            <Link to={link.to} className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gray-600 hover:text-neutral-900">
              {link.label}
              <ChevronRight className="size-3" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export { StatTile as KpiCard };
