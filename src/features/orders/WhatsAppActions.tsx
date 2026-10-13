import { Copy, MessageCircle } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';
import { useNoteWhatsApp, type OrderDetail, type WhatsAppMessage } from './api';

/*
 * "Send to the customer on WhatsApp": one tap opens WhatsApp on the customer's
 * chat with the message already written (invoice link, or dispatch details);
 * staff press send there. "Copy" is for a laptop where WhatsApp Web is already
 * open in another tab. Each use is noted in the order's timeline.
 */

/**
 * Copies text to the clipboard. Tries the modern way first; if the browser
 * refuses (older browsers, some embedded views), falls back to selecting a
 * hidden text box. The box is placed next to the button because the order
 * panel is a modal: nothing outside it can take focus.
 */
async function copyText(text: string, near: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    (near.parentElement ?? document.body).appendChild(box);
    box.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    box.remove();
    near.focus();
    return copied;
  }
}

type Kind = 'invoice' | 'dispatch';
const LABEL: Record<Kind, { title: string; hint: string; marker: string }> = {
  invoice: { title: 'Send invoice', hint: 'Thanks the customer and gives them a private link to their invoice.', marker: 'whatsapp_invoice' },
  dispatch: { title: 'Send dispatch update', hint: 'Courier, tracking number and when to expect it.', marker: 'whatsapp_dispatch' },
};

function Row({ order, kind, message }: { order: OrderDetail; kind: Kind; message: WhatsAppMessage }) {
  const note = useNoteWhatsApp(order.id);
  const { title, hint, marker } = LABEL[kind];
  const last = [...order.history].reverse().find((entry) => entry.toStatus === marker);

  async function copy(button: HTMLElement) {
    if (await copyText(message.text, button)) {
      toast(`Message copied. Paste it into the chat with ${order.phone}.`);
      note.mutate({ kind, via: 'copy' });
    } else {
      toast('Couldn’t copy the message. Use the WhatsApp button instead.', 'error');
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-fg-muted">{hint}</p>
        {last && (
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            Already prepared {formatDateTime(last.createdAt)}
            {last.actor && ` by ${last.actor}`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {/* A real link, so phones hand it to the WhatsApp app and browsers never treat it as a pop-up. */}
        <a
          href={message.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => note.mutate({ kind, via: 'whatsapp' })}
          className={buttonClasses({ size: 'sm', className: 'bg-[#128c7e] hover:bg-[#0e7469]' })}
        >
          <MessageCircle className="size-3.5" aria-hidden />
          WhatsApp
        </a>
        <button type="button" onClick={(event) => void copy(event.currentTarget)} className={buttonClasses({ variant: 'secondary', size: 'sm' })} aria-label={`Copy the ${kind === 'invoice' ? 'invoice' : 'dispatch'} message`}>
          <Copy className="size-3.5" aria-hidden />
          Copy
        </button>
      </div>
    </li>
  );
}

export function WhatsAppActions({ order }: { order: OrderDetail }) {
  const messages = order.whatsapp;
  if (!messages || (!messages.invoice && !messages.dispatch)) return null;
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="size-4 text-[#128c7e]" aria-hidden />
        Message the customer on WhatsApp
      </h3>
      <p className="mb-3 text-xs text-fg-muted">Opens WhatsApp with the message ready. Press send there.</p>
      <ul className="divide-y divide-border">
        {messages.invoice && <Row order={order} kind="invoice" message={messages.invoice} />}
        {messages.dispatch && <Row order={order} kind="dispatch" message={messages.dispatch} />}
      </ul>
    </section>
  );
}
