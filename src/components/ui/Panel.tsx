import { clsx } from 'clsx';
import { ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link } from 'react-router';
import { ACCENTS, type Accent } from './accents';

export function Panel({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={clsx('rounded-2xl border border-gray-200 bg-white shadow-sm', className)} {...props} />;
}

/** Card header: uppercase title with an optional coloured icon, subtitle and actions. */
export function PanelHeader({ title, description, actions, icon: Icon, iconClass = 'text-gray-500' }: { title: string; description?: string; actions?: ReactNode; icon?: LucideIcon; iconClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
          {Icon && <Icon className={clsx('size-4 shrink-0', iconClass)} aria-hidden />}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[11px] text-gray-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A panel with a header and padded body; the header link is the usual "View all ›". */
export function SectionCard({
  icon,
  iconClass = 'text-emerald-600',
  title,
  subtitle,
  link,
  actions,
  children,
  className,
  bodyClassName = 'px-5 py-4',
}: {
  icon?: LucideIcon;
  iconClass?: string;
  title: string;
  subtitle?: string;
  link?: { to: string; label: string; external?: boolean };
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel className={clsx('flex flex-col', className)}>
      <PanelHeader
        icon={icon}
        iconClass={iconClass}
        title={title}
        description={subtitle}
        actions={
          actions ??
          (link && (
            <Link to={link.to} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-neutral-900 hover:underline">
              {link.label}
              {link.external ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            </Link>
          ))
        }
      />
      <div className={clsx('flex-1', bodyClassName)}>{children}</div>
    </Panel>
  );
}

export type ModuleRow = { label: string; value: string | number; to?: string; accent?: Accent };

/** Overview card: icon + uppercase title, a status pill and key/value rows that link to their page. */
export function ModuleCard({ icon: Icon, accent, title, badge, rows }: { icon: LucideIcon; accent: Accent; title: string; badge: { text: string; accent: Accent }; rows: ModuleRow[] }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
          <span className={clsx('grid size-7 place-items-center rounded-lg', ACCENTS[accent].soft)}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          {title}
        </h3>
        <span className={clsx('rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase', ACCENTS[badge.accent].pill)}>{badge.text}</span>
      </div>
      <dl className="space-y-2">
        {rows.map((row) => {
          const valueClass = clsx('text-xs font-bold tabular-nums', row.accent ? ACCENTS[row.accent].text : 'text-neutral-900');
          return (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium text-gray-600">{row.label}</dt>
              <dd>
                {row.to ? (
                  <Link to={row.to} className={clsx(valueClass, 'hover:underline')}>
                    {row.value}
                  </Link>
                ) : (
                  <span className={valueClass}>{row.value}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
