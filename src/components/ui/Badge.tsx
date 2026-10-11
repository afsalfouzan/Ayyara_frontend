import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-orange-50 text-orange-700 border-orange-100',
  danger: 'bg-rose-50 text-rose-700 border-rose-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
