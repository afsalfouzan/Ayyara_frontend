import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={(event) => event.target === event.currentTarget && onCancel()} role="alertdialog" aria-label={title} className="m-auto h-fit w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-black/40">
      <div className="p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-fg-muted">{message}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-muted px-6 py-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
