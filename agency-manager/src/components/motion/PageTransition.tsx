'use client';
// src/components/motion/PageTransition.tsx
// Seamless, ultra-snappy page navigation transition:
// - Opacity (0 -> 1) and subtle vertical offset (6px -> 0px)
// - Fast (220ms) — never delays user navigation
// - Uses CSS keyframes to eliminate JavaScript layout recomputations
// - Respects prefers-reduced-motion

import { usePathname } from 'next/navigation';
import { useMotion } from './MotionProvider';
import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const pathname = usePathname();
  const { reducedMotion } = useMotion();

  if (reducedMotion) {
    return <div className={`w-full min-w-0 ${className}`}>{children}</div>;
  }

  return (
    <div
      key={pathname}
      className={`w-full min-w-0 animate-page-enter ${className}`}
    >
      {children}
    </div>
  );
}
