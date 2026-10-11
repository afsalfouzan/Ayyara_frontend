import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';

type Toast = { id: number; tone: 'success' | 'error'; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function toast(message: string, tone: Toast['tone'] = 'success') {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
}

export function Toaster() {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
      {items.map((item) => (
        <div key={item.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-3.5 text-sm shadow-pop">
          {item.tone === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
          <p className="flex-1 text-fg">{item.message}</p>
          <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss" className="text-fg-subtle hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
