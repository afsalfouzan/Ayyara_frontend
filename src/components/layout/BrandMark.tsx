import { clsx } from 'clsx';
import { LOGO_FULL, LOGO_MARK, LOGO_WORDMARK } from '@/components/brand/logo-paths';

function Shape({ shape, className }: { shape: { viewBox: string; d: string }; className?: string }) {
  return (
    <svg viewBox={shape.viewBox} className={clsx('w-auto shrink-0', className)} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={shape.d} />
    </svg>
  );
}

/** Sidebar / header lockup: the AB monogram, plus the AYYARA wordmark when there is room. */
export function BrandMark({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={clsx('flex items-center gap-3 text-neutral-900', className)} role="img" aria-label="Ayyara Rebirth Admin">
      <Shape shape={LOGO_MARK} className="h-7" />
      {!collapsed && (
        <span className="flex flex-col items-start leading-none">
          <Shape shape={LOGO_WORDMARK} className="h-[0.8rem]" />
          <span className="mt-1.5 text-[0.55rem] font-semibold tracking-[0.3em] text-gray-500 uppercase">Rebirth · Admin</span>
        </span>
      )}
    </span>
  );
}

/** The full stacked logo (monogram, AYYARA, Rebirth) for sign-in screens. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Ayyara Rebirth" className={clsx('inline-flex text-neutral-900', className)}>
      <Shape shape={LOGO_FULL} className="h-full" />
    </span>
  );
}
