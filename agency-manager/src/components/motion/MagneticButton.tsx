'use client';
// src/components/motion/MagneticButton.tsx
// Subtle magnetic pull effect for primary CTA buttons:
// - Detects cursor proximity when hovering/approaching
// - Applies a subtle, bounded offset (max 4-5px)
// - Smoothly springs back on leave
// - Disabled on touch devices and when reduced motion is preferred

import { useRef, type ReactNode, type HTMLAttributes } from 'react';
import { useMotion } from './MotionProvider';

interface MagneticButtonProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  strength?: number; // 0.1 to 0.3 (subtle pull factor)
  maxOffset?: number; // maximum pixel deflection (default 4px)
  className?: string;
  disabled?: boolean;
}

export function MagneticButton({
  children,
  strength = 0.18,
  maxOffset = 4,
  className = '',
  disabled = false,
  ...props
}: MagneticButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { reducedMotion, isTouch } = useMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || reducedMotion || isTouch || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    // Clamp to max offset
    const clampedX = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
    const clampedY = Math.max(-maxOffset, Math.min(maxOffset, deltaY));

    containerRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  };

  const handleMouseLeave = () => {
    if (disabled || reducedMotion || isTouch || !containerRef.current) return;
    containerRef.current.style.transform = 'translate3d(0, 0, 0)';
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block transition-transform duration-200 ease-out will-change-transform ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
