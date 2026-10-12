import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Anchored popover built on the native Popover API: it renders in the top
 * layer (above dialogs, never clipped by scrolling containers) and closes on
 * outside click or Escape. Position is fixed to the anchor: below it when
 * there is room, above it when not, and otherwise shifted to stay on screen.
 */
export function useAnchoredPopover<A extends HTMLElement>({ gap = 6, matchWidth = false }: { gap?: number; matchWidth?: boolean } = {}) {
  const anchorRef = useRef<A>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Light dismiss fires on pointerdown, before the trigger's click; remember
  // when that happened so the same click doesn't immediately reopen it.
  const closedAt = useRef(0);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const rect = anchor.getBoundingClientRect();
    if (matchWidth) popover.style.minWidth = `${rect.width}px`;
    const { offsetWidth: width, offsetHeight: height } = popover;
    const margin = 8;
    const lowest = window.innerHeight - height - margin;
    let top = rect.bottom + gap;
    if (top > lowest) {
      const above = rect.top - gap - height;
      // No room below: go above if it fits there; otherwise slide up just far enough
      // to stay fully on screen (covering the field is better than losing the last rows).
      top = above >= margin ? above : lowest;
    }
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    popover.style.top = `${Math.max(margin, top)}px`;
    popover.style.left = `${left}px`;
  }, [gap, matchWidth]);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (!isOpen) closedAt.current = Date.now();
    };
    popover.addEventListener('toggle', onToggle);
    return () => popover.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    // Escape closes only this popover, not a dialog it sits in.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const popover = popoverRef.current;
      // Leave it to a nested popover (e.g. the month list inside the calendar) if one is open.
      if (popover?.querySelector(':popover-open')) return;
      event.preventDefault();
      event.stopPropagation();
      popover?.hidePopover();
      anchorRef.current?.focus();
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, place]);

  const show = useCallback(() => {
    const popover = popoverRef.current;
    if (!popover || popover.matches(':popover-open') || Date.now() - closedAt.current < 250) return;
    popover.showPopover();
    place();
  }, [place]);

  const hide = useCallback(() => {
    const popover = popoverRef.current;
    if (popover?.matches(':popover-open')) popover.hidePopover();
  }, []);

  const toggle = useCallback(() => (popoverRef.current?.matches(':popover-open') ? hide() : show()), [hide, show]);

  return { anchorRef, popoverRef, open, show, hide, toggle, place };
}

/** Classes that reset the UA popover box so content controls its own look. */
export const popoverReset = 'fixed m-0 overflow-visible border-0 bg-transparent p-0 [inset:auto]';
