import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-4 py-3 text-xs font-semibold text-gray-500 sm:px-5">
      <p className="tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted disabled:opacity-40">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page" className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted disabled:opacity-40">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
