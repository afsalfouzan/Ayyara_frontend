import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, BellRing, CheckCircle2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { messageOf } from '@/lib/errors';

/*
 * "Alerts on this device": lets the signed-in person switch phone / laptop
 * notifications on or off for the browser or installed app they are using.
 */

type PushInfo = { enabled: boolean; publicKey: string | null; devices: { id: number; deviceLabel: string; createdAt: string; lastSentAt: string | null }[] };

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** The push services expect the server's key as raw bytes, not the base64 text it is stored as. */
function keyBytes(base64: string) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** "Chrome on Android", so the person can tell their devices apart. */
function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Browser';
  const system = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iPhone / iPad' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'this device';
  return `${browser} on ${system}`;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export function DeviceAlerts() {
  const client = useQueryClient();
  const info = useQuery({ queryKey: ['push'], queryFn: () => api<PushInfo>('/admin/push') });
  const [on, setOn] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');

  useEffect(() => {
    if (!supported) return setOn(false);
    void currentSubscription().then((subscription) => setOn(Boolean(subscription)));
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') throw new Error('Alerts are blocked for this site. Allow notifications in your browser’s site settings, then try again.');
      const registration = await navigator.serviceWorker.getRegistration();
      // The background worker only exists in a built, deployed admin (not under `npm run dev`).
      if (!registration) throw new Error('Alerts only work in the published admin. Open it from its web address or the installed app.');
      const subscribing = (async () => (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(info.data!.publicKey!) })))();
      // A browser that can't reach its push service may never answer; don't leave the button spinning.
      const subscription = await Promise.race([subscribing, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('This device couldn’t connect to its notification service. Check the internet connection and try again.')), 20_000))]);
      const json = subscription.toJSON();
      await api('/admin/push/subscriptions', { method: 'POST', body: { endpoint: subscription.endpoint, keys: json.keys, deviceLabel: deviceLabel() } });
    },
    onSuccess: () => {
      setOn(true);
      toast('Alerts are on for this device');
      void client.invalidateQueries({ queryKey: ['push'] });
    },
    onError: (error) => toast(error instanceof Error && !('status' in error) ? error.message : messageOf(error), 'error'),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription();
      if (!subscription) return;
      await api('/admin/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    },
    onSuccess: () => {
      setOn(false);
      toast('Alerts are off for this device');
      void client.invalidateQueries({ queryKey: ['push'] });
    },
    onError: (error) => toast(messageOf(error), 'error'),
  });

  const test = useMutation({
    mutationFn: () => api<{ sent: number }>('/admin/push/test', { method: 'POST' }),
    onSuccess: (result) => toast(result.sent ? 'Test alert sent. It should appear in a few seconds.' : 'No device is set up to receive alerts yet.', result.sent ? 'success' : 'error'),
    onError: (error) => toast(messageOf(error), 'error'),
  });

  const serverReady = Boolean(info.data?.enabled && info.data.publicKey);
  const otherDevices = Math.max(0, (info.data?.devices.length ?? 0) - (on ? 1 : 0));

  return (
    <div className="space-y-4 p-5 text-sm">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{on ? <BellRing className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-neutral-900">
            Alerts on this device
            {on ? (
              <Badge tone="success">
                <CheckCircle2 className="size-3" aria-hidden />
                On
              </Badge>
            ) : (
              <Badge>Off</Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Get a notification here when a website order is paid, and when a Razorpay payout reaches the bank. They arrive even when the admin is closed.</p>
        </div>
      </div>

      {!supported ? (
        <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          {isIos ? 'On iPhone and iPad, first add the admin to your Home Screen (Share → Add to Home Screen), then open it from there and come back to this page.' : 'This browser can’t show alerts. Use Chrome, Edge or Firefox, or install the admin as an app.'}
        </p>
      ) : info.data && !serverReady ? (
        <p className="rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-800">Alerts haven’t been set up on the server yet. Ask your developer to add the alert keys.</p>
      ) : permission === 'denied' && !on ? (
        <p className="rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-800">Notifications are blocked for this site. Allow them in your browser’s site settings (the padlock in the address bar), then reload this page.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {on ? (
            <>
              <Button variant="secondary" onClick={() => test.mutate()} loading={test.isPending}>
                Send a test alert
              </Button>
              <Button variant="ghost" onClick={() => disable.mutate()} loading={disable.isPending}>
                Turn off
              </Button>
            </>
          ) : (
            <Button onClick={() => enable.mutate()} loading={enable.isPending} disabled={on == null || !serverReady}>
              <BellRing className="size-4" aria-hidden />
              Turn on alerts
            </Button>
          )}
        </div>
      )}

      {otherDevices > 0 && (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Smartphone className="size-3.5" aria-hidden />
          Also on for {otherDevices} other device{otherDevices === 1 ? '' : 's'} of yours. Open the admin there to turn it off.
        </p>
      )}
    </div>
  );
}
