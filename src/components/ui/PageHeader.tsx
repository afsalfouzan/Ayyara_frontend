import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { navigation } from '@/app/navigation';

/** Page title card. The icon comes from the matching sidebar item. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const item = navigation.flatMap((g) => g.items).find((i) => (i.path === '/' ? pathname === '/' : pathname.startsWith(i.path)));
  const Icon = item?.icon;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-neutral-900 sm:text-xl">{title}</h1>
          {description && <p className="mt-0.5 max-w-2xl text-xs font-medium text-gray-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
