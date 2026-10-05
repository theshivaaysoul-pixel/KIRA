'use client';
// src/components/motion/ScrollReveal.tsx
// Scroll-triggered subtle progressive reveal:
// - Uses native IntersectionObserver (zero scroll event listeners)
// - Fades in and slides up by 10-12px once entering viewport
// - Supports stagger delay for grids & lists
// - Disconnects immediately after revealing to save CPU
// - Disabled when prefers-reduced-motion is active

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMotion } from './MotionProvider';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number; // delay in milliseconds (e.g. 50, 100, 150)
  className?: string;
  threshold?: number;
}

export function ScrollReveal({
  children,
  delay = 0,
  className = '',
  threshold = 0.08,
}: ScrollRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotion();

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion, threshold]);

  if (reducedMotion) {
    return <div className={`w-full min-w-0 ${className}`}>{children}</div>;
  }

  return (
    <div
      ref={elementRef}
      className={`w-full min-w-0 transition-all duration-400 ease-out ${
        revealed
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3 pointer-events-none'
      } ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}
