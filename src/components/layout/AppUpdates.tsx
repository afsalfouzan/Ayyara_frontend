import { Download, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/Button';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** Offers "Install app" in the header when the browser allows it. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  if (!prompt) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      <Download className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}

/** Tells staff when a new version is ready; they choose when to reload. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour for long-open tabs.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:justify-end">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-sm shadow-pop">
        <RefreshCw className="size-4 shrink-0 text-info" aria-hidden />
        <p className="flex-1">A new version of the admin is ready.</p>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
        <button type="button" onClick={() => setNeedRefresh(false)} aria-label="Later" className="text-fg-subtle hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
