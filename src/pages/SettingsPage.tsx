import { CreditCard, Lock } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useSession } from '@/features/auth/session';
import { useRazorpaySettings } from '@/features/settings/razorpay';
import { RazorpayDialog } from '@/features/settings/RazorpayDialog';

export default function SettingsPage() {
  const { user } = useSession();
  const isOwner = Boolean(user?.isOwner);
  const razorpay = useRazorpaySettings(isOwner);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Store configuration." />
      <Panel>
        <PanelHeader title="Online payments" description="Razorpay account used for checkout and refunds." />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface-muted">
            <CreditCard className="size-5 text-fg-muted" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Razorpay</p>
            {isOwner ? (
              razorpay.data ? (
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                  {razorpay.data.connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
                  {razorpay.data.mode && <Badge tone={razorpay.data.mode === 'live' ? 'success' : 'info'}>{razorpay.data.mode === 'live' ? 'Live' : 'Test'} mode</Badge>}
                  {razorpay.data.keyId && <span className="font-mono text-xs">{razorpay.data.keyId}</span>}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-fg-muted">Loading…</p>
              )
            ) : (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-muted">
                <Lock className="size-3.5" aria-hidden />
                Only the owner can view or change payment credentials.
              </p>
            )}
          </div>
          {isOwner && (
            <Button variant={razorpay.data?.connected ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
              {razorpay.data?.connected ? 'View / change' : 'Connect Razorpay'}
            </Button>
          )}
        </div>
      </Panel>
      <p className="text-sm text-fg-subtle">Store details, low-stock defaults and email senders will be added here.</p>
      <RazorpayDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
