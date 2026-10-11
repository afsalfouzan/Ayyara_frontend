import { clsx } from 'clsx';
import { DatePicker } from '@/components/ui/DatePicker';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { controlClass, FormField, Select, TextArea } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { paiseToInput, parseRupees } from '@/lib/money';
import { useAddPurchase, type Perfume, type PurchaseItemInput } from './api';

const PRESET_SIZES = [30, 50, 60, 100];
const NEW = '__new';
const OTHER = 'other';

/** A perfume created in this form; saved together with the purchase. */
type PendingPerfume = { ref: string; name: string; description: string };
/** A size created in this form for an existing or pending perfume. */
type PendingSize = { perfumeRef: string; sizeMl: number; mrpPaise: number; pricePaise: number };
type SizeOption = { sizeMl: number; mrpPaise: number; pricePaise: number; isNew: boolean };

type Row = {
  key: string;
  perfume: string; // existing product id, pending ref ("new:…") or ''
  size: string; // ml or ''
  quantity: string;
  cost: string;
};

type Creating = { kind: 'perfume'; rowKey: string } | { kind: 'size'; rowKey: string; perfumeRef: string } | null;

const emptyRow = (): Row => ({ key: crypto.randomUUID(), perfume: '', size: '', quantity: '', cost: '' });
const today = () => new Date().toLocaleDateString('en-CA');
const isPending = (ref: string) => ref.startsWith('new:');

export function AddPurchaseDialog({ open, onClose, perfumes }: { open: boolean; onClose: () => void; perfumes: Perfume[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Add purchase" description="Stock received at the godown. Quantities are added as soon as you save.">
      {open && <PurchaseForm perfumes={perfumes} onDone={onClose} />}
    </Modal>
  );
}

function PurchaseForm({ perfumes, onDone }: { perfumes: Perfume[]; onDone: () => void }) {
  const { can } = useSession();
  const canManage = can('products.manage');
  const canCost = can('purchases.view_cost');
  const addPurchase = useAddPurchase();
  // One id per form: a double-click or retry can't record the delivery twice.
  const [requestId] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [pendingPerfumes, setPendingPerfumes] = useState<PendingPerfume[]>([]);
  const [pendingSizes, setPendingSizes] = useState<PendingSize[]>([]);
  const [creating, setCreating] = useState<Creating>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const perfumeName = (ref: string) => (isPending(ref) ? pendingPerfumes.find((p) => p.ref === ref)?.name : perfumes.find((p) => String(p.id) === ref)?.name) ?? '';

  function sizesFor(ref: string): SizeOption[] {
    const existing = isPending(ref) ? [] : (perfumes.find((p) => String(p.id) === ref)?.variants ?? []).map((v) => ({ sizeMl: v.sizeMl, mrpPaise: v.mrpPaise, pricePaise: v.pricePaise, isNew: false }));
    const added = pendingSizes.filter((s) => s.perfumeRef === ref).map((s) => ({ ...s, isNew: true }));
    return [...existing, ...added].sort((a, b) => a.sizeMl - b.sizeMl);
  }
  const sizeOf = (row: Row) => sizesFor(row.perfume).find((s) => String(s.sizeMl) === row.size);

  // ── Created from the sub-popups ──────────────────────────────────────────
  function createPerfume(rowKey: string, input: { name: string; description: string } & SizePrice) {
    const ref = `new:${crypto.randomUUID()}`;
    setPendingPerfumes((current) => [...current, { ref, name: input.name, description: input.description }]);
    setPendingSizes((current) => [...current, { perfumeRef: ref, sizeMl: input.sizeMl, mrpPaise: input.mrpPaise, pricePaise: input.pricePaise }]);
    update(rowKey, { perfume: ref, size: String(input.sizeMl) });
    setCreating(null);
  }

  function createSize(rowKey: string, perfumeRef: string, input: SizePrice) {
    setPendingSizes((current) => [...current, { perfumeRef, ...input }]);
    update(rowKey, { size: String(input.sizeMl) });
    setCreating(null);
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function submit() {
    const next: Record<string, string> = {};
    rows.forEach((row, i) => {
      if (!row.perfume) next[`${i}.perfume`] = 'Choose a perfume';
      else if (!row.size || !sizeOf(row)) next[`${i}.size`] = 'Choose a size';
      if (!/^\d+$/.test(row.quantity) || Number(row.quantity) < 1) next[`${i}.quantity`] = 'Enter quantity';
      if (canCost && row.cost && Number.isNaN(parseRupees(row.cost))) next[`${i}.cost`] = 'Invalid amount';
    });
    const combos = rows.filter((r) => r.perfume && r.size).map((r) => `${r.perfume}|${r.size}`);
    rows.forEach((row, i) => {
      if (row.perfume && row.size && combos.filter((c) => c === `${row.perfume}|${row.size}`).length > 1) next[`${i}.size`] = 'Already in the list — combine the quantities';
    });
    setErrors(next);
    if (Object.keys(next).length) return;

    const items: PurchaseItemInput[] = rows.map((row) => {
      const size = sizeOf(row)!;
      const base = {
        sizeMl: size.sizeMl,
        quantity: Number(row.quantity),
        // Prices are only sent for sizes created in this form; existing sizes keep their catalogue prices.
        ...(size.isNew ? { mrpPaise: size.mrpPaise, pricePaise: size.pricePaise } : {}),
        ...(canCost && row.cost ? { unitCostPaise: parseRupees(row.cost) } : {}),
      };
      if (isPending(row.perfume)) {
        const perfume = pendingPerfumes.find((p) => p.ref === row.perfume)!;
        return { ...base, newProduct: { name: perfume.name, description: perfume.description } };
      }
      return { ...base, productId: Number(row.perfume) };
    });

    try {
      const result = await addPurchase.mutateAsync({ requestId, purchaseDate: date, note: note.trim() || null, items });
      toast(`Purchase saved: +${result.purchase.totalQuantity} units added to stock`);
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      const mapped: Record<string, string> = {};
      for (const [key, message] of Object.entries(fieldErrors)) {
        const match = /^items\.(\d+)\.(\w+)/.exec(key);
        if (!match) continue;
        const field = { mrpPaise: 'size', pricePaise: 'size', sizeMl: 'size', newProduct: 'perfume', productId: 'perfume', unitCostPaise: 'cost' }[match[2]!] ?? match[2]!;
        mapped[`${match[1]}.${field}`] = message;
      }
      if (Object.keys(mapped).length) setErrors(mapped);
      else toast(messageOf(error), 'error');
    }
  }

  const err = (i: number, field: string) => errors[`${i}.${field}`];
  const totalUnits = rows.reduce((total, row) => total + (/^\d+$/.test(row.quantity) ? Number(row.quantity) : 0), 0);
  const grid = canCost ? 'lg:grid-cols-[minmax(11rem,1.5fr)_9.5rem_5.5rem_6.5rem_6.5rem_7rem_2.5rem]' : 'lg:grid-cols-[minmax(11rem,1.5fr)_9.5rem_5.5rem_6.5rem_6.5rem_2.5rem]';
  const allPerfumeNames = [...perfumes.map((p) => p.name), ...pendingPerfumes.map((p) => p.name)];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Date received</span>
          <DatePicker label="Purchase date" max={today()} className="w-full" value={date} onChange={setDate} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Note <span className="font-normal text-fg-subtle">(optional — supplier, invoice no.)</span>
          </span>
          <input className={`${controlClass} w-full`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div>
        <div className={clsx('mb-2 hidden gap-3 px-1 text-xs font-medium text-fg-subtle lg:grid', grid)}>
          <span>Perfume</span>
          <span>Size</span>
          <span>Quantity</span>
          <span>MRP (₹)</span>
          <span>Selling (₹)</span>
          {canCost && <span>Cost / unit (₹)</span>}
          <span />
        </div>

        <ul className="space-y-3">
          {rows.map((row, i) => {
            const size = sizeOf(row);
            return (
              <li key={row.key} className="rounded-xl border border-border p-3 lg:rounded-none lg:border-0 lg:p-0">
                <div className={clsx('grid grid-cols-2 gap-3 lg:items-start', grid)}>
                  <Cell label="Perfume" error={err(i, 'perfume')} className="col-span-2 lg:col-span-1">
                    <Select
                      aria-label="Perfume"
                      className="w-full"
                      value={row.perfume}
                      onChange={(e) => {
                        // "New perfume" opens a popup; the row keeps its value until the perfume is created.
                        if (e.target.value === NEW) setCreating({ kind: 'perfume', rowKey: row.key });
                        else update(row.key, { perfume: e.target.value, size: '' });
                      }}
                    >
                      <option value="">Choose perfume…</option>
                      {perfumes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      {pendingPerfumes.map((p) => (
                        <option key={p.ref} value={p.ref}>
                          {p.name} (new)
                        </option>
                      ))}
                      {canManage && <option value={NEW}>＋ New perfume…</option>}
                    </Select>
                  </Cell>
                  <Cell label="Size" error={err(i, 'size')}>
                    <Select
                      aria-label="Size"
                      className="w-full"
                      value={row.size}
                      disabled={!row.perfume}
                      onChange={(e) => {
                        if (e.target.value === NEW) setCreating({ kind: 'size', rowKey: row.key, perfumeRef: row.perfume });
                        else update(row.key, { size: e.target.value });
                      }}
                    >
                      <option value="">Size…</option>
                      {sizesFor(row.perfume).map((s) => (
                        <option key={s.sizeMl} value={s.sizeMl}>
                          {s.sizeMl} ML{s.isNew ? ' (new)' : ''}
                        </option>
                      ))}
                      {canManage && row.perfume && <option value={NEW}>＋ New size…</option>}
                    </Select>
                  </Cell>
                  <Cell label="Quantity" error={err(i, 'quantity')}>
                    <input aria-label="Quantity" inputMode="numeric" className={`${controlClass} w-full`} value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value.replace(/\D/g, '') })} />
                  </Cell>
                  <Cell label="MRP (₹)">
                    <LockedPrice label="MRP" value={size?.mrpPaise} />
                  </Cell>
                  <Cell label="Selling (₹)">
                    <LockedPrice label="Selling price" value={size?.pricePaise} />
                  </Cell>
                  {canCost && (
                    <Cell label="Cost / unit (₹)" error={err(i, 'cost')}>
                      <input aria-label="Cost per unit" inputMode="decimal" placeholder="Optional" className={`${controlClass} w-full`} value={row.cost} onChange={(e) => update(row.key, { cost: e.target.value })} />
                    </Cell>
                  )}
                  <div className="col-span-2 flex justify-end lg:col-span-1">
                    <Button variant="ghost" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-2 px-1 text-xs text-fg-subtle">MRP and selling price come from the Stock page. To change them, use Edit on that perfume.</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setRows((current) => [...current, emptyRow()])} disabled={rows.length >= 50}>
            <Plus className="size-3.5" aria-hidden />
            Add row
          </Button>
          <p className="text-sm text-fg-muted">
            Total <strong className="text-fg tabular-nums">{totalUnits}</strong> units
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={addPurchase.isPending}>
          Save purchase
        </Button>
      </div>

      {/* Sub-popups open above the purchase popup. */}
      <Modal size="md" open={creating?.kind === 'perfume'} onClose={() => setCreating(null)} title="New perfume" description="It will be saved together with this purchase.">
        {creating?.kind === 'perfume' && (
          <NewPerfumeForm existingNames={allPerfumeNames} onCancel={() => setCreating(null)} onCreate={(input) => createPerfume(creating.rowKey, input)} />
        )}
      </Modal>
      <Modal
        size="md"
        open={creating?.kind === 'size'}
        onClose={() => setCreating(null)}
        title="New size"
        description={creating?.kind === 'size' ? `For ${perfumeName(creating.perfumeRef)}` : undefined}
      >
        {creating?.kind === 'size' && (
          <NewSizeForm
            takenSizes={sizesFor(creating.perfumeRef).map((s) => s.sizeMl)}
            onCancel={() => setCreating(null)}
            onCreate={(input) => createSize(creating.rowKey, creating.perfumeRef, input)}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Sub-popup forms ──────────────────────────────────────────────────────────

type SizePrice = { sizeMl: number; mrpPaise: number; pricePaise: number };

/** Size + MRP + selling price fields shared by both popups. */
function useSizePriceFields(takenSizes: number[]) {
  const presets = PRESET_SIZES.filter((ml) => !takenSizes.includes(ml));
  const [size, setSize] = useState('');
  const [custom, setCustom] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');

  function validate(errors: Record<string, string>): SizePrice | null {
    const sizeMl = size === OTHER ? Number(custom) : Number(size);
    const mrpPaise = parseRupees(mrp);
    const pricePaise = parseRupees(price);
    if (!size || !Number.isInteger(sizeMl) || sizeMl < 1 || sizeMl > 1000) errors.size = 'Choose a size';
    else if (takenSizes.includes(sizeMl)) errors.size = `${sizeMl} ML already exists for this perfume`;
    if (mrpPaise == null || Number.isNaN(mrpPaise) || mrpPaise < 100) errors.mrp = 'Enter MRP';
    if (pricePaise == null || Number.isNaN(pricePaise) || pricePaise < 100) errors.price = 'Enter selling price';
    else if (mrpPaise != null && !Number.isNaN(mrpPaise) && pricePaise > mrpPaise) errors.price = 'Selling price can’t be more than MRP';
    return Object.keys(errors).length ? null : { sizeMl, mrpPaise: mrpPaise!, pricePaise: pricePaise! };
  }

  function render(errors: Record<string, string>) {
    return (
      <>
        <FormField label="Size" htmlFor="sp-size" error={errors.size}>
          <div className="flex gap-2">
            <Select id="sp-size" className="w-full" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Choose size…</option>
              {presets.map((ml) => (
                <option key={ml} value={ml}>
                  {ml} ML
                </option>
              ))}
              <option value={OTHER}>Other…</option>
            </Select>
            {size === OTHER && (
              <input aria-label="Size in ml" placeholder="ml" inputMode="numeric" className={`${controlClass} w-24`} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} autoFocus />
            )}
          </div>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="MRP (₹)" htmlFor="sp-mrp" error={errors.mrp}>
            <input id="sp-mrp" inputMode="decimal" className={`${controlClass} w-full`} value={mrp} onChange={(e) => setMrp(e.target.value)} />
          </FormField>
          <FormField label="Selling price (₹)" htmlFor="sp-price" error={errors.price}>
            <input id="sp-price" inputMode="decimal" className={`${controlClass} w-full`} value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
        </div>
      </>
    );
  }

  return { validate, render };
}

function NewPerfumeForm({ existingNames, onCreate, onCancel }: { existingNames: string[]; onCreate: (input: { name: string; description: string } & SizePrice) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sizeFields = useSizePriceFields([]);

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the perfume name';
    else if (existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase())) next.name = 'This perfume already exists — choose it from the list';
    if (description.trim().length < 10) next.description = 'Add a short description for the website';
    const sizePrice = sizeFields.validate(next);
    setErrors(next);
    if (Object.keys(next).length || !sizePrice) return;
    onCreate({ name: name.trim(), description: description.trim(), ...sizePrice });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Perfume name" htmlFor="np-name" error={errors.name}>
        <input id="np-name" className={`${controlClass} w-full`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormField>
      <FormField label="Description" htmlFor="np-description" error={errors.description} hint="Shown on the website. Photos can be added later with Edit.">
        <TextArea id="np-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="space-y-4 rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-fg-subtle uppercase">First size</p>
        {sizeFields.render(errors)}
      </div>
      <PopupActions onCancel={onCancel}>Create perfume</PopupActions>
    </form>
  );
}

function NewSizeForm({ takenSizes, onCreate, onCancel }: { takenSizes: number[]; onCreate: (input: SizePrice) => void; onCancel: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sizeFields = useSizePriceFields(takenSizes);

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next: Record<string, string> = {};
    const sizePrice = sizeFields.validate(next);
    setErrors(next);
    if (sizePrice) onCreate(sizePrice);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {sizeFields.render(errors)}
      <PopupActions onCancel={onCancel}>Create size</PopupActions>
    </form>
  );
}

function PopupActions({ onCancel, children }: { onCancel: () => void; children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit">{children}</Button>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

/** Catalogue price in a read-only box; prices are changed with Edit, not in a purchase. */
function LockedPrice({ label, value }: { label: string; value?: number }) {
  return (
    <input
      aria-label={label}
      readOnly
      tabIndex={-1}
      value={paiseToInput(value)}
      placeholder="—"
      title={value != null ? 'Change prices with Edit on the Stock page' : 'Choose a size first'}
      className={`${controlClass} w-full cursor-not-allowed bg-surface-muted text-fg-muted shadow-none`}
    />
  );
}

/** Field wrapper: label shown on mobile (desktop uses the column headings). */
function Cell({ label, error, className, children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium text-fg-subtle lg:hidden">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
