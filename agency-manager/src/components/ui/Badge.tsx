// src/components/ui/Badge.tsx
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))]',
  success:  'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  error:    'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  warning:  'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  info:     'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  purple:   'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
