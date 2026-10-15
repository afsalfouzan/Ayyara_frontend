import { clsx } from 'clsx';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, Select, TextArea } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { messageOf } from '@/lib/errors';
import { useCorrectStock, type Variant } from './api';

export type CorrectTarget = { name: string; variant: Variant } | null;

export function CorrectStockSheet({ target, reasons, onClose }: { target: CorrectTarget; reasons: Record<string, string>; onClose: () => void }) {
  return (
    <Sheet open={target != null} onClose={onClose} title="Correct quantity" description={target ? `${target.name} · ${target.variant.sizeMl} ML` : undefined}>
      {target && <CorrectForm key={target.variant.id} target={target} reasons={reasons} onDone={onClose} />}
    </Sheet>
  );
}

function CorrectForm({ target, reasons, onDone }: { target: NonNullable<CorrectTarget>; reasons: Record<string, string>; onDone: () => void }) {
  const correct = useCorrectStock();
  const [requestId] = useState(() => crypto.randomUUID());
  const [counted, setCounted] = useState(String(target.variant.stock.onHand));
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const current = target.variant.stock.onHand;
  const next = /^\d+$/.test(counted) ? Number(counted) : null;
  const change = next == null ? 0 : next - current;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if (next == null) problems.counted = 'Enter the correct quantity';
    else if (change === 0) problems.counted = 'This is the same as the current quantity';
    else if (next < target.variant.stock.reserved) problems.counted = `${target.variant.stock.reserved} units are reserved for customer orders`;
    if (!reasonCode) problems.reasonCode = 'Choose a reason';
    if (note.trim().length < 3) problems.note = 'Explain what happened';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setConfirming(true);
  }

  async function save() {
    setConfirming(false);
    try {
      await correct.mutateAsync({ variantId: target.variant.id, quantity: change, reasonCode, note: note.trim(), requestId });
      toast(`${target.name} ${target.variant.sizeMl} ML is now ${next}`);
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK') setErrors({ counted: 'The quantity changed in the meantime. Close and try again.' });
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-fg-muted">
        Use this when the real count differs from the system — broken bottles, testers, or a recount. For new deliveries use <strong>Add purchase</strong>.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-muted p-3">
          <p className="text-xs text-fg-subtle">Now in godown</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{current}</p>
        </div>
        <FormField label="Correct quantity" htmlFor="counted" error={errors.counted}>
          <input id="counted" inputMode="numeric" className={`${controlClass} w-full text-lg`} value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} autoFocus />
        </FormField>
      </div>
      {change !== 0 && <p className={clsx('text-sm font-medium', change > 0 ? 'text-success' : 'text-danger')}>{change > 0 ? `+${change}` : change} units</p>}
      <FormField label="Reason" htmlFor="reason" error={errors.reasonCode}>
        <Select id="reason" className="w-full" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          <option value="">Choose…</option>
          {Object.entries(reasons).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Details" htmlFor="note" error={errors.note} hint="Saved permanently in the history.">
        <TextArea id="note" rows={2} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={correct.isPending}>
          Save
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Change ${target.name} ${target.variant.sizeMl} ML to ${next}?`}
        tone="primary"
        confirmLabel="Yes, change quantity"
        loading={correct.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save()}
        message={
          <>
            <p className="font-medium text-fg tabular-nums">
              {current} → {next} ({change > 0 ? `+${change}` : change} units)
            </p>
            <p className="mt-2">Customers can buy only what is in the godown, so the website changes straight away. The correction stays in the stock history.</p>
          </>
        }
      />
    </form>
  );
}
