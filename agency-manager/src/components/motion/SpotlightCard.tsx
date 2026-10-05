'use client';
// src/components/motion/SpotlightCard.tsx
// Interactive Spotlight Card:
// - Tracks pointer position across card surface
// - Illuminates a subtle radial highlight that moves with the cursor
// - Works seamlessly in both Light and Dark modes
// - Never obscures card text, inputs, or child clickability (pointer-events-none)
// - Disabled on touch and reduced-motion settings

import { useRef, useState, type ReactNode, type HTMLAttributes } from 'react';
import { useMotion } from './MotionProvider';

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spotlightColor?: string;
  className?: string;
  size?: number; // diameter of spotlight in px (default 380px)
}

export function SpotlightCard({
  children,
  spotlightColor,
  className = '',
  size = 380,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const { reducedMotion, isTouch } = useMotion();

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || isTouch || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setOpacity(1);
  };

  const handlePointerLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Subtle cursor spotlight overlay */}
      {!reducedMotion && !isTouch && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 ease-out z-[1]"
          style={{
            opacity,
            background:
              spotlightColor ||
              `radial-gradient(${size}px circle at ${position.x}px ${position.y}px, var(--spotlight-color, rgba(124, 58, 237, 0.08)), transparent 65%)`,
          }}
        />
      )}

      {/* Card Content */}
      <div className="relative z-[2] w-full h-full">
        {children}
      </div>
    </div>
  );
}
