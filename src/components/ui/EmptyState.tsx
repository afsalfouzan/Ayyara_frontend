import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="mt-4 text-sm font-bold text-neutral-900">{title}</h3>
      {description && <div className="mt-1.5 max-w-sm text-xs text-gray-500">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
