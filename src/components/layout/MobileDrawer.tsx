import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BrandMark } from './BrandMark';
import { SidebarNav } from './SidebarNav';

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      onClick={(event) => event.target === event.currentTarget && onClose()}
      aria-label="Navigation"
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-border bg-surface p-0 text-fg backdrop:bg-black/40 open:animate-[drawer-in_200ms_var(--ease-out-soft)] lg:hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <BrandMark />
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted" aria-label="Close navigation">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <SidebarNav onNavigate={onClose} />
      </div>
    </dialog>
  );
}
