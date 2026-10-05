// src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, leading, className = '', id, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium text-[rgb(var(--text-secondary))]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leading && (
            <span className="absolute left-3.5 text-[rgb(var(--text-muted))] flex items-center pointer-events-none z-10">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={[
              'w-full rounded-xl border py-2.5 text-sm',
              'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))]',
              'border-[rgb(var(--border))] placeholder:text-[rgb(var(--text-muted))]',
              'transition-colors duration-150',
              'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
              error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : '',
              leading ? 'pl-10 pr-3.5' : 'px-3.5',
              className,
            ].filter(Boolean).join(' ')}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && (
          <p className="text-xs text-[rgb(var(--text-muted))]">{hint}</p>
        )}
      </div>
    );
  }
);
