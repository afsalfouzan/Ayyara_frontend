import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentPropsWithoutRef } from 'react';

type InputFieldProps = ComponentPropsWithoutRef<'input'> & { id: string; label: string; error?: string };

/** Labelled text field. Password fields get an eye button to show or hide what was typed. */
export function InputField({ id, label, error, className, type, ...input }: InputFieldProps) {
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={clsx(
            'block h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg shadow-panel transition-colors placeholder:text-fg-subtle focus:border-fg focus:outline-none',
            error ? 'border-danger' : 'border-border-strong',
            isPassword && 'pr-11',
          )}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
            title={visible ? 'Hide' : 'Show'}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
