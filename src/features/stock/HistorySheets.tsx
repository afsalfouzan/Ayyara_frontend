import { clsx } from 'clsx';
import { History, PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Sheet } from '@/components/ui/Sheet';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import { usePurchaseHistory, useVariantHistory, type Variant } from './api';

const TYPE_LABEL = { purchase: 'Purchase', sale: 'Sold', return: 'Returned', adjustment: 'Correction', cancellation: 'Order cancelled' } as const;

export type HistoryTarget = { name: string; variant: Variant } | null;

export function VariantHistorySheet({ target, onClose }: { target: HistoryTarget; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useVariantHistory(target?.variant.id ?? null, page);
  return (
    <Sheet open={target != null} onClose={() => { setPage(1); onClose(); }} title="History" description={target ? `${target.name} · ${target.variant.sizeMl} ML` : undefined}>
      {history.isPending ? (
        <TableSkeleton rows={5} />
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <EmptyState icon={History} title="No history yet" />
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <ul className="divide-y divide-border">
            {history.data.items.map((entry) => (
              <li key={entry.id} className="flex items-start gap-4 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{TYPE_LABEL[entry.type]}</p>
                  <p className="text-xs text-fg-muted">
                    {formatDateTime(entry.createdAt)}
                    {entry.createdBy && ` · ${entry.createdBy}`}
                  </p>
                  {entry.reason && entry.type !== 'purchase' && <p className="mt-0.5 text-xs text-fg-muted">{entry.reason}</p>}
                </div>
                <div className="text-right">
                  <p className={clsx('text-sm font-semibold tabular-nums', entry.quantity > 0 ? 'text-success' : 'text-danger')}>
                    {entry.quantity > 0 ? '+' : ''}
                    {entry.quantity}
                  </p>
                  <p className="text-xs text-fg-subtle tabular-nums">now {entry.balanceAfter}</p>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={history.data.page} pageSize={history.data.pageSize} total={history.data.total} onPageChange={setPage} />
        </div>
      )}
    </Sheet>
  );
}

export function PurchaseHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const purchases = usePurchaseHistory(page, open);
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  return (
    <Sheet open={open} onClose={onClose} title="Purchase history" description="Every delivery recorded at the godown.">
      {purchases.isPending ? (
        <TableSkeleton rows={4} />
      ) : purchases.error ? (
        <ErrorState error={purchases.error} onRetry={() => void purchases.refetch()} />
      ) : purchases.data.items.length === 0 ? (
        <EmptyState icon={PackagePlus} title="No purchases yet" />
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <ul className="divide-y divide-border">
            {purchases.data.items.map((purchase) => (
              <li key={purchase.id} className="px-5 py-4 sm:px-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{dateFormat.format(new Date(`${purchase.purchaseDate}T00:00:00`))}</p>
                  <p className="text-sm font-semibold tabular-nums">+{purchase.totalQuantity}</p>
                </div>
                <p className="text-xs text-fg-muted">
                  {purchase.createdBy ?? 'Unknown'}
                  {purchase.note && ` · ${purchase.note}`}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {purchase.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 text-fg-muted">
                      <span>
                        {item.productName} · {item.sizeMl} ML × {item.quantity}
                      </span>
                      {purchases.data.canViewCost && <span className="tabular-nums">{item.unitCostPaise != null ? `${formatPaise(item.unitCostPaise)} each` : '—'}</span>}
                    </li>
                  ))}
                </ul>
                {purchases.data.canViewCost && purchase.totalCostPaise != null && (
                  <p className="mt-1 text-right text-xs text-fg-subtle tabular-nums">Total cost {formatPaise(purchase.totalCostPaise)}</p>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={purchases.data.page} pageSize={purchases.data.pageSize} total={purchases.data.total} onPageChange={setPage} />
        </div>
      )}
    </Sheet>
  );
}
