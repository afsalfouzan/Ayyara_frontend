import { clsx } from 'clsx';
import { AlertTriangle, Boxes, EyeOff, Globe, History, ImageOff, MoreHorizontal, PackageX, Pencil, Plus, ReceiptText, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/controls';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { useSession } from '@/features/auth/session';
import { AddPurchaseDialog } from '@/features/stock/AddPurchaseDialog';
import { GENDER_LABEL, useStock, type Perfume, type Variant } from '@/features/stock/api';
import { CorrectStockSheet, type CorrectTarget } from '@/features/stock/CorrectStockSheet';
import { EditPerfumeSheet } from '@/features/stock/EditPerfumeSheet';
import { PurchaseHistorySheet, VariantHistorySheet, type HistoryTarget } from '@/features/stock/HistorySheets';
import { formatPaise } from '@/lib/money';

type View = 'all' | 'low' | 'out' | 'hidden';

const VIEWS: { view: View; label: string }[] = [
  { view: 'all', label: 'All' },
  { view: 'low', label: 'Running low' },
  { view: 'out', label: 'Out of stock' },
  { view: 'hidden', label: 'Hidden' },
];

/** Which sizes of a perfume a quick filter keeps. "Hidden" is about the perfume, so it keeps every size. */
const keeps: Record<View, (perfume: Perfume, variant: Variant) => boolean> = {
  all: () => true,
  low: (_, v) => v.stock.status === 'low_stock',
  out: (_, v) => v.stock.status === 'out_of_stock',
  hidden: (p) => p.status === 'hidden',
};

export default function StockPage() {
  const { can } = useSession();
  const stock = useStock();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState<CorrectTarget>(null);
  const [history, setHistory] = useState<HistoryTarget>(null);
  const [purchaseHistory, setPurchaseHistory] = useState(false);
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search).trim().toLowerCase();

  const actions = {
    edit: can('products.manage') ? (perfume: Perfume) => setEditing(perfume.id) : undefined,
    correct: can('inventory.adjust') ? (perfume: Perfume, variant: Variant) => setCorrecting({ name: perfume.name, variant }) : undefined,
    history: (perfume: Perfume, variant: Variant) => setHistory({ name: perfume.name, variant }),
  };

  const items = stock.data?.items;
  const counts = useMemo(() => {
    const all = items ?? [];
    const sizes = all.flatMap((p) => p.variants);
    return { all: all.length, low: sizes.filter((v) => v.stock.status === 'low_stock').length, out: sizes.filter((v) => v.stock.status === 'out_of_stock').length, hidden: all.filter((p) => p.status === 'hidden').length };
  }, [items]);

  // Search by name; a quick filter keeps only the sizes that match it, so "Running low" shows exactly what to reorder.
  const shown = useMemo(
    () =>
      (items ?? [])
        .filter((p) => !term || p.name.toLowerCase().includes(term))
        .map((p) => ({ ...p, variants: p.variants.filter((v) => keeps[view](p, v)) }))
        .filter((p) => p.variants.length > 0),
    [items, term, view],
  );
  // One scale for every level bar, so a longer bar always means more bottles.
  const fullest = Math.max(1, ...(items ?? []).flatMap((p) => p.variants.map((v) => v.stock.onHand)));
  const summary = stock.data?.summary;
  const sizeCount = shown.reduce((total, p) => total + p.variants.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Perfumes, prices and the bottles in the godown."
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

      {summary && (
        <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <li>
            <StatTile label="Perfumes" value={summary.perfumes} hint={counts.hidden ? `${counts.hidden} hidden from the website` : 'All live on the website'} icon={Sparkles} color="indigo" />
          </li>
          <li>
            <StatTile label="Bottles in godown" value={summary.totalOnHand} hint="Across every size" icon={Boxes} color="blue" highlight />
          </li>
          <li>
            <StatTile label="Running low" value={summary.lowStock} hint={summary.lowStock ? 'Time to reorder' : 'Nothing to reorder'} icon={AlertTriangle} color="orange" highlight={summary.lowStock > 0} />
          </li>
          <li>
            <StatTile label="Out of stock" value={summary.outOfStock} hint={summary.outOfStock ? 'Not on sale until restocked' : 'Everything is available'} icon={PackageX} color="rose" highlight={summary.outOfStock > 0} />
          </li>
        </ul>
      )}

      <Panel className="overflow-hidden">
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
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div role="tablist" aria-label="Stock filter" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1">
                {VIEWS.map(({ view: value, label }) => (
                  <button
                    key={value}
                    role="tab"
                    type="button"
                    aria-selected={view === value}
                    onClick={() => setView(value)}
                    className={clsx('group flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors', view === value ? 'bg-neutral-900 text-white shadow-sm' : 'text-gray-500 hover:text-neutral-900')}
                  >
                    {label}
                    {counts[value] > 0 && <span className="rounded-md bg-white px-1.5 text-[10px] font-bold text-gray-600 tabular-nums group-aria-selected:bg-white/20 group-aria-selected:text-white">{counts[value]}</span>}
                  </button>
                ))}
              </div>
              <SearchInput className="w-full lg:w-72" placeholder="Search perfumes" aria-label="Search perfumes" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Nothing matches"
                description={term ? `No perfume named “${search.trim()}”${view === 'all' ? '' : ' in this filter'}.` : 'No perfume is in this filter right now.'}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setView('all');
                    }}
                  >
                    Show all perfumes
                  </Button>
                }
              />
            ) : (
              <>
                <DesktopTable perfumes={shown} actions={actions} fullest={fullest} />
                <MobileCards perfumes={shown} actions={actions} fullest={fullest} />
                <p className="border-t border-gray-100 px-5 py-3 text-xs font-semibold text-gray-500">
                  {shown.length} {shown.length === 1 ? 'perfume' : 'perfumes'} · {sizeCount} {sizeCount === 1 ? 'size' : 'sizes'}
                </p>
              </>
            )}
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

function Thumb({ perfume, size = 'size-14' }: { perfume: Perfume; size?: string }) {
  const photo = perfume.images[0];
  return photo ? (
    <img src={photo.url} alt="" className={`${size} shrink-0 rounded-xl border border-gray-200 object-cover`} loading="lazy" />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400`} title="No photo yet">
      <ImageOff className="size-4" aria-hidden />
    </span>
  );
}

function PerfumeInfo({ perfume }: { perfume: Perfume }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-bold text-neutral-900">{perfume.name}</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge>{GENDER_LABEL[perfume.gender] ?? 'Unisex'}</Badge>
        {perfume.status === 'hidden' ? (
          <Badge tone="warning">
            <EyeOff className="size-3" aria-hidden />
            Hidden
          </Badge>
        ) : (
          <Badge tone="success">
            <Globe className="size-3" aria-hidden />
            On website
          </Badge>
        )}
        {perfume.images.length === 0 && <Badge tone="info">No photo</Badge>}
      </p>
      <p className="mt-1.5 line-clamp-1 max-w-md text-xs font-normal text-gray-500" title={perfume.description}>
        {perfume.description}
      </p>
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

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-neutral-900';
  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="ghost" size="sm" aria-label={`More for ${perfume.name} ${variant.sizeMl} ML`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-pop">
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

function Price({ variant }: { variant: Variant }) {
  const off = variant.mrpPaise > variant.pricePaise ? Math.round(((variant.mrpPaise - variant.pricePaise) / variant.mrpPaise) * 100) : 0;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-mono text-sm font-bold text-neutral-900 tabular-nums">{formatPaise(variant.pricePaise)}</span>
      {off > 0 && (
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
          <s className="text-gray-400 tabular-nums">{formatPaise(variant.mrpPaise)}</s>
          <span className="font-bold text-emerald-600">{off}% off</span>
        </span>
      )}
    </span>
  );
}

const LEVEL = {
  in_stock: { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'In stock' },
  low_stock: { bar: 'bg-orange-500', text: 'text-orange-700', label: 'Running low' },
  out_of_stock: { bar: 'bg-rose-500', text: 'text-rose-700', label: 'Out of stock' },
} as const;

/** Bottle count with a level bar (same scale on every row) and the status in words, never colour alone. */
function StockLevel({ variant, fullest }: { variant: Variant; fullest: number }) {
  const level = LEVEL[variant.stock.status];
  const percent = variant.stock.onHand === 0 ? 0 : Math.max(6, Math.round((variant.stock.onHand / fullest) * 100));
  return (
    <div className="w-full min-w-36 max-w-52">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-bold text-neutral-900 tabular-nums">
          {variant.stock.onHand}
          <span className="ml-1 text-[11px] font-medium text-gray-500">{variant.stock.onHand === 1 ? 'bottle' : 'bottles'}</span>
        </span>
        <span className={clsx('text-[11px] font-bold whitespace-nowrap', level.text)}>{level.label}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div className={clsx('h-full rounded-full', level.bar)} style={{ width: `${percent}%` }} />
      </div>
      {variant.stock.reserved > 0 && (
        <p className="mt-1 text-[11px] text-gray-500" title="Held for customers who are paying; released automatically if they don't.">
          {variant.stock.reserved} reserved · {variant.stock.available} free
        </p>
      )}
    </div>
  );
}

function DesktopTable({ perfumes, actions, fullest }: { perfumes: Perfume[]; actions: Actions; fullest: number }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
            <th className="px-5 py-3">Perfume</th>
            <th className="px-3 py-3">Size</th>
            <th className="px-3 py-3 text-right">Price</th>
            <th className="px-3 py-3 text-right">Total purchased</th>
            <th className="px-5 py-3">In godown</th>
            <th className="px-5 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {perfumes.map((perfume) => (
          <tbody key={perfume.id} className="border-b border-gray-100 last:border-0">
            {perfume.variants.map((variant, index) => (
              <tr key={variant.id} className="transition-colors hover:bg-gray-50/70">
                {index === 0 && (
                  <td rowSpan={perfume.variants.length} className="px-5 py-4 align-top">
                    <div className="flex items-start gap-3.5">
                      <Thumb perfume={perfume} />
                      <PerfumeInfo perfume={perfume} />
                    </div>
                  </td>
                )}
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-900">{variant.sizeMl} ML</span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <Price variant={variant} />
                </td>
                <td className="px-3 py-4 text-right font-mono text-sm font-bold whitespace-nowrap text-neutral-900 tabular-nums">{variant.totalPurchased}</td>
                <td className="px-5 py-4">
                  <StockLevel variant={variant} fullest={fullest} />
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {index === 0 && actions.edit && (
                      <Button variant="secondary" size="sm" onClick={() => actions.edit!(perfume)} aria-label={`Edit ${perfume.name}`}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                    )}
                    <RowMenu perfume={perfume} variant={variant} actions={actions} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function MobileCards({ perfumes, actions, fullest }: { perfumes: Perfume[]; actions: Actions; fullest: number }) {
  return (
    <ul className="divide-y divide-gray-100 md:hidden">
      {perfumes.map((perfume) => (
        <li key={perfume.id} className="p-4">
          <div className="flex items-start gap-3">
            <Thumb perfume={perfume} />
            <div className="min-w-0 flex-1">
              <PerfumeInfo perfume={perfume} />
            </div>
            {actions.edit && (
              <Button variant="secondary" size="sm" onClick={() => actions.edit!(perfume)} aria-label={`Edit ${perfume.name}`}>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {perfume.variants.map((variant) => (
              <li key={variant.id} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-neutral-900">{variant.sizeMl} ML</span>
                  <span className="flex items-center gap-1">
                    <Price variant={variant} />
                    <RowMenu perfume={perfume} variant={variant} actions={actions} />
                  </span>
                </div>
                <div className="mt-2.5 [&>div]:max-w-none">
                  <StockLevel variant={variant} fullest={fullest} />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Total purchased <span className="font-mono font-bold text-neutral-900 tabular-nums">{variant.totalPurchased}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
