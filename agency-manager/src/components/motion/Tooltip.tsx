'use client';
// src/components/motion/Tooltip.tsx
// Accessible, lightweight micro-interaction tooltip for icon-only controls:
// - Keyboard accessible (focus & blur)
// - Gentle micro-delay (180ms) to avoid unwanted popping
// - Smooth fade & subtle scale (140ms)
// - Position: top | bottom | left | right

import { useState, useRef, type ReactNode } from 'react';
import { useMotion } from './MotionProvider';

interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  className?: string;
}

export function Tooltip({
  content,
  position = 'top',
  children,
  className = '',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { reducedMotion } = useMotion();

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 180);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute ${positionClasses[position]} z-50 pointer-events-none px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 dark:bg-neutral-800 border border-neutral-700/60 rounded-lg shadow-md whitespace-nowrap ${
            reducedMotion ? 'opacity-100' : 'animate-tooltip-pop'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
