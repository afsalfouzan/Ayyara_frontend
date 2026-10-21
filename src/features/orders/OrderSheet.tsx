import { clsx } from 'clsx';
import { CreditCard, Lock, MapPin, PackageCheck, RefreshCw, RotateCcw, Truck, Wallet, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, TextArea } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/DataState';
import { Modal } from '@/components/ui/Modal';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import { methodLabel, PAYMENT_STATUS_LABEL, REFUND_STATUS_LABEL, STOCK_ACTION_LABEL, useCreateRefund, useSyncRefund } from '@/features/payments/api';
import { paiseToInput, parseRupees } from '@/lib/money';
import { OFFLINE_METHOD_LABEL, OFFLINE_METHODS, useCancelOfflineOrder, useCancelOrder, useCancelRefundedOrder, useOrder, useRecordOfflinePayment, useSetCourierCharge, useUpdateFulfilment, type CourierPaidFrom, type OfflineMethod, type OrderDetail } from './api';
import { InvoiceButton } from './invoice';
import { WhatsAppActions } from './WhatsAppActions';
import { FULFILMENT_LABEL, HISTORY_LABEL, OrderStateBadge, PAYMENT_LABEL } from './labels';

export function OrderSheet({ orderId, onClose }: { orderId: number | null; onClose: () => void }) {
  const order = useOrder(orderId);
  return (
    <Sheet open={orderId != null} onClose={onClose} title={order.data ? `Order ${order.data.orderNumber}` : 'Order'} description={order.data ? `Placed ${formatDateTime(order.data.createdAt)}` : undefined}>
      {order.isPending ? (
        <div className="h-96 animate-pulse rounded-lg bg-surface-muted" />
      ) : order.error ? (
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      ) : (
        <OrderBody order={order.data} />
      )}
    </Sheet>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  const { can } = useSession();
  const canUpdate = can('orders.update_fulfilment');
  const offline = order.channel === 'offline';
  const uk = order.sellingRegion === 'uk';
  // Offline orders are cancelled / paid by staff who can create them; online cancellations by fulfilment staff.
  const canCancelHere = order.canCancel && (offline ? can('orders.create_offline') : canUpdate);
  const canRecordPayment = order.canRecordPayment && can('orders.create_offline');
  const showSteps = canUpdate && order.nextFulfilmentSteps.length > 0;
  const canCancelRefunded = order.canCancelRefunded && canUpdate;
  const [cancelling, setCancelling] = useState(false);
  const [cancellingRefunded, setCancellingRefunded] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const fulfil = useUpdateFulfilment(order.id);
  // Fulfilment only moves forward, so each step is confirmed first.
  const [confirmStep, setConfirmStep] = useState<string | null>(null);

  async function step(status: string) {
    setConfirmStep(null);
    try {
      await fulfil.mutateAsync({ status });
      toast(`Marked as ${FULFILMENT_LABEL[status as keyof typeof FULFILMENT_LABEL].toLowerCase()}`);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-2">
        {offline && <Badge tone="info">{uk ? 'UK sale' : 'Offline order'}</Badge>}
        <OrderStateBadge order={order} />
        {/* The state badge already says paid / awaiting payment; only add refund information. */}
        {(order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded') && !order.canCancelRefunded && <Badge tone="warning">{PAYMENT_LABEL[order.paymentStatus]}</Badge>}
        <InvoiceButton order={order} label="Download invoice" className="ml-auto" />
      </div>

      <WhatsAppActions order={order} />

      {uk && <p className="rounded-lg bg-info-bg px-3 py-2.5 text-xs text-info">Sold in the UK. This records the money only: godown stock was not changed, and no invoice or email goes to the customer.</p>}

      {order.status === 'pending_payment' && order.reservationExpiresAt && (
        <p className="rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning">
          Stock is reserved until {formatDateTime(order.reservationExpiresAt)}. If payment isn’t received by then, the order expires and the stock is released automatically.
        </p>
      )}

      {canCancelRefunded && (
        <section className="space-y-2 rounded-xl border border-warning/40 bg-warning-bg p-3">
          <p className="text-sm text-warning">The money was refunded in full and nothing was sent, but the order is still open and its bottles are still counted as sold.</p>
          <Button variant="secondary" onClick={() => setCancellingRefunded(true)}>
            <XCircle className="size-4" aria-hidden />
            Cancel order and put bottles back in stock
          </Button>
        </section>
      )}

      {(showSteps || canCancelHere || canRecordPayment) && (
        <section className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-muted p-3">
          {canRecordPayment && (
            <Button onClick={() => setRecordingPayment(true)}>
              <Wallet className="size-4" aria-hidden />
              Record payment
            </Button>
          )}
          {showSteps && order.nextFulfilmentSteps.map((next) =>
            next === 'dispatched' ? (
              <Button key={next} onClick={() => setDispatching(true)}>
                <Truck className="size-4" aria-hidden />
                Mark dispatched
              </Button>
            ) : (
              <Button key={next} variant={next === 'packed' ? 'primary' : 'secondary'} loading={fulfil.isPending && fulfil.variables?.status === next} onClick={() => setConfirmStep(next)}>
                <PackageCheck className="size-4" aria-hidden />
                Mark {FULFILMENT_LABEL[next].toLowerCase()}
              </Button>
            ),
          )}
          {canCancelHere && (
            <Button variant="ghost" onClick={() => setCancelling(true)}>
              <XCircle className="size-4" aria-hidden />
              Cancel order
            </Button>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Items</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
              <span>
                {item.productName} · {item.sizeMl} ML <span className="text-fg-muted">× {item.quantity}</span>
                {item.unitCostPaise != null && <span className="block text-xs text-fg-muted">Cost {formatPaise(item.unitCostPaise)} each</span>}
              </span>
              <span className="tabular-nums">{formatPaise(item.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-fg-muted">
            <dt>Delivery</dt>
            <dd>{order.shippingPaise ? formatPaise(order.shippingPaise) : 'Free'}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPaise(order.totalPaise)}</dd>
          </div>
          {/* UK sales carry the cost entered with them; shown to staff who may see costs. */}
          {order.items.some((item) => item.unitCostPaise != null) && (() => {
            const cost = order.items.reduce((sum, item) => sum + (item.unitCostPaise ?? 0) * item.quantity, 0);
            return (
              <>
                <div className="flex justify-between text-fg-muted">
                  <dt>Cost of bottles</dt>
                  <dd className="tabular-nums">{formatPaise(cost)}</dd>
                </div>
                <div className="flex justify-between font-medium">
                  <dt>Profit on this sale</dt>
                  <dd className={clsx('tabular-nums', order.totalPaise - cost < 0 ? 'text-danger' : 'text-success')}>{formatPaise(order.totalPaise - cost)}</dd>
                </div>
              </>
            );
          })()}
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Customer</h3>
          <p className="text-sm">{order.customerName}</p>
          {order.email && <p className="text-sm text-fg-muted">{order.email}</p>}
          <p className="text-sm text-fg-muted">{order.phone}</p>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-3.5" aria-hidden />
            Delivery
          </h3>
          {offline && !order.deliveryRequired ? (
            <p className="text-sm text-fg-muted">Handed over to the customer in person.</p>
          ) : order.piiHidden ? (
            <p className="flex items-start gap-1.5 text-sm text-fg-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {order.shipping.city}, {order.shipping.state} {order.shipping.pincode}. Full address needs the “view personal data” permission.
            </p>
          ) : (
            <p className="text-sm leading-relaxed">
              {order.shipping.name}
              <br />
              {order.shipping.line1}
              {order.shipping.line2 && (
                <>
                  <br />
                  {order.shipping.line2}
                </>
              )}
              <br />
              {order.shipping.city}, {order.shipping.state} {order.shipping.pincode}
            </p>
          )}
        </div>
      </section>

      {order.customerNotes && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Customer note</h3>
          <p className="rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-line">{order.customerNotes}</p>
        </section>
      )}

      {order.trackingNumber && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Shipment</h3>
          <p className="text-sm">
            {order.courier} · <span className="font-mono">{order.trackingNumber}</span>
          </p>
          <CourierCharge order={order} />
        </section>
      )}

      <PaymentsAndRefunds order={order} />

      <section>
        <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
        <ol className="space-y-3 border-l border-border pl-4">
          {[...order.history].reverse().map((entry) => (
            <li key={entry.id} className="relative">
              <span className={clsx('absolute top-1.5 -left-[1.3rem] size-2 rounded-full', entry.toStatus === 'cancelled' || entry.toStatus === 'expired' ? 'bg-fg-subtle' : 'bg-brand')} aria-hidden />
              <p className="text-sm font-medium">{HISTORY_LABEL[entry.toStatus] ?? entry.toStatus}</p>
              <p className="text-xs text-fg-muted">
                {formatDateTime(entry.createdAt)}
                {entry.actor && ` · ${entry.actor}`}
              </p>
              {entry.note && <p className="mt-0.5 text-xs text-fg-muted">{entry.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      <CancelDialog order={order} open={cancelling} onClose={() => setCancelling(false)} />
      <CancelRefundedDialog order={order} open={cancellingRefunded} onClose={() => setCancellingRefunded(false)} />
      <RecordPaymentDialog order={order} open={recordingPayment} onClose={() => setRecordingPayment(false)} />
      <DispatchDialog order={order} open={dispatching} onClose={() => setDispatching(false)} />
      <ConfirmDialog
        open={confirmStep !== null}
        title={confirmStep ? `Mark ${order.orderNumber} as ${FULFILMENT_LABEL[confirmStep as keyof typeof FULFILMENT_LABEL].toLowerCase()}?` : ''}
        tone="primary"
        confirmLabel="Yes, update order"
        loading={fulfil.isPending}
        onCancel={() => setConfirmStep(null)}
        onConfirm={() => confirmStep && void step(confirmStep)}
        message={
          confirmStep === 'delivered'
            ? `This can’t be undone.${uk ? '' : ' If we have the customer’s email address, they are emailed that it was delivered (unless that email is turned off in Notifications).'}`
            : 'This can’t be undone: an order’s progress only moves forward.'
        }
      />
    </div>
  );
}

/** Closes an order that was refunded in full before anything was sent, and puts its bottles back. No money moves. */
function CancelRefundedDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const cancel = useCancelRefundedOrder(order.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (reason.trim().length < 3) return setError('Give a reason');
    try {
      await cancel.mutateAsync({ reason: reason.trim() });
      toast(`Order ${order.orderNumber} cancelled; bottles back in stock`);
      onClose();
    } catch (err) {
      setError(fieldErrorsOf(err).reason ?? messageOf(err));
    }
  }

  return (
    <Modal size="md" open={open} onClose={onClose} title={`Cancel ${order.orderNumber}?`} description="The customer already has their money back. This closes the order and puts its bottles back in stock. No money moves. This can’t be undone.">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Reason" htmlFor="cancel-refunded-reason" error={error}>
          <TextArea id="cancel-refunded-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button type="submit" variant="danger" loading={cancel.isPending}>
            Cancel and restock
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CancelDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const cancelOnline = useCancelOrder(order.id);
  const cancelOffline = useCancelOfflineOrder(order.id);
  const offline = order.channel === 'offline';
  const uk = order.sellingRegion === 'uk';
  const cancel = offline ? cancelOffline : cancelOnline;
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (reason.trim().length < 3) return setError('Give a reason');
    try {
      await cancel.mutateAsync({ reason: reason.trim() });
      toast(uk ? `UK sale ${order.orderNumber} cancelled${order.paymentStatus === 'paid' ? ' and refund recorded' : ''}` : offline ? `Order ${order.orderNumber} cancelled; bottles back in stock${order.paymentStatus === 'paid' ? ' and refund recorded' : ''}` : `Order ${order.orderNumber} cancelled and stock released`);
      onClose();
    } catch (err) {
      setError(fieldErrorsOf(err).reason ?? messageOf(err));
    }
  }

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      title={`Cancel ${order.orderNumber}?`}
      description={
        offline
          ? `${uk ? 'Godown stock is not changed.' : 'The bottles go back into stock.'}${order.paymentStatus === 'paid' ? ' A refund is recorded — return the money to the customer yourself (cash, UPI, etc.).' : ''} This can’t be undone.`
          : 'The reserved stock goes back on sale. This can’t be undone.'
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Reason" htmlFor="cancel-reason" error={error}>
          <TextArea id="cancel-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button type="submit" variant="danger" loading={cancel.isPending}>
            Cancel order
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DispatchDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const fulfil = useUpdateFulfilment(order.id);
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [charge, setCharge] = useState('');
  const [paidFrom, setPaidFrom] = useState<CourierPaidFrom | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const chargePaise = charge.trim() ? parseRupees(charge) : null;
  const hasCharge = chargePaise != null && !Number.isNaN(chargePaise) && chargePaise > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next: Record<string, string> = {};
    if (!courier.trim()) next.courier = 'Enter the courier';
    if (!tracking.trim()) next.tracking = 'Enter the tracking number';
    if (chargePaise != null && (Number.isNaN(chargePaise) || chargePaise < 0)) next.charge = 'Enter an amount';
    if (hasCharge && !paidFrom) next.paidFrom = 'Choose where the courier was paid from';
    setErrors(next);
    if (Object.keys(next).length) return;
    setConfirming(true);
  }

  async function dispatch() {
    setConfirming(false);
    try {
      await fulfil.mutateAsync({ status: 'dispatched', courier: courier.trim(), trackingNumber: tracking.trim(), ...(chargePaise != null ? { courierChargePaise: chargePaise } : {}), ...(hasCharge && paidFrom ? { courierPaidFrom: paidFrom } : {}) });
      toast(`Order ${order.orderNumber} dispatched`);
      onClose();
    } catch (err) {
      // "Not enough cash" and "no bank set" belong next to the Paid from choice.
      const paidFromError = fieldErrorsOf(err).courierPaidFrom ?? (/cash in hand is only/i.test(messageOf(err)) ? messageOf(err) : undefined);
      if (paidFromError) setErrors((current) => ({ ...current, paidFrom: paidFromError }));
      else toast(messageOf(err), 'error');
    }
  }

  return (
    <Modal size="md" open={open} onClose={onClose} title="Mark dispatched" description={order.orderNumber}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Courier" htmlFor="courier" error={errors.courier}>
          <input id="courier" list="couriers" className={`${controlClass} w-full`} value={courier} onChange={(e) => setCourier(e.target.value)} autoFocus />
          <datalist id="couriers">
            {['Delhivery', 'Blue Dart', 'DTDC', 'India Post', 'Ekart', 'Shiprocket'].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Tracking number" htmlFor="tracking" error={errors.tracking}>
          <input id="tracking" className={`${controlClass} w-full font-mono`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </FormField>
        <FormField label="Courier charge (₹)" htmlFor="courier-charge" error={errors.charge} hint="What you paid to send this parcel. The customer doesn’t see it. You can add it later if you don’t know it yet.">
          <input id="courier-charge" inputMode="decimal" placeholder="Optional" className={`${controlClass} w-full`} value={charge} onChange={(e) => setCharge(e.target.value)} />
        </FormField>
        {hasCharge && <PaidFromChoice bankName={order.courierBankName} value={paidFrom} onChange={setPaidFrom} error={errors.paidFrom} />}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={fulfil.isPending}>
            Mark dispatched
          </Button>
        </div>
        <ConfirmDialog
          open={confirming}
          title={`Dispatch ${order.orderNumber}?`}
          tone="primary"
          confirmLabel="Yes, mark dispatched"
          loading={fulfil.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void dispatch()}
          message={
            <>
              <p className="font-medium text-fg">
                {courier.trim()} · tracking <span className="font-mono">{tracking.trim()}</span>
              </p>
              {hasCharge && paidFrom && (
                <p className="mt-1">
                  Courier charge {formatPaise(chargePaise!)}, paid from {paidFrom === 'cash' ? 'Cash in hand' : order.courierBankName}.
                </p>
              )}
              <p className="mt-2">Check the tracking number: if we have the customer’s email address, these details are emailed straight away (unless that email is turned off), and dispatch can’t be undone.</p>
            </>
          }
        />
      </form>
    </Modal>
  );
}

/** Required with a courier charge: the money leaves that account in Accounts. Bank is the account that receives offline payments. */
function PaidFromChoice({ bankName, value, onChange, error }: { bankName: string | null; value: CourierPaidFrom | null; onChange: (next: CourierPaidFrom) => void; error?: string }) {
  const options: { key: CourierPaidFrom; label: string; disabled: boolean }[] = [
    { key: 'bank', label: bankName ? `Bank · ${bankName}` : 'Bank', disabled: !bankName },
    { key: 'cash', label: 'Cash in hand', disabled: false },
  ];
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Paid from</legend>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={value === option.key}
            disabled={option.disabled}
            onClick={() => onChange(option.key)}
            className={clsx('rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50', value === option.key ? 'border-fg bg-surface-muted text-fg' : 'border-border text-fg-muted hover:text-fg')}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!bankName && <p className="mt-1.5 text-xs text-fg-muted">No bank account is set to receive offline payments. Mark one in Accounts to pay from the bank.</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

/** What the shop paid the courier, shown under the tracking details; staff who dispatch orders can add or change it. */
function CourierCharge({ order }: { order: OrderDetail }) {
  const { can } = useSession();
  const save = useSetCourierCharge(order.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [paidFrom, setPaidFrom] = useState<CourierPaidFrom | null>(null);
  const [error, setError] = useState('');
  const [paidFromError, setPaidFromError] = useState('');
  const canEdit = can('orders.update_fulfilment');
  const paise = value.trim() ? parseRupees(value) : null;
  const hasCharge = paise != null && !Number.isNaN(paise) && paise > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError('');
    setPaidFromError('');
    if (paise != null && (Number.isNaN(paise) || paise < 0)) return setError('Enter an amount');
    if (hasCharge && !paidFrom) return setPaidFromError('Choose where the courier was paid from');
    try {
      await save.mutateAsync({ courierChargePaise: paise, courierPaidFrom: hasCharge ? paidFrom : null });
      toast(paise == null ? 'Courier charge removed' : 'Courier charge saved');
      setEditing(false);
    } catch (err) {
      const message = fieldErrorsOf(err).courierPaidFrom ?? (/cash in hand is only/i.test(messageOf(err)) ? messageOf(err) : undefined);
      if (message) setPaidFromError(message);
      else setError(messageOf(err));
    }
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="mt-2 space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <input aria-label="Courier charge in rupees" inputMode="decimal" placeholder="Amount (₹)" className={`${controlClass} w-36`} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
          <Button type="submit" size="sm" loading={save.isPending}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {hasCharge && <PaidFromChoice bankName={order.courierBankName} value={paidFrom} onChange={setPaidFrom} error={paidFromError} />}
        <p className="text-xs text-fg-muted">Leave it empty to remove the charge. Accounts is corrected to match.</p>
      </form>
    );
  }
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
      <span>
        Courier charge: <span className="font-medium text-fg tabular-nums">{order.courierChargePaise != null ? formatPaise(order.courierChargePaise) : 'not entered'}</span>
        {order.courierPaidFrom && <span> · paid from {order.courierPaidFrom === 'cash' ? 'Cash in hand' : 'bank'}</span>}
      </span>
      {canEdit && (
        <button
          type="button"
          className="text-xs font-semibold text-neutral-900 underline underline-offset-2"
          onClick={() => {
            setValue(order.courierChargePaise != null ? paiseToInput(order.courierChargePaise) : '');
            setPaidFrom(order.courierPaidFrom);
            setError('');
            setPaidFromError('');
            setEditing(true);
          }}
        >
          {order.courierChargePaise != null ? 'Change' : 'Add'}
        </button>
      )}
    </p>
  );
}

function PaymentsAndRefunds({ order }: { order: OrderDetail }) {
  const { can } = useSession();
  const sync = useSyncRefund();
  const [refunding, setRefunding] = useState(false);
  // Razorpay refunds only; offline orders are refunded by cancelling them.
  const canRefund = can('refunds.create') && order.refundablePaise > 0 && order.channel === 'online';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <CreditCard className="size-3.5" aria-hidden />
          Payments &amp; refunds
        </h3>
        {canRefund && (
          <Button variant="secondary" size="sm" onClick={() => setRefunding(true)}>
            <RotateCcw className="size-3.5" aria-hidden />
            Issue refund
          </Button>
        )}
      </div>
      {order.payments.length === 0 ? (
        <p className="text-sm text-fg-muted">No payment received yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.status === 'failed' ? 'danger' : p.status === 'captured' ? 'success' : 'neutral'}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</Badge>
                  <span>{p.provider === 'offline' ? `${OFFLINE_METHOD_LABEL[p.method as OfflineMethod] ?? p.method} · offline` : methodLabel(p.method)}</span>
                </p>
                {(p.razorpayPaymentId || p.reference) && <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">{p.razorpayPaymentId ?? p.reference}</p>}
                {p.errorDescription && <p className="text-xs text-danger">{p.errorDescription}</p>}
              </div>
              <span className="tabular-nums">{formatPaise(p.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
      {order.refunds.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {order.refunds.map((r) => (
            <li key={r.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === 'processed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>Refund · {REFUND_STATUS_LABEL[r.status]}</Badge>
                  <span className="text-xs text-fg-muted">{STOCK_ACTION_LABEL[r.stockAction]}{r.automatic ? ' · automatic' : ''}</span>
                </p>
                <span className="tabular-nums">−{formatPaise(r.amountPaise)}</span>
              </div>
              <p className="mt-1 text-xs text-fg-muted">{r.reason}</p>
              <p className="text-xs text-fg-subtle">
                {formatDateTime(r.createdAt)}
                {r.razorpayRefundId && <span className="font-mono"> · {r.razorpayRefundId}</span>}
              </p>
              {r.status === 'pending' && can('refunds.create') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-2"
                  loading={sync.isPending && sync.variables === r.id}
                  onClick={() =>
                    sync.mutate(r.id, {
                      onSuccess: (data) => toast(data.refund.status === 'pending' ? 'Still processing at the bank' : `Refund ${REFUND_STATUS_LABEL[data.refund.status].toLowerCase()}`),
                      onError: (e) => toast(messageOf(e), 'error'),
                    })
                  }
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  Check status
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {order.payments.some((p) => p.status !== 'failed') && order.refundablePaise === 0 && order.refunds.length > 0 && <p className="text-xs text-fg-muted">The full amount has been refunded or is being refunded.</p>}
      <RefundDialog order={order} open={refunding} onClose={() => setRefunding(false)} />
    </section>
  );
}

function RefundDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  return (
    <Modal size="md" open={open} onClose={onClose} title={`Refund ${order.orderNumber}`} description={`Up to ${formatPaise(order.refundablePaise)} can be refunded to the customer’s original payment method.`}>
      {open && <RefundForm order={order} onDone={onClose} />}
    </Modal>
  );
}

function RefundForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const create = useCreateRefund(order.id);
  // One key per form: a double-click or retry can never send two refunds.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(paiseToInput(order.refundablePaise));
  const [reason, setReason] = useState('');
  const canCancel = order.status === 'confirmed' && ['unfulfilled', 'processing', 'packed'].includes(order.fulfilmentStatus);
  const canReturn = ['dispatched', 'delivered'].includes(order.fulfilmentStatus);
  const [stockAction, setStockAction] = useState<'none' | 'cancel_restock' | 'returned'>('none');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const options = [
    { value: 'none' as const, label: 'Refund money only', hint: 'Stock is not changed.', enabled: true },
    { value: 'cancel_restock' as const, label: 'Cancel the order and put items back in stock', hint: 'Only before dispatch. Refunds the full remaining amount.', enabled: canCancel },
    { value: 'returned' as const, label: 'Items were returned to the godown', hint: 'Adds the returned bottles back to stock.', enabled: canReturn },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const paise = parseRupees(amount);
    const next: Record<string, string> = {};
    if (paise == null || Number.isNaN(paise) || paise < 100) next.amount = 'Enter an amount of at least ₹1';
    else if (paise > order.refundablePaise) next.amount = `At most ${formatPaise(order.refundablePaise)}`;
    else if (stockAction === 'cancel_restock' && paise !== order.refundablePaise) next.amount = 'Cancelling refunds the full remaining amount';
    if (reason.trim().length < 3) next.reason = 'Give a reason';
    setErrors(next);
    if (Object.keys(next).length) return;
    setConfirming(true);
  }

  // Refunding everything as "money only" before dispatch usually means the order should have been cancelled.
  const fullMoneyOnlyBeforeDispatch = stockAction === 'none' && canCancel && parseRupees(amount) === order.refundablePaise;

  async function refundNow() {
    setConfirming(false);
    const paise = parseRupees(amount);
    try {
      const { refund } = await create.mutateAsync({ amountPaise: paise!, reason: reason.trim(), stockAction, idempotencyKey });
      toast(refund.razorpayRefundId ? `Refund of ${formatPaise(paise!)} sent to Razorpay — it will show as refunded once the bank confirms.` : 'Refund recorded but Razorpay didn’t respond. Use “Check status” in a moment.');
      onDone();
    } catch (err) {
      setErrors({ form: messageOf(err) });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Amount (₹)" htmlFor="refund-amount" error={errors.amount}>
        <input id="refund-amount" inputMode="decimal" className={`${controlClass} w-full`} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={stockAction === 'cancel_restock'} />
      </FormField>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What about the bottles?</legend>
        {fullMoneyOnlyBeforeDispatch && (
          <p className="mb-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
            You’re refunding the whole amount and this order hasn’t been dispatched. If the customer won’t receive anything, choose “Cancel the order and put items back in stock”, so the order closes and the bottles return to stock.
          </p>
        )}
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option.value} className={clsx('flex gap-3 rounded-lg border p-3 text-sm', option.enabled ? 'cursor-pointer border-border hover:bg-surface-muted' : 'cursor-not-allowed border-border opacity-50', stockAction === option.value && 'border-fg')}>
              <input
                type="radio"
                name="stockAction"
                className="mt-0.5 accent-[var(--primary)]"
                checked={stockAction === option.value}
                disabled={!option.enabled}
                onChange={() => {
                  setStockAction(option.value);
                  if (option.value === 'cancel_restock') setAmount(paiseToInput(order.refundablePaise));
                }}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="text-xs text-fg-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField label="Reason" htmlFor="refund-reason" error={errors.reason}>
        <TextArea id="refund-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      {errors.form && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={create.isPending}>
          Refund {formatPaise(parseRupees(amount) || 0)}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Refund ${formatPaise(parseRupees(amount) || 0)} to the customer?`}
        confirmLabel="Yes, refund"
        loading={create.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void refundNow()}
        message={
          <>
            <p className="font-medium text-fg">{options.find((option) => option.value === stockAction)?.label}</p>
            {fullMoneyOnlyBeforeDispatch && (
              <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-warning">
                This refunds everything but keeps the order open and the bottles counted as sold. If nothing will be sent, go back and choose “Cancel the order and put items back in stock”.
              </p>
            )}
            <p className="mt-2">The money is sent back through Razorpay straight away. A refund can’t be stopped or undone once sent.</p>
          </>
        }
      />
    </form>
  );
}

function RecordPaymentDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const record = useRecordOfflinePayment(order.id);
  const [method, setMethod] = useState<OfflineMethod>('cash');
  const [reference, setReference] = useState('');
  const [confirming, setConfirming] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setConfirming(true);
  }

  async function markPaid() {
    setConfirming(false);
    try {
      await record.mutateAsync({ method, reference: reference.trim() });
      toast(`${formatPaise(order.totalPaise)} received by ${OFFLINE_METHOD_LABEL[method]}`);
      onClose();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  }

  return (
    <Modal size="md" open={open} onClose={onClose} title="Record payment" description={`${order.orderNumber} · ${formatPaise(order.totalPaise)}`}>
      <form onSubmit={submit} className="space-y-4">
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
        {method !== 'cash' && (
          <FormField label="Reference (optional)" htmlFor="pay-ref" hint="UPI transaction ID, card slip or transfer number.">
            <input id="pay-ref" className={`${controlClass} w-full`} value={reference} onChange={(e) => setReference(e.target.value)} />
          </FormField>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={record.isPending}>
            Mark as paid
          </Button>
          <ConfirmDialog
            open={confirming}
            title={`Mark ${formatPaise(order.totalPaise)} as received by ${OFFLINE_METHOD_LABEL[method]}?`}
            tone="primary"
            confirmLabel="Yes, mark as paid"
            loading={record.isPending}
            onCancel={() => setConfirming(false)}
            onConfirm={() => void markPaid()}
            message={`${order.orderNumber} is marked paid and the money is added to ${method === 'cash' ? 'Cash in hand' : 'the bank account that receives offline money'} in Accounts.`}
          />
        </div>
      </form>
    </Modal>
  );
}
