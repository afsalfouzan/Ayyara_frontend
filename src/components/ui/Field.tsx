import { clsx } from 'clsx';
import type { ComponentPropsWithoutRef } from 'react';

type InputFieldProps = ComponentPropsWithoutRef<'input'> & { id: string; label: string; error?: string };

export function InputField({ id, label, error, className, ...input }: InputFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={clsx(
          'block h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg shadow-panel transition-colors placeholder:text-fg-subtle focus:border-fg focus:outline-none',
          error ? 'border-danger' : 'border-border-strong',
        )}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
