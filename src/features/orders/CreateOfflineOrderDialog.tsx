import { clsx } from 'clsx';
import { DatePicker } from '@/components/ui/DatePicker';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, Select, Switch, TextArea } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { useStock, type Perfume } from '@/features/stock/api';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatPaise, paiseToInput, parseRupees } from '@/lib/money';
import { INDIAN_STATES } from '@/lib/states';
import { InvoiceButton } from './invoice';
import { OFFLINE_METHOD_LABEL, OFFLINE_METHODS, REGION_LABEL, useCreateOfflineOrder, type OfflineMethod, type OrderDetail, type SellingRegion } from './api';

/** `cost`: UK only, what each bottle actually cost (India's cost comes from the purchases in Stock). */
type Row = { key: string; perfumeId: string; variantId: string; quantity: string; price: string; cost: string };
const emptyRow = (): Row => ({ key: crypto.randomUUID(), perfumeId: '', variantId: '', quantity: '1', price: '', cost: '' });
/** Line layout on wide screens; UK lines have one more column, for the cost. */
const GRID = { india: 'lg:grid-cols-[minmax(10rem,1.4fr)_minmax(9rem,1fr)_5rem_7.5rem_6.5rem_2.5rem]', uk: 'lg:grid-cols-[minmax(9rem,1.3fr)_minmax(7rem,1fr)_4.5rem_7rem_7rem_6.5rem_2.5rem]' } as const;
const today = () => new Date().toLocaleDateString('en-CA');

export function CreateOfflineOrderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (order: OrderDetail) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New offline order" description="A sale made in person or over the phone, in India or in the UK.">
      {open && <OfflineOrderForm onDone={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function OfflineOrderForm({ onDone, onCreated }: { onDone: () => void; onCreated: (order: OrderDetail) => void }) {
  const stock = useStock();
  const create = useCreateOfflineOrder();
  const perfumes: Perfume[] = stock.data?.items ?? [];
  // One id per form: a double-click or retry creates one order.
  const [saved, setSaved] = useState<OrderDetail | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [saleDate, setSaleDate] = useState(today);
  // India is the usual case. A UK sale only records the rupee amount: no stock change, no price limit, no delivery.
  const [region, setRegion] = useState<SellingRegion>('india');
  const uk = region === 'uk';
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [delivery, setDelivery] = useState(false);
  const [address, setAddress] = useState({ addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState<OfflineMethod>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const update = (key: string, patch: Partial<Row>) => setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const perfumeOf = (row: Row) => perfumes.find((p) => String(p.id) === row.perfumeId);
  const variantOf = (row: Row) => perfumeOf(row)?.variants.find((v) => String(v.id) === row.variantId);
  const lineTotal = (row: Row) => {
    const price = parseRupees(row.price);
    return price && !Number.isNaN(price) && /^\d+$/.test(row.quantity) ? price * Number(row.quantity) : 0;
  };
  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0);
  const lineCost = (row: Row) => {
    const cost = parseRupees(row.cost);
    return cost != null && !Number.isNaN(cost) && /^\d+$/.test(row.quantity) ? cost * Number(row.quantity) : 0;
  };
  const totalCost = rows.reduce((sum, row) => sum + lineCost(row), 0);

  function changeRegion(next: SellingRegion) {
    if (next === region) return;
    setRegion(next);
    setErrors({});
    if (next === 'uk') setDelivery(false);
    // India prices come from Stock; a UK price is whatever it was sold for, so it starts empty.
    setRows((current) => current.map((row) => ({ ...row, cost: '', price: next === 'india' ? paiseToInput(variantOf(row)?.pricePaise ?? null) : '' })));
  }

  async function submit() {
    const next: Record<string, string> = {};
    rows.forEach((row, i) => {
      const variant = variantOf(row);
      if (!variant) next[`${i}.variant`] = 'Choose a perfume and size';
      const qty = Number(row.quantity);
      if (!/^\d+$/.test(row.quantity) || qty < 1) next[`${i}.quantity`] = 'Enter quantity';
      else if (!uk && variant && qty > variant.stock.available) next[`${i}.quantity`] = `Only ${variant.stock.available} available`;
      const price = parseRupees(row.price);
      if (price == null || Number.isNaN(price) || price < 100) next[`${i}.price`] = uk ? 'Enter the sold price' : 'Enter price';
      else if (!uk && variant && price > variant.mrpPaise) next[`${i}.price`] = `Max MRP ${formatPaise(variant.mrpPaise)}`;
      if (uk) {
        const cost = parseRupees(row.cost);
        if (row.cost.trim() === '' || cost == null || Number.isNaN(cost) || cost < 0) next[`${i}.cost`] = 'Enter what each bottle cost';
      }
    });
    if (new Set(rows.map((r) => r.variantId).filter(Boolean)).size !== rows.filter((r) => r.variantId).length) next.items = 'Each perfume and size can appear only once — combine the quantities';
    if (customer.name.trim().length < 2) next.name = 'Enter the customer’s name';
    if (uk) {
      if (customer.phone.trim() && !/^\+?\d{7,15}$/.test(customer.phone.replace(/[\s().-]/g, ''))) next.phone = 'Enter a valid phone number, or leave it empty';
    } else if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))) next.phone = 'Enter a 10-digit mobile number';
    if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) next.email = 'Enter a valid email';
    if (delivery && !uk) {
      if (address.addressLine1.trim().length < 5) next.addressLine1 = 'Enter house number and street';
      if (address.city.trim().length < 2) next.city = 'Enter the city';
      if (!address.state) next.state = 'Select the state';
      if (!/^[1-9]\d{5}$/.test(address.pincode)) next.pincode = 'Enter a 6-digit PIN code';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setConfirming(true);
  }

  async function save() {
    setConfirming(false);
    try {
      const order = await create.mutateAsync({
        requestId,
        region,
        saleDate,
        items: rows.map((row) => ({ variantId: Number(row.variantId), quantity: Number(row.quantity), unitPricePaise: parseRupees(row.price)!, ...(uk ? { unitCostPaise: parseRupees(row.cost)! } : {}) })),
        customer: { name: customer.name.trim(), ...(customer.phone.trim() ? { phone: customer.phone.trim() } : {}), ...(customer.email.trim() ? { email: customer.email.trim() } : {}) },
        delivery: delivery && !uk ? { required: true, ...address } : { required: false },
        payment: paid ? { status: 'paid', method, reference: reference.trim() } : { status: 'unpaid' },
        note: note.trim(),
      });
      toast(uk ? `UK sale ${order.orderNumber} saved` : `Offline order ${order.orderNumber} saved`);
      // Stay on a "saved" screen so the bill can be downloaded and handed over straight away.
      setSaved(order);
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      const mapped: Record<string, string> = {};
      for (const [key, message] of Object.entries(fieldErrors)) {
        const m = /^items\.(\d+)\.(\w+)/.exec(key);
        if (m) mapped[`${m[1]}.${m[2] === 'unitPricePaise' ? 'price' : m[2] === 'unitCostPaise' ? 'cost' : m[2] === 'quantity' ? 'quantity' : 'variant'}`] = message;
        else mapped[key.replace(/^(customer|delivery)\./, '')] = message;
      }
      if (Object.keys(mapped).length) setErrors(mapped);
      else toast(messageOf(error), 'error');
    }
  }

  if (saved) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h3 className="mt-4 text-base font-bold text-neutral-900">{saved.sellingRegion === 'uk' ? 'UK sale saved' : 'Order saved'}</h3>
        <p className="mt-1 font-mono text-sm font-bold">{saved.orderNumber}</p>
        <p className="mt-1 text-xs text-gray-500">
          {saved.customerName} · <span className="font-mono font-bold text-neutral-900">{formatPaise(saved.totalPaise)}</span> · {saved.paymentStatus === 'paid' ? 'Paid' : 'Not paid yet'}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <InvoiceButton order={saved} variant="primary" size="md" label="Download invoice (PDF)" className="w-full" />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onCreated(saved);
              onDone();
            }}
          >
            View order
          </Button>
          <Button variant="ghost" className="w-full" onClick={onDone}>
            Done
          </Button>
        </div>
        <p className="mt-4 text-[11px] text-gray-500">{saved.hasInvoice ? 'You can download the invoice again any time from the Offline Orders list.' : 'UK sales have no invoice, and godown stock was not changed.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Section title="Selling region">
        <div role="radiogroup" aria-label="Selling region" className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(['india', 'uk'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={region === value}
              onClick={() => changeRegion(value)}
              className={clsx('rounded-lg border px-3 py-2.5 text-sm font-medium', region === value ? 'border-fg bg-surface-muted text-fg' : 'border-border text-fg-muted hover:text-fg')}
            >
              {REGION_LABEL[value]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          {uk ? 'Type the amount it was sold for and what each bottle cost, in rupees. Godown stock is not changed, and no invoice or email is sent.' : 'Prices come from Stock, and the bottles are taken out of the godown when you save.'}
        </p>
      </Section>

      <Section title="Perfumes">
        <div className={clsx('mb-2 hidden gap-3 px-1 text-xs font-medium text-fg-subtle lg:grid', GRID[region])}>
          <span>Perfume</span>
          <span>Size</span>
          <span>Qty</span>
          <span>{uk ? 'Sold price each (₹)' : 'Price each (₹)'}</span>
          {uk && <span>Cost each (₹)</span>}
          <span className="text-right">Total</span>
          <span />
        </div>
        {errors.items && <p className="mb-2 text-xs text-danger">{errors.items}</p>}
        <ul className="space-y-3">
          {rows.map((row, i) => {
            const perfume = perfumeOf(row);
            const variant = variantOf(row);
            return (
              <li key={row.key} className={clsx('grid grid-cols-2 gap-3 rounded-xl border border-border p-3 lg:items-start lg:rounded-none lg:border-0 lg:p-0', GRID[region])}>
                <Cell label="Perfume" className="col-span-2 lg:col-span-1">
                  <Select aria-label="Perfume" className="w-full" value={row.perfumeId} onChange={(e) => update(row.key, { perfumeId: e.target.value, variantId: '', price: '' })}>
                    <option value="">{stock.isPending ? 'Loading…' : 'Choose perfume…'}</option>
                    {perfumes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Cell>
                <Cell label="Size" error={errors[`${i}.variant`]} className="col-span-2 sm:col-span-1">
                  <Select
                    aria-label="Size"
                    className="w-full"
                    value={row.variantId}
                    disabled={!perfume}
                    onChange={(e) => {
                      const v = perfume?.variants.find((x) => String(x.id) === e.target.value);
                      // India: prefill the selling price from Stock. UK: the sold price is typed by hand.
                      update(row.key, { variantId: e.target.value, price: v && !uk ? paiseToInput(v.pricePaise) : '' });
                    }}
                  >
                    <option value="">Size…</option>
                    {perfume?.variants.map((v) => (
                      // UK bottles are not in the godown, so its stock count doesn't apply.
                      <option key={v.id} value={v.id} disabled={!uk && v.stock.available <= 0}>
                        {uk ? `${v.sizeMl} ML` : `${v.sizeMl} ML · ${v.stock.available > 0 ? `${v.stock.available} available` : 'out of stock'}`}
                      </option>
                    ))}
                  </Select>
                </Cell>
                <Cell label="Qty" error={errors[`${i}.quantity`]}>
                  <input aria-label="Quantity" inputMode="numeric" className={`${controlClass} w-full`} value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value.replace(/\D/g, '') })} />
                </Cell>
                <Cell label={uk ? 'Sold price each (₹)' : 'Price each (₹)'} error={errors[`${i}.price`]}>
                  <input aria-label={uk ? 'Sold price each' : 'Price each'} inputMode="decimal" placeholder={uk ? 'Amount in ₹' : undefined} className={`${controlClass} w-full`} value={row.price} disabled={!variant} onChange={(e) => update(row.key, { price: e.target.value })} />
                  {variant && !uk && <p className="mt-1 text-[0.6875rem] text-fg-subtle">MRP {formatPaise(variant.mrpPaise)}</p>}
                </Cell>
                {uk && (
                  <Cell label="Cost each (₹)" error={errors[`${i}.cost`]}>
                    <input aria-label="Cost each" inputMode="decimal" placeholder="Cost in ₹" className={`${controlClass} w-full`} value={row.cost} disabled={!variant} onChange={(e) => update(row.key, { cost: e.target.value })} />
                  </Cell>
                )}
                <Cell label="Total" className="lg:text-right">
                  <p className="flex h-9 items-center text-sm font-medium tabular-nums lg:justify-end">{lineTotal(row) ? formatPaise(lineTotal(row)) : '—'}</p>
                </Cell>
                <div className="flex justify-end">
                  <Button variant="ghost" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => setRows((c) => [...c, emptyRow()])} disabled={rows.length >= 30}>
            <Plus className="size-3.5" aria-hidden />
            Add perfume
          </Button>
          <div className="text-right text-sm">
            <p>
              Order total <strong className="ml-1 text-base tabular-nums">{formatPaise(total)}</strong>
            </p>
            {uk && (
              <p className="mt-0.5 text-xs text-fg-muted tabular-nums">
                Cost {formatPaise(totalCost)} · Profit <span className={total - totalCost < 0 ? 'text-danger' : 'text-success'}>{formatPaise(total - totalCost)}</span>
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Customer">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Name" htmlFor="oc-name" error={errors.name}>
            <input id="oc-name" className={`${controlClass} w-full`} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </FormField>
          <FormField label={uk ? 'Phone (optional)' : 'Mobile number'} htmlFor="oc-phone" error={errors.phone}>
            <input id="oc-phone" inputMode="tel" className={`${controlClass} w-full`} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </FormField>
          <FormField label="Email (optional)" htmlFor="oc-email" error={errors.email} hint={uk ? 'Kept on the order. No email is sent for UK sales.' : undefined}>
            <input id="oc-email" type="email" className={`${controlClass} w-full`} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </FormField>
        </div>
        <div className={clsx('mt-4 flex items-center justify-between rounded-lg border border-border p-3', uk && 'hidden')}>
          <div>
            <p className="text-sm font-medium">Needs delivery</p>
            <p className="text-xs text-fg-muted">{delivery ? 'The order will go through packing and dispatch.' : 'Handed over to the customer now.'}</p>
          </div>
          <Switch label="Needs delivery" checked={delivery} onChange={setDelivery} />
        </div>
        {delivery && !uk && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="House / flat, street" htmlFor="oc-line1" error={errors.addressLine1}>
                <input id="oc-line1" className={`${controlClass} w-full`} value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Area, landmark (optional)" htmlFor="oc-line2">
                <input id="oc-line2" className={`${controlClass} w-full`} value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} />
              </FormField>
            </div>
            <FormField label="City" htmlFor="oc-city" error={errors.city}>
              <input id="oc-city" className={`${controlClass} w-full`} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </FormField>
            <FormField label="PIN code" htmlFor="oc-pin" error={errors.pincode}>
              <input id="oc-pin" inputMode="numeric" maxLength={6} className={`${controlClass} w-full`} value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '') })} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="State" htmlFor="oc-state" error={errors.state}>
                <Select id="oc-state" className="w-full" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>
        )}
      </Section>

      <Section title="Payment">
        <div role="radiogroup" aria-label="Payment status" className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {[
            { value: true, label: 'Paid now' },
            { value: false, label: 'Not paid yet' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={paid === option.value}
              onClick={() => setPaid(option.value)}
              className={clsx('rounded-lg border px-3 py-2.5 text-sm font-medium', paid === option.value ? 'border-fg bg-surface-muted text-fg' : 'border-border text-fg-muted hover:text-fg')}
            >
              {option.label}
            </button>
          ))}
        </div>
        {paid ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">How did they pay?</p>
              <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-2">
                {OFFLINE_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={clsx('rounded-full border px-4 py-1.5 text-sm', method === m ? 'border-fg bg-primary text-primary-fg' : 'border-border text-fg-muted hover:text-fg')}
                  >
                    {OFFLINE_METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            {method !== 'cash' && (
              <FormField label="Reference (optional)" htmlFor="oc-ref" hint={method === 'upi' ? 'UPI transaction ID, to match with your bank statement.' : 'Card slip, transfer or cheque number.'}>
                <input id="oc-ref" className={`${controlClass} w-full sm:max-w-sm`} value={reference} onChange={(e) => setReference(e.target.value)} />
              </FormField>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">You can record the payment later from the order.</p>
        )}
      </Section>

      <FormField label="Note (optional)" htmlFor="oc-note">
        <TextArea id="oc-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={uk ? 'e.g. Sold at the London market' : 'e.g. Sold at the Kochi pop-up'} />
      </FormField>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          Sale date
          <DatePicker label="Sale date" max={today()} className="w-full sm:w-60" value={saleDate} onChange={setSaleDate} />
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {uk ? 'Save UK sale' : 'Save order'} · {formatPaise(total)}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={uk ? 'Save this UK sale?' : 'Save this offline order?'}
        tone="primary"
        confirmLabel={uk ? 'Yes, save UK sale' : 'Yes, save order'}
        loading={create.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save()}
        message={
          <>
            <ul className="space-y-1 text-fg">
              {rows.map((row) => (
                <li key={row.key} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {perfumeOf(row)?.name} · {variantOf(row)?.sizeMl} ml × {row.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPaise(lineTotal(row))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-border pt-2 font-medium text-fg">
              {customer.name.trim()} · {formatPaise(total)} · {paid ? `paid by ${OFFLINE_METHOD_LABEL[method]}` : 'not paid yet'}
            </p>
            <p className="mt-3">
              {uk ? `Cost ${formatPaise(totalCost)}, profit ${formatPaise(total - totalCost)}. Godown stock is not changed.` : 'The bottles are taken out of godown stock straight away.'}
              {paid ? ` The money is added to ${method === 'cash' ? 'Cash in hand' : 'the bank account that receives offline money'}.` : ''} Once saved, the order can be cancelled but not edited.
            </p>
          </>
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Cell({ label, error, className, children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium text-fg-subtle lg:hidden">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
