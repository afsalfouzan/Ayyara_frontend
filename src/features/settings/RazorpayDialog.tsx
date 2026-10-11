import { CheckCircle2, Copy, Eye, EyeOff, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/DataState';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useRazorpaySettings, useRemoveRazorpay, useSaveRazorpay, type RazorpaySettings } from './razorpay';

/** Owner-only popup to connect, view and change Razorpay credentials. */
export function RazorpayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const query = useRazorpaySettings(open);
  return (
    <Modal size="md" open={open} onClose={onClose} title="Razorpay credentials" description="Used to take online payments and issue refunds.">
      {open &&
        (query.isPending ? (
          <div className="h-64 animate-pulse rounded-lg bg-surface-muted" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <RazorpayPanel settings={query.data} onClose={onClose} />
        ))}
    </Modal>
  );
}

function RazorpayPanel({ settings, onClose }: { settings: RazorpaySettings; onClose: () => void }) {
  const [editing, setEditing] = useState(!settings.keyId && settings.editable);
  return (
    <div className="space-y-5">
      <Status settings={settings} />
      {settings.loadError && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{settings.loadError}</p>}
      {editing ? (
        <CredentialsForm settings={settings} onCancel={() => (settings.keyId ? setEditing(false) : onClose())} onSaved={() => setEditing(false)} />
      ) : (
        <>
          <CurrentValues settings={settings} />
          <WebhookHelp settings={settings} />
          {settings.editable ? (
            <Actions settings={settings} onEdit={() => setEditing(true)} onClose={onClose} />
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2.5 text-sm text-info">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              These credentials are set in the server configuration, so they can only be changed there.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Status({ settings }: { settings: RazorpaySettings }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {settings.connected ? (
        <Badge tone="success">
          <CheckCircle2 className="size-3" aria-hidden />
          Connected
        </Badge>
      ) : (
        <Badge tone="warning">Not connected</Badge>
      )}
      {settings.mode === 'test' && <Badge tone="info">Test mode — no real money</Badge>}
      {settings.mode === 'live' && <Badge tone="success">Live mode</Badge>}
      {settings.connected && !settings.webhookSecretLast4 && <Badge tone="warning">Webhook secret missing</Badge>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-sm">{children}</dd>
    </div>
  );
}

function CurrentValues({ settings }: { settings: RazorpaySettings }) {
  if (!settings.keyId) return <p className="text-sm text-fg-muted">No credentials saved yet.</p>;
  return (
    <div>
      <dl className="divide-y divide-border rounded-lg border border-border px-3">
        <Row label="Key ID">{settings.keyId}</Row>
        <Row label="Key secret">{settings.keySecretLast4 ? `••••••••${settings.keySecretLast4}` : '—'}</Row>
        <Row label="Webhook secret">{settings.webhookSecretLast4 ? `••••••••${settings.webhookSecretLast4}` : <span className="font-sans text-warning">Not set</span>}</Row>
      </dl>
      <p className="mt-2 text-xs text-fg-subtle">
        Secrets are stored encrypted and are never shown again — only their last 4 characters.
        {settings.updatedAt && ` Last changed ${formatDateTime(settings.updatedAt)}${settings.updatedBy ? ` by ${settings.updatedBy}` : ''}.`}
      </p>
    </div>
  );
}

function WebhookHelp({ settings }: { settings: RazorpaySettings }) {
  return (
    <details className="rounded-lg border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Webhook setup</summary>
      <p className="mt-2 text-fg-muted">In Razorpay → Account &amp; Settings → Webhooks, add this URL, tick the events below and use the same secret you save here.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-muted px-2 py-1.5 text-xs">{settings.webhookUrl}</code>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Copy webhook URL"
          onClick={() => void navigator.clipboard.writeText(settings.webhookUrl).then(() => toast('Webhook URL copied'))}
        >
          <Copy className="size-3.5" aria-hidden />
        </Button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">Events: {settings.webhookEvents.join(', ')}</p>
      {settings.webhookUrl.includes('localhost') && <p className="mt-1 text-xs text-warning">Razorpay can’t reach localhost. Webhooks work once the API is on its public address.</p>}
    </details>
  );
}

function Actions({ settings, onEdit, onClose }: { settings: RazorpaySettings; onEdit: () => void; onClose: () => void }) {
  const remove = useRemoveRazorpay();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      {settings.keyId ? (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onEdit}>{settings.keyId ? 'Change credentials' : 'Add credentials'}</Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Remove Razorpay credentials?"
        message="Customers won’t be able to pay online until credentials are added again. Existing payments and refunds are kept."
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false);
              toast('Razorpay disconnected');
            },
            onError: (e) => toast(messageOf(e), 'error'),
          })
        }
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function SecretInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        className={`${controlClass} min-w-0 flex-1 font-mono`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button variant="secondary" aria-label={visible ? 'Hide' : 'Show while typing'} onClick={() => setVisible((v) => !v)}>
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </Button>
    </div>
  );
}

function CredentialsForm({ settings, onCancel, onSaved }: { settings: RazorpaySettings; onCancel: () => void; onSaved: () => void }) {
  const save = useSaveRazorpay();
  const [keyId, setKeyId] = useState(settings.keyId ?? '');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [clearWebhook, setClearWebhook] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const keyChanged = keyId.trim() !== settings.keyId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next: Record<string, string> = {};
    if (!/^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.test(keyId.trim())) next.keyId = 'Starts with rzp_test_ or rzp_live_';
    if ((keyChanged || !settings.keySecretLast4) && keySecret.trim().length < 8) next.keySecret = 'Enter the key secret';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        keyId: keyId.trim(),
        ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
        ...(clearWebhook ? { webhookSecret: '' } : webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      });
      toast('Razorpay credentials verified and saved');
      onSaved();
    } catch (error) {
      const fieldErrors = fieldErrorsOf(error);
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: messageOf(error) });
    }
  }

  if (!settings.encryptionAvailable) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2.5 text-sm text-danger">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        The server has no encryption key (DATA_ENCRYPTION_KEY), so credentials can’t be stored safely yet. Ask your developer to set it.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-fg-muted">Find these in Razorpay → Account &amp; Settings → API Keys. They are checked with Razorpay before saving.</p>
      <FormField label="Key ID" htmlFor="rzp-key-id" error={errors.keyId}>
        <input id="rzp-key-id" autoComplete="off" spellCheck={false} className={`${controlClass} w-full font-mono`} value={keyId} placeholder="rzp_test_…" onChange={(e) => setKeyId(e.target.value)} />
      </FormField>
      <FormField label="Key secret" htmlFor="rzp-key-secret" error={errors.keySecret} hint={settings.keySecretLast4 && !keyChanged ? `Leave blank to keep the saved secret (••••${settings.keySecretLast4}).` : undefined}>
        <SecretInput id="rzp-key-secret" value={keySecret} onChange={setKeySecret} placeholder={settings.keySecretLast4 && !keyChanged ? 'Keep current secret' : ''} />
      </FormField>
      <FormField label="Webhook secret" htmlFor="rzp-webhook-secret" error={errors.webhookSecret} hint={settings.webhookSecretLast4 ? `Leave blank to keep the saved secret (••••${settings.webhookSecretLast4}).` : 'Optional, but recommended: confirms payments even if a customer closes the browser.'}>
        <SecretInput id="rzp-webhook-secret" value={webhookSecret} onChange={(v) => { setWebhookSecret(v); setClearWebhook(false); }} placeholder={settings.webhookSecretLast4 ? 'Keep current secret' : ''} />
      </FormField>
      {settings.webhookSecretLast4 && (
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" className="accent-[var(--primary)]" checked={clearWebhook} onChange={(e) => { setClearWebhook(e.target.checked); if (e.target.checked) setWebhookSecret(''); }} />
          Remove the webhook secret
        </label>
      )}
      {keyId.startsWith('rzp_live_') && <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">Live keys take real payments from customers.</p>}
      {errors.form && <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Verify &amp; save
        </Button>
      </div>
    </form>
  );
}
