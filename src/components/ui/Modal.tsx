import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Centred dialog for wider forms; full-screen on phones. */
export function Modal({ open, onClose, title, description, children, footer, size = 'lg' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={(event) => event.target === event.currentTarget && onClose()}
      aria-label={title}
      className={`m-0 h-dvh max-h-none w-full max-w-none overflow-clip bg-surface p-0 text-fg backdrop:bg-black/40 sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-border sm:shadow-pop ${size === 'md' ? 'sm:w-[min(30rem,calc(100vw-3rem))]' : 'sm:w-[min(64rem,calc(100vw-3rem))]'}`}
    >
      {open && (
        <div className="flex h-full flex-col sm:max-h-[calc(90dvh-2px)]">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-neutral-900">{title}</h2>
              {description && <p className="mt-0.5 text-xs font-medium text-gray-500">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {/* The only scrolling area: the title and footer stay put. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
