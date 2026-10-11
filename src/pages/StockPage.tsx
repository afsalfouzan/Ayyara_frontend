import { Boxes, History, ImageOff, MoreHorizontal, Pencil, Plus, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StockBadge } from '@/components/ui/StatusBadges';
import { useSession } from '@/features/auth/session';
import { AddPurchaseDialog } from '@/features/stock/AddPurchaseDialog';
import { useStock, type Perfume, type Variant } from '@/features/stock/api';
import { CorrectStockSheet, type CorrectTarget } from '@/features/stock/CorrectStockSheet';
import { EditPerfumeSheet } from '@/features/stock/EditPerfumeSheet';
import { PurchaseHistorySheet, VariantHistorySheet, type HistoryTarget } from '@/features/stock/HistorySheets';
import { formatPaise } from '@/lib/money';

export default function StockPage() {
  const { can } = useSession();
  const stock = useStock();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState<CorrectTarget>(null);
  const [history, setHistory] = useState<HistoryTarget>(null);
  const [purchaseHistory, setPurchaseHistory] = useState(false);

  const actions = {
    edit: can('products.manage') ? (perfume: Perfume) => setEditing(perfume.id) : undefined,
    correct: can('inventory.adjust') ? (perfume: Perfume, variant: Variant) => setCorrecting({ name: perfume.name, variant }) : undefined,
    history: (perfume: Perfume, variant: Variant) => setHistory({ name: perfume.name, variant }),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description={stock.data ? `${stock.data.summary.perfumes} perfumes · ${stock.data.summary.totalOnHand} bottles in the godown` : 'Perfumes, prices and quantity in the godown.'}
        actions={
          <>
            {can('purchases.view') && (
              <Button variant="secondary" onClick={() => setPurchaseHistory(true)}>
                <ReceiptText className="size-4" aria-hidden />
                Purchase history
              </Button>
            )}
            {can('purchases.create') && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                Add purchase
              </Button>
            )}
          </>
        }
      />

      {stock.data && stock.data.summary.lowStock + stock.data.summary.outOfStock > 0 && (
        <p role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-4 py-2.5 text-sm text-warning">
          {[stock.data.summary.outOfStock && `${stock.data.summary.outOfStock} out of stock`, stock.data.summary.lowStock && `${stock.data.summary.lowStock} running low`].filter(Boolean).join(' · ')} — time to reorder.
        </p>
      )}

      <Panel>
        {stock.isPending ? (
          <TableSkeleton />
        ) : stock.error ? (
          <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
        ) : stock.data.items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No perfumes yet"
            description="Record your first purchase. You can add new perfumes, sizes and prices right in the purchase form."
            action={can('purchases.create') && <Button onClick={() => setAdding(true)}>Add purchase</Button>}
          />
        ) : (
          <>
            <DesktopTable perfumes={stock.data.items} actions={actions} />
            <MobileCards perfumes={stock.data.items} actions={actions} />
          </>
        )}
      </Panel>

      <AddPurchaseDialog open={adding} onClose={() => setAdding(false)} perfumes={stock.data?.items ?? []} />
      <EditPerfumeSheet perfumeId={editing} onClose={() => setEditing(null)} />
      <CorrectStockSheet target={correcting} reasons={stock.data?.adjustmentReasons ?? {}} onClose={() => setCorrecting(null)} />
      <VariantHistorySheet target={history} onClose={() => setHistory(null)} />
      <PurchaseHistorySheet open={purchaseHistory} onClose={() => setPurchaseHistory(false)} />
    </div>
  );
}

type Actions = {
  edit?: (perfume: Perfume) => void;
  correct?: (perfume: Perfume, variant: Variant) => void;
  history: (perfume: Perfume, variant: Variant) => void;
};

function Thumb({ perfume, size = 'size-12' }: { perfume: Perfume; size?: string }) {
  const photo = perfume.images[0];
  return photo ? (
    <img src={photo.url} alt="" className={`${size} shrink-0 rounded-lg border border-border object-cover`} loading="lazy" />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-lg border border-dashed border-border-strong text-fg-subtle`} title="No photo yet">
      <ImageOff className="size-4" aria-hidden />
    </span>
  );
}

function PerfumeInfo({ perfume }: { perfume: Perfume }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
        {perfume.name}
        {perfume.status === 'hidden' && <Badge>Hidden from website</Badge>}
      </p>
      <p className="mt-0.5 line-clamp-2 max-w-sm text-xs text-fg-muted">{perfume.description}</p>
    </div>
  );
}

function RowMenu({ perfume, variant, actions }: { perfume: Perfume; variant: Variant; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-surface-muted hover:text-fg';
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-label={`More for ${perfume.name} ${variant.sizeMl} ML`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 shadow-pop">
          {actions.correct && (
            <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); actions.correct!(perfume, variant); }}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Correct quantity
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); actions.history(perfume, variant); }}>
            <History className="size-4" aria-hidden />
            History
          </button>
        </div>
      )}
    </div>
  );
}

function Quantity({ variant }: { variant: Variant }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="text-base font-semibold tabular-nums">{variant.stock.onHand}</span>
      <StockBadge status={variant.stock.status} />
      {variant.stock.reserved > 0 && (
        <span className="w-full text-xs text-fg-muted" title="Held for customers who are paying; released automatically if they don't.">
          {variant.stock.reserved} reserved · {variant.stock.available} free
        </span>
      )}
    </span>
  );
}

function DesktopTable({ perfumes, actions }: { perfumes: Perfume[]; actions: Actions }) {
  return (
    <table className="hidden w-full text-sm md:table">
      <thead>
        <tr className="border-b border-border text-left text-xs text-fg-subtle">
          <th className="px-5 py-3 font-medium">Perfume</th>
          <th className="px-3 py-3 font-medium">Size</th>
          <th className="px-3 py-3 text-right font-medium">MRP</th>
          <th className="px-3 py-3 text-right font-medium">Selling price</th>
          <th className="px-3 py-3 font-medium">In godown</th>
          <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      {perfumes.map((perfume) => (
        <tbody key={perfume.id} className="border-b border-border last:border-0">
          {perfume.variants.map((variant, index) => (
            <tr key={variant.id} className="hover:bg-surface-muted/60">
              {index === 0 && (
                <td rowSpan={perfume.variants.length} className="px-5 py-3 align-top">
                  <div className="flex gap-3">
                    <Thumb perfume={perfume} />
                    <div className="min-w-0">
                      <PerfumeInfo perfume={perfume} />
                      {actions.edit && (
                        <button type="button" onClick={() => actions.edit!(perfume)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline">
                          <Pencil className="size-3" aria-hidden />
                          Edit photos, description &amp; prices
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              )}
              <td className="px-3 py-3 font-medium whitespace-nowrap">{variant.sizeMl} ML</td>
              <td className="px-3 py-3 text-right text-fg-muted tabular-nums">
                <s>{formatPaise(variant.mrpPaise)}</s>
              </td>
              <td className="px-3 py-3 text-right font-medium tabular-nums">{formatPaise(variant.pricePaise)}</td>
              <td className="px-3 py-3"><Quantity variant={variant} /></td>
              <td className="px-5 py-3 text-right"><RowMenu perfume={perfume} variant={variant} actions={actions} /></td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function MobileCards({ perfumes, actions }: { perfumes: Perfume[]; actions: Actions }) {
  return (
    <ul className="divide-y divide-border md:hidden">
      {perfumes.map((perfume) => (
        <li key={perfume.id} className="p-4">
          <div className="flex gap-3">
            <Thumb perfume={perfume} size="size-14" />
            <div className="min-w-0 flex-1">
              <PerfumeInfo perfume={perfume} />
              {actions.edit && (
                <button type="button" onClick={() => actions.edit!(perfume)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-info">
                  <Pencil className="size-3" aria-hidden />
                  Edit
                </button>
              )}
            </div>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {perfume.variants.map((variant) => (
              <li key={variant.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-14 text-sm font-medium">{variant.sizeMl} ML</span>
                <span className="flex-1 text-xs text-fg-muted tabular-nums">
                  <s>{formatPaise(variant.mrpPaise)}</s> <span className="text-sm font-medium text-fg">{formatPaise(variant.pricePaise)}</span>
                </span>
                <Quantity variant={variant} />
                <RowMenu perfume={perfume} variant={variant} actions={actions} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
