// src/components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  hover = false,
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'card',
        hover ? 'card-hover' : '',
        paddingClasses[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between mb-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`font-semibold text-sm text-[rgb(var(--text-primary))] ${className}`}
    >
      {children}
    </h3>
  );
}
