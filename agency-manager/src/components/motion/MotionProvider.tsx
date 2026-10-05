'use client';
// src/components/motion/MotionProvider.tsx
// Centralized motion provider for KIRA Agency Manager:
// - Manages accessibility & reduced-motion state
// - Detects touch vs mouse devices
// - Renders subtle, high-performance ambient cursor glow (disabled on touch & reduced motion)
// - Exposes motion context for components

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react';

interface MotionContextValue {
  reducedMotion: boolean;
  isTouch: boolean;
  ambientGlowEnabled: boolean;
  setAmbientGlowEnabled: (enabled: boolean) => void;
}

const MotionContext = createContext<MotionContextValue>({
  reducedMotion: false,
  isTouch: false,
  ambientGlowEnabled: true,
  setAmbientGlowEnabled: () => {},
});

export function useMotion(): MotionContextValue {
  return useContext(MotionContext);
}

/**
 * Ambient Cursor Glow:
 * Subtle, low-opacity radial highlight that smoothly tracks the cursor across the viewport.
 * Runs at 60/120fps via requestAnimationFrame and CSS transform3d.
 * Never affects layout or clickability (pointer-events-none).
 */
function AmbientCursorGlow({ enabled, reducedMotion }: { enabled: boolean; reducedMotion: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -999, y: -999, targetX: -999, targetY: -999, isVisible: false });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || reducedMotion) return;

    // Detect if primary input is touch
    const isTouchOnly = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchOnly) return;

    const onPointerMove = (e: PointerEvent) => {
      posRef.current.targetX = e.clientX;
      posRef.current.targetY = e.clientY;
      if (!posRef.current.isVisible) {
        posRef.current.isVisible = true;
        posRef.current.x = e.clientX;
        posRef.current.y = e.clientY;
        if (glowRef.current) {
          glowRef.current.style.opacity = '1';
        }
      }
    };

    const onMouseLeave = () => {
      posRef.current.isVisible = false;
      if (glowRef.current) {
        glowRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    // Smooth animation loop
    const animate = () => {
      const pos = posRef.current;
      if (pos.isVisible && glowRef.current) {
        // Smooth lerp interpolation for silky motion
        pos.x += (pos.targetX - pos.x) * 0.12;
        pos.y += (pos.targetY - pos.y) * 0.12;

        glowRef.current.style.transform = `translate3d(${pos.x - 240}px, ${pos.y - 240}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, reducedMotion]);

  if (!enabled || reducedMotion) return null;

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="fixed top-0 left-0 w-[480px] h-[480px] pointer-events-none select-none z-[1] opacity-0 transition-opacity duration-500 rounded-full"
      style={{
        background:
          'radial-gradient(circle 240px, rgba(124, 58, 237, 0.045) 0%, rgba(236, 72, 153, 0.015) 45%, transparent 70%)',
        willChange: 'transform',
      }}
    />
  );
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [ambientGlowEnabled, setAmbientGlowEnabled] = useState(true);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const onChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', onChange);

    // Check touch device
    const checkTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    setIsTouch(checkTouch);

    return () => {
      mediaQuery.removeEventListener('change', onChange);
    };
  }, []);

  return (
    <MotionContext.Provider
      value={{
        reducedMotion,
        isTouch,
        ambientGlowEnabled,
        setAmbientGlowEnabled,
      }}
    >
      <AmbientCursorGlow enabled={ambientGlowEnabled && !isTouch} reducedMotion={reducedMotion} />
      {children}
    </MotionContext.Provider>
  );
}
