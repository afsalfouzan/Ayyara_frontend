import { TriangleAlert } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from './Button';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong while loading this data.';
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <TriangleAlert className="size-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-medium text-fg">Couldn’t load data</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
