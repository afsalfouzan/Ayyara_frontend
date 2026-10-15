import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, Select, Switch, TextArea } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/DataState';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatPaise, paiseToInput, parseRupees } from '@/lib/money';
import { GENDER_LABEL, usePerfume, usePhotos, useSavePerfume, type Gender, type Perfume } from './api';

export function EditPerfumeSheet({ perfumeId, onClose }: { perfumeId: number | null; onClose: () => void }) {
  const perfume = usePerfume(perfumeId);
  return (
    <Sheet open={perfumeId != null} onClose={onClose} title={perfume.data ? `Edit ${perfume.data.name}` : 'Edit perfume'}>
      {perfume.isPending ? (
        <div className="h-96 animate-pulse rounded-lg bg-surface-muted" />
      ) : perfume.error ? (
        <ErrorState error={perfume.error} onRetry={() => void perfume.refetch()} />
      ) : (
        <div className="space-y-8">
          <Photos perfume={perfume.data} />
          <DetailsForm key={perfume.data.updatedAt + perfume.data.variants.length} perfume={perfume.data} onDone={onClose} />
        </div>
      )}
    </Sheet>
  );
}

function Photos({ perfume }: { perfume: Perfume }) {
  const { upload, reorder, remove } = usePhotos(perfume.id);
  const input = useRef<HTMLInputElement>(null);
  const photos = perfume.images;
  const [deleting, setDeleting] = useState<number | null>(null);

  async function add(files: FileList | null) {
    for (const file of Array.from(files ?? []).slice(0, 8 - photos.length)) {
      if (file.size > 10 * 1024 * 1024) {
        toast(`${file.name} is larger than 10 MB`, 'error');
        continue;
      }
      try {
        await upload.mutateAsync(file);
      } catch (error) {
        toast(messageOf(error), 'error');
      }
    }
    if (input.current) input.current.value = '';
  }

  function move(index: number, by: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    reorder.mutate(ids, { onError: (error) => toast(messageOf(error), 'error') });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Photos</h3>
          <p className="text-xs text-fg-muted">Shown on the website. The first photo is the main one.</p>
        </div>
        <span className="text-xs text-fg-subtle tabular-nums">{photos.length}/8</span>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => void add(e.target.files)} />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id} className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface-muted">
            <img src={photo.url} alt={photo.alt} className="size-full object-cover" />
            {index === 0 && <Badge tone="info" className="absolute top-1.5 left-1.5">Main</Badge>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 p-1">
              <button type="button" aria-label="Move left" disabled={index === 0} onClick={() => move(index, -1)} className="grid size-7 place-items-center rounded text-white disabled:opacity-30">
                <ArrowLeft className="size-3.5" aria-hidden />
              </button>
              <button type="button" aria-label="Delete photo" onClick={() => setDeleting(photo.id)} className="grid size-7 place-items-center rounded text-white">
                <X className="size-3.5" aria-hidden />
              </button>
              <button type="button" aria-label="Move right" disabled={index === photos.length - 1} onClick={() => move(index, 1)} className="grid size-7 place-items-center rounded text-white disabled:opacity-30">
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {photos.length < 8 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void add(e.dataTransfer.files);
              }}
              disabled={upload.isPending}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs text-fg-muted hover:border-fg-subtle hover:text-fg disabled:opacity-60"
            >
              <ImagePlus className="size-5" aria-hidden />
              {upload.isPending ? 'Uploading…' : 'Add photo'}
            </button>
          </li>
        )}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this photo?"
        message="It is removed from the website straight away and can’t be brought back. To use it again, upload it again."
        confirmLabel="Delete photo"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting !== null &&
          remove.mutate(deleting, {
            onSuccess: () => toast('Photo removed'),
            onError: (e) => toast(messageOf(e), 'error'),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </section>
  );
}

type SizeRow = { key: string; id?: number; size: string; mrp: string; price: string; alert: string; onHand: number };

function DetailsForm({ perfume, onDone }: { perfume: Perfume; onDone: () => void }) {
  const save = useSavePerfume(perfume.id);
  const [name, setName] = useState(perfume.name);
  const [description, setDescription] = useState(perfume.description);
  const [visible, setVisible] = useState(perfume.status === 'active');
  const [gender, setGender] = useState<Gender>(perfume.gender ?? 'unisex');
  const [sizes, setSizes] = useState<SizeRow[]>(() =>
    perfume.variants.map((v) => ({ key: String(v.id), id: v.id, size: String(v.sizeMl), mrp: paiseToInput(v.mrpPaise), price: paiseToInput(v.pricePaise), alert: String(v.lowStockThreshold), onHand: v.stock.onHand })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Price changes and hiding the perfume reach customers straight away, so they are confirmed first.
  const [changes, setChanges] = useState<string[] | null>(null);
  const updateSize = (key: string, patch: Partial<SizeRow>) => setSizes((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  async function submit() {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the perfume name';
    if (description.trim().length < 10) next.description = 'Add a short description for the website';
    if (sizes.length === 0) next.sizes = 'Add at least one size';
    sizes.forEach((row) => {
      const mrp = parseRupees(row.mrp);
      const price = parseRupees(row.price);
      if (!/^\d+$/.test(row.size) || Number(row.size) < 1) next[`${row.key}.size`] = 'Size in ml';
      if (mrp == null || Number.isNaN(mrp) || mrp < 100) next[`${row.key}.mrp`] = 'Enter MRP';
      if (price == null || Number.isNaN(price) || price < 100) next[`${row.key}.price`] = 'Enter price';
      else if (mrp != null && !Number.isNaN(mrp) && price > mrp) next[`${row.key}.price`] = 'More than MRP';
    });
    if (new Set(sizes.map((s) => s.size)).size !== sizes.length) next.sizes = 'Each size can appear only once';
    setErrors(next);
    if (Object.keys(next).length) return;

    const shopChanges: string[] = [];
    for (const row of sizes) {
      const old = perfume.variants.find((variant) => variant.id === row.id);
      if (!old) continue;
      const price = parseRupees(row.price)!;
      const mrp = parseRupees(row.mrp)!;
      if (price !== old.pricePaise) shopChanges.push(`${old.sizeMl} ml selling price ${formatPaise(old.pricePaise)} → ${formatPaise(price)}`);
      if (mrp !== old.mrpPaise) shopChanges.push(`${old.sizeMl} ml MRP ${formatPaise(old.mrpPaise)} → ${formatPaise(mrp)}`);
    }
    if (perfume.status === 'active' && !visible) shopChanges.push('Hidden from the website: customers can no longer see or buy it');
    if (shopChanges.length) setChanges(shopChanges);
    else await persist();
  }

  async function persist() {
    setChanges(null);
    try {
      await save.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        status: visible ? 'active' : 'hidden',
        gender,
        variants: sizes.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          sizeMl: Number(row.size),
          mrpPaise: parseRupees(row.mrp)!,
          pricePaise: parseRupees(row.price)!,
          lowStockThreshold: /^\d+$/.test(row.alert) ? Number(row.alert) : 5,
        })),
      });
      toast('Saved');
      onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <div className="space-y-6">
      <FormField label="Perfume name" htmlFor="perfume-name" error={errors.name}>
        <input id="perfume-name" className={`${controlClass} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Description" htmlFor="perfume-description" error={errors.description} hint="Shown on the perfume’s page on the website.">
        <TextArea id="perfume-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <FormField label="Made for" htmlFor="perfume-gender" hint="Puts the perfume under Men or Women in “Shop by gender” on the website. Unisex shows in both.">
        <Select id="perfume-gender" className="w-full" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          {(Object.keys(GENDER_LABEL) as Gender[]).map((key) => (
            <option key={key} value={key}>
              {GENDER_LABEL[key]}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Show on website</p>
          <p className="text-xs text-fg-muted">Turn off to hide this perfume from customers.</p>
        </div>
        <Switch label="Show on website" checked={visible} onChange={setVisible} />
      </div>

      <section>
        <h3 className="mb-1 text-sm font-medium">Sizes &amp; prices</h3>
        <p className="mb-3 text-xs text-fg-muted">MRP is shown struck through on the website; customers pay the selling price.</p>
        {errors.sizes && <p className="mb-2 text-xs text-danger">{errors.sizes}</p>}
        {errors.variants && <p className="mb-2 text-xs text-danger">{errors.variants}</p>}
        <div className="mb-1.5 hidden grid-cols-[5rem_1fr_1fr_5rem_2rem] gap-2 px-0.5 text-xs text-fg-subtle sm:grid">
          <span>Size (ml)</span>
          <span>MRP (₹)</span>
          <span>Selling (₹)</span>
          <span>Alert at</span>
          <span />
        </div>
        <ul className="space-y-2">
          {sizes.map((row) => (
            <li key={row.key} className="grid grid-cols-[5rem_1fr_1fr] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[5rem_1fr_1fr_5rem_2rem] sm:border-0 sm:p-0">
              <div>
                <input aria-label="Size in ml" inputMode="numeric" disabled={row.id != null && row.onHand > 0} className={`${controlClass} w-full`} value={row.size} onChange={(e) => updateSize(row.key, { size: e.target.value.replace(/\D/g, '') })} />
                {errors[`${row.key}.size`] && <p className="mt-1 text-xs text-danger">{errors[`${row.key}.size`]}</p>}
              </div>
              <div>
                <input aria-label="MRP" inputMode="decimal" className={`${controlClass} w-full`} value={row.mrp} onChange={(e) => updateSize(row.key, { mrp: e.target.value })} />
                {errors[`${row.key}.mrp`] && <p className="mt-1 text-xs text-danger">{errors[`${row.key}.mrp`]}</p>}
              </div>
              <div>
                <input aria-label="Selling price" inputMode="decimal" className={`${controlClass} w-full`} value={row.price} onChange={(e) => updateSize(row.key, { price: e.target.value })} />
                {errors[`${row.key}.price`] && <p className="mt-1 text-xs text-danger">{errors[`${row.key}.price`]}</p>}
              </div>
              <input aria-label="Low-stock alert at" inputMode="numeric" title="Show a low-stock warning at this quantity" className={`${controlClass} w-full`} value={row.alert} onChange={(e) => updateSize(row.key, { alert: e.target.value.replace(/\D/g, '') })} />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Remove size"
                disabled={row.onHand > 0}
                title={row.onHand > 0 ? 'Sizes with stock can’t be removed' : undefined}
                onClick={() => setSizes((current) => current.filter((s) => s.key !== row.key))}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setSizes((current) => [...current, { key: crypto.randomUUID(), size: '', mrp: '', price: '', alert: '5', onHand: 0 }])}
        >
          <Plus className="size-3.5" aria-hidden />
          Add size
        </Button>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          Save
        </Button>
      </div>
      <ConfirmDialog
        open={changes !== null}
        title={`Save changes to ${perfume.name}?`}
        tone="primary"
        confirmLabel="Yes, save"
        loading={save.isPending}
        onCancel={() => setChanges(null)}
        onConfirm={() => void persist()}
        message={
          <>
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {changes?.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
            <p className="mt-3">The website shows this straight away. Orders already placed keep their price.</p>
          </>
        }
      />
    </div>
  );
}
