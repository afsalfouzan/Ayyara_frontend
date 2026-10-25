import { Mail, Pencil, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { controlClass, FormField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/session';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useEmailInvoice, useUpdateUkContact, type OrderDetail, type UkSending } from './api';
import { joinWhatsAppNumber, splitWhatsAppNumber, whatsAppNumberError } from './whatsappNumber';
import { WhatsAppNumberInput } from './WhatsAppNumberInput';

/*
 * UK sales send nothing by themselves. From here staff email the invoice (each
 * press sends again; the last send is shown so nobody sends twice by mistake)
 * and add or correct the customer's WhatsApp number and email. The WhatsApp
 * button itself is the usual one above this box.
 */

export function UkInvoiceActions({ order }: { order: OrderDetail }) {
  const { can } = useSession();
  const uk = order.uk;
  const [editing, setEditing] = useState(false);
  if (!uk || order.status !== 'confirmed') return null;
  const canAct = can('orders.create_offline');
  const nothingToSendTo = !order.phone && !order.email;

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      {/* On narrow screens the button drops below the heading instead of squeezing both onto two lines. */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
          <Mail className="size-4 shrink-0 text-fg-muted" aria-hidden />
          Send the invoice
        </h3>
        {canAct && uk.canEditContact && (
          <Button variant="ghost" size="sm" className="-ml-2 shrink-0 whitespace-nowrap sm:ml-0" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
            {nothingToSendTo ? 'Add WhatsApp / email' : 'Edit contact'}
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-fg-muted">Nothing is sent to UK customers by itself. Use WhatsApp or email when you’re ready.</p>

      {uk.phoneNeedsCountryCode && (
        <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The saved number ({order.phone}) has no country code, so WhatsApp can’t open the right chat. Edit the contact to fix it.
        </p>
      )}

      {order.email ? (
        <EmailRow order={order} uk={uk} canSend={canAct && uk.canEmailInvoice} />
      ) : (
        <p className="text-xs text-fg-muted">{nothingToSendTo ? 'No WhatsApp number or email on this sale yet.' : 'No email on this sale.'}</p>
      )}

      <ContactDialog order={order} open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

function EmailRow({ order, uk, canSend }: { order: OrderDetail; uk: UkSending; canSend: boolean }) {
  const send = useEmailInvoice(order.id);
  const [latest] = uk.invoiceEmails;
  const lastBy = [...order.history].reverse().find((entry) => entry.toStatus === 'email_invoice')?.actor;

  async function sendNow() {
    try {
      await send.mutateAsync();
      toast(`Invoice is being emailed to ${order.email}`);
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">Send invoice by email</p>
        <p className="truncate text-xs text-fg-muted">To {order.email}, with the invoice PDF attached.</p>
        {latest && (
          <p className={`mt-1 text-[11px] font-medium ${latest.status === 'failed' ? 'text-danger' : latest.status === 'sent' ? 'text-emerald-700' : 'text-fg-muted'}`}>
            {latest.status === 'sent'
              ? `Already sent ${formatDateTime(latest.sentAt ?? latest.createdAt)}${lastBy ? ` by ${lastBy}` : ''}`
              : latest.status === 'queued'
                ? 'Sending…'
                : `Couldn’t send${latest.error ? `: ${latest.error}` : ''}`}
            {uk.invoiceEmails.length > 1 && ` · sent ${uk.invoiceEmails.length} times`}
          </p>
        )}
      </div>
      {canSend && (
        <Button variant="secondary" size="sm" className="shrink-0" loading={send.isPending} onClick={() => void sendNow()}>
          <Mail className="size-3.5" aria-hidden />
          {latest ? 'Send again' : 'Send email'}
        </Button>
      )}
    </div>
  );
}

function ContactDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  return (
    <Modal size="md" open={open} onClose={onClose} title="Customer’s WhatsApp and email" description="Used to send this sale’s invoice. Saving sends nothing.">
      {open && <ContactForm order={order} onClose={onClose} />}
    </Modal>
  );
}

function ContactForm({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const save = useUpdateUkContact(order.id);
  const [phone, setPhone] = useState(() => splitWhatsAppNumber(order.phone));
  const [email, setEmail] = useState(order.email ?? '');
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = { phone: whatsAppNumberError(phone) ?? undefined, email: email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Enter a valid email' : undefined };
    setErrors(next);
    if (next.phone || next.email) return;
    try {
      await save.mutateAsync({ phone: joinWhatsAppNumber(phone), email: email.trim() });
      toast('Contact details saved');
      onClose();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (fields.phone || fields.email) setErrors({ phone: fields.phone, email: fields.email });
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="WhatsApp number (optional)" htmlFor="uk-contact-phone" error={errors.phone}>
        <WhatsAppNumberInput id="uk-contact-phone" value={phone} onChange={setPhone} />
      </FormField>
      <FormField label="Email (optional)" htmlFor="uk-contact-email" error={errors.email}>
        <input id="uk-contact-email" type="email" className={`${controlClass} w-full`} value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
