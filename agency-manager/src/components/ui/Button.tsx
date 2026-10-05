// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-violet-600 hover:bg-violet-700 text-white border-transparent shadow-sm',
  secondary:
    'bg-[rgb(var(--bg-subtle))] hover:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] border-[rgb(var(--border))]',
  ghost:
    'bg-transparent hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border-transparent',
  danger:
    'bg-red-500 hover:bg-red-600 text-white border-transparent shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs gap-2 min-h-[38px]',
  md: 'px-5 py-2.5 text-sm gap-2.5 min-h-[44px]',
  lg: 'px-6 py-3 text-base gap-3 min-h-[48px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'group inline-flex items-center justify-center font-medium rounded-full border',
        'transition-all duration-200 cursor-pointer select-none active:scale-95 hover:-translate-y-0.5',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin shrink-0 relative z-[2]" />
      ) : (
        icon && <span className="shrink-0 transition-transform duration-200 group-hover:scale-105 relative z-[2]">{icon}</span>
      )}
      <span className="relative z-[2] inline-flex items-center gap-inherit">{children}</span>
    </button>
  );
}
