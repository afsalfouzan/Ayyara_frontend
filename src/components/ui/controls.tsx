import { clsx } from 'clsx';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ChangeEvent, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode } from 'react';
import { popoverReset, useAnchoredPopover } from './Popover';

export const controlClass =
  'h-[38px] rounded-xl border border-neutral-200 bg-white px-3 text-base text-neutral-900 transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none sm:text-xs';

export function SearchInput({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <input type="search" className={clsx(controlClass, 'w-full pl-9 font-mono')} {...props} />
    </div>
  );
}

type SelectOption = { value: string; label: ReactNode; text: string; disabled: boolean };

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : ''))
    .join('');
}

/** Reads <option> children (through fragments and arrays) the way a native <select> would. */
function collectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return;
    if (child.type === Fragment || child.type === 'optgroup') options.push(...collectOptions(child.props.children));
    else if (child.type === 'option') {
      const text = textOf(child.props.children);
      options.push({ value: child.props.value != null ? String(child.props.value) : text, label: child.props.children, text, disabled: Boolean(child.props.disabled) });
    }
  });
  return options;
}

/**
 * Drop-in replacement for <select> with a styled option list. Takes the same
 * <option> children and calls onChange with `event.target.value`, so call
 * sites read exactly as they did with the native element.
 */
export function Select({ className, children, value, onChange, disabled, id, name, ...rest }: ComponentPropsWithoutRef<'select'>) {
  const options = collectOptions(children);
  const current = value != null ? String(value) : (options[0]?.value ?? '');
  const selected = options.find((o) => o.value === current);
  const { anchorRef, popoverRef, open, show, hide, toggle } = useAnchoredPopover<HTMLButtonElement>({ matchWidth: true });
  const [active, setActive] = useState(-1);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the list opens
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function choose(option: SelectOption | undefined) {
    if (!option || option.disabled) return;
    hide();
    if (option.value !== current) onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } } as unknown as ChangeEvent<HTMLSelectElement>);
  }

  function move(from: number, step: number) {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i]!.disabled) return setActive(i);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === 'ArrowDown') move(active, 1);
    else if (event.key === 'ArrowUp') move(active, -1);
    else if (event.key === 'Home') move(-1, 1);
    else if (event.key === 'End') move(options.length, -1);
    else if (event.key === 'Enter' || event.key === ' ') choose(options[active]);
    else if (event.key === 'Tab') return hide();
    else if (event.key.length === 1) {
      // Type-ahead: jump to the next option starting with that letter.
      const letter = event.key.toLowerCase();
      const start = active + 1;
      const order = [...options.slice(start), ...options.slice(0, start)];
      const hit = order.find((o) => !o.disabled && o.text.trim().toLowerCase().startsWith(letter));
      if (hit) setActive(options.indexOf(hit));
      return;
    } else return;
    event.preventDefault();
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={rest['aria-label']}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={clsx(controlClass, 'inline-flex min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400', open && 'border-neutral-900', className)}
      >
        <span className={clsx('truncate', (!selected || selected.value === '') && 'text-neutral-500')}>{selected?.label ?? '\u00a0'}</span>
        <ChevronDown className={clsx('size-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div ref={popoverRef} popover="auto" className={popoverReset}>
        <ul ref={listRef} id={listId} role="listbox" aria-label={rest['aria-label']} className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-pop">
          {options.map((option, i) => {
            const isSelected = option.value === current;
            return (
              <li
                key={`${option.value}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-active={i === active}
                onPointerEnter={() => !option.disabled && setActive(i)}
                onClick={() => choose(option)}
                className={clsx(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap',
                  option.disabled && 'cursor-not-allowed text-gray-300',
                  isSelected ? 'bg-neutral-900 font-bold text-white' : i === active ? 'bg-gray-100 text-neutral-900' : !option.disabled && 'text-neutral-700',
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="size-3.5 shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

export function FormField({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-neutral-700">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-success' : 'bg-border-strong')}
    >
      <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  );
}

export function TextArea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={clsx(controlClass, 'h-auto min-h-24 w-full py-2 leading-relaxed', className)} {...props} />;
}

/** Live character counter for length-limited fields such as SEO titles. */
export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={clsx('text-xs tabular-nums', value.length > max ? 'text-danger' : 'text-fg-subtle')}>
      {value.length}/{max}
    </span>
  );
}
