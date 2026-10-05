// src/components/ui/Loading.tsx
import type { ReactNode } from 'react';

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

const spinnerSizes = { sm: 16, md: 24, lg: 36 };

export function Loading({ message, size = 'md', fullPage = false }: LoadingProps) {
  const px = spinnerSizes[size];

  const content = (
    <div className="flex flex-col items-center gap-3">
      <div
        className="spinner"
        style={{ width: px, height: px }}
        role="status"
        aria-label={message ?? 'Loading…'}
      />
      {message && (
        <p className="text-xs text-[rgb(var(--text-muted))]">{message}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[rgb(var(--bg-base))] z-50">
        <div className="flex flex-col items-center gap-4">
          <span className="text-lg font-bold text-violet-600 tracking-tight">✦ KIRA</span>
          {content}
        </div>
      </div>
    );
  }

  return content;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[rgb(var(--bg-subtle))] ${className}`}
    />
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      {icon && (
        <div className="text-[rgb(var(--text-muted))] text-4xl mb-1">{icon}</div>
      )}
      <h3 className="font-semibold text-[rgb(var(--text-primary))]">{title}</h3>
      {description && (
        <p className="text-sm text-[rgb(var(--text-muted))] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center text-red-500 text-xl">
        ⚠
      </div>
      <h3 className="font-semibold text-[rgb(var(--text-primary))]">{title}</h3>
      <p className="text-sm text-[rgb(var(--text-muted))] max-w-sm">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
