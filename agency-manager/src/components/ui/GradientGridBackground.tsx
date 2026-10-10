'use client';
// src/components/ui/GradientGridBackground.tsx
// High-performance gravitational warp dot-grid background with colorful cursor physics.
// - Tight, small-sized dot matrix grid (intersection points only — no grid lines)
// - Gravitational spacetime bending: points warp and pull toward cursor like a gravity well
// - Dynamic chromatic color bending (cyan -> violet -> magenta -> amber)
// - Gravitational wave ripple on click
// - Ambient multi-hued fluid aurora mesh
// - 100% pointer-events-none (no click interference)
// - Dark & Light mode adaptive colors

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function GradientGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Pointer state with smooth spring lerp
    const mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false };
    let isTouching = false;
    let lastMoveTime = Date.now();
    const ripples: Ripple[] = [];

    // Configuration — ultra-fine micro-grid density & delicate point sizing
    const CELL_SIZE = 12; // High-density micro-matrix
    const GRAVITY_RADIUS = 240; // Distance of gravitational influence
    const MAX_PULL = 22; // Subtle, elegant spacetime displacement
    const SWIRL_STRENGTH = 0.30; // Relativistic frame-drag swirl factor
    const BASE_POINT_SIZE = 0.55; // Delicate micro-dots

    // Pre-rendered offscreen canvas for static background dots
    let offscreenCanvas: HTMLCanvasElement | null = null;

    const buildStaticGrid = () => {
      if (width <= 0 || height <= 0) return;
      if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas');
      }
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;
      const offCtx = offscreenCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      offCtx.scale(dpr, dpr);

      const isDark =
        document.documentElement.classList.contains('dark') ||
        resolvedTheme === 'dark';
      const basePointColor = isDark
        ? 'rgba(255, 255, 255, 0.11)'
        : 'rgba(99, 102, 241, 0.13)';

      offCtx.beginPath();
      offCtx.fillStyle = basePointColor;
      for (let x0 = 0; x0 <= width; x0 += CELL_SIZE) {
        for (let y0 = 0; y0 <= height; y0 += CELL_SIZE) {
          offCtx.moveTo(x0 + BASE_POINT_SIZE, y0);
          offCtx.arc(x0, y0, BASE_POINT_SIZE, 0, Math.PI * 2);
        }
      }
      offCtx.fill();
    };

    const handleResize = () => {
      const prevWidth = width;
      const prevHeight = height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      // Rebuild offscreen cache on resize
      buildStaticGrid();

      // Adapt cursor / gradient position when switching between desktop and mobile or rotating
      if (prevWidth > 0 && prevHeight > 0) {
        if (mouse.targetX > width || mouse.targetY > height || mouse.x > width || mouse.y > height) {
          const ratioX = width / prevWidth;
          const ratioY = height / prevHeight;
          mouse.targetX = Math.min(Math.max(20, mouse.targetX * ratioX), width - 20);
          mouse.targetY = Math.min(Math.max(20, mouse.targetY * ratioY), height - 20);
          mouse.x = mouse.targetX;
          mouse.y = mouse.targetY;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Initial center position
    mouse.targetX = width / 2;
    mouse.targetY = height / 3;
    mouse.x = mouse.targetX;
    mouse.y = mouse.targetY;

    const setPointerCoords = (clientX: number, clientY: number, fromTouch = false) => {
      mouse.targetX = Math.min(Math.max(0, clientX), width);
      mouse.targetY = Math.min(Math.max(0, clientY), height);
      mouse.active = true;
      lastMoveTime = Date.now();
      if (fromTouch) {
        isTouching = true;
      }
    };

    // Modern pointer events (mouse, touch screen, stylus)
    const onPointerMove = (e: PointerEvent) => {
      const isTouch = e.pointerType === 'touch';
      setPointerCoords(e.clientX, e.clientY, isTouch);
    };

    // Standard mousemove fallback for desktop & DevTools device simulation
    const onMouseMove = (e: MouseEvent) => {
      setPointerCoords(e.clientX, e.clientY, false);
    };

    const onPointerDown = (e: PointerEvent) => {
      const isTouch = e.pointerType === 'touch';
      setPointerCoords(e.clientX, e.clientY, isTouch);

      // On direct touch, snap spring lerp quickly for instantaneous feel
      if (isTouch) {
        mouse.x += (e.clientX - mouse.x) * 0.7;
        mouse.y += (e.clientY - mouse.y) * 0.7;
      }

      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 8,
        maxRadius: Math.min(width * 0.75, 320),
        alpha: 0.9,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        isTouching = false;
        lastMoveTime = Date.now();
      }
    };

    const onPointerLeave = () => {
      // Don't immediately cancel active state — preserve coordinate for smooth drift transition
      lastMoveTime = Date.now();
    };

    // Dedicated mobile touch listeners for iOS Safari, Chrome Android, and mobile viewport
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        setPointerCoords(touch.clientX, touch.clientY, true);

        // Snap near touch point immediately to eliminate any drag delay
        mouse.x += (touch.clientX - mouse.x) * 0.7;
        mouse.y += (touch.clientY - mouse.y) * 0.7;

        ripples.push({
          x: touch.clientX,
          y: touch.clientY,
          radius: 8,
          maxRadius: Math.min(width * 0.75, 280),
          alpha: 0.9,
        });
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        setPointerCoords(touch.clientX, touch.clientY, true);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        setPointerCoords(touch.clientX, touch.clientY, true);
      } else {
        isTouching = false;
        lastMoveTime = Date.now();
      }
    };

    const onTouchCancel = () => {
      isTouching = false;
      lastMoveTime = Date.now();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    let time = 0;

    const render = () => {
      time += 0.016;

      const isDark =
        document.documentElement.classList.contains('dark') ||
        resolvedTheme === 'dark';

      // Faster, responsive spring lerp when actively touching or dragging
      const lerpSpeed = isTouching ? 0.24 : 0.095;
      mouse.x += (mouse.targetX - mouse.x) * lerpSpeed;
      mouse.y += (mouse.targetY - mouse.y) * lerpSpeed;

      // Idle autonomous subtle drift only after 2.8s of inactivity and not touching
      const isIdle = Date.now() - lastMoveTime > 2800 && !isTouching;
      if (isIdle) {
        const driftX = width / 2 + Math.cos(time * 0.65) * (width * 0.28);
        const driftY = height / 2 + Math.sin(time * 0.95) * (height * 0.22);
        mouse.targetX = driftX;
        mouse.targetY = driftY;
      }

      ctx.clearRect(0, 0, width, height);

      // ─── 1. Ambient Colorful Gradient Aura (Slow Moving Mesh) ───────────
      // Blob 1: Deep Violet / Indigo
      const b1x = width * 0.3 + Math.cos(time * 0.45) * 140;
      const b1y = height * 0.35 + Math.sin(time * 0.55) * 110;
      const g1 = ctx.createRadialGradient(b1x, b1y, 0, b1x, b1y, width * 0.42);
      g1.addColorStop(0, isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(139, 92, 246, 0.11)');
      g1.addColorStop(1, 'rgba(124, 58, 237, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      // Blob 2: Vibrant Cyan / Sky
      const b2x = width * 0.72 + Math.sin(time * 0.4) * 150;
      const b2y = height * 0.62 + Math.cos(time * 0.5) * 120;
      const g2 = ctx.createRadialGradient(b2x, b2y, 0, b2x, b2y, width * 0.38);
      g2.addColorStop(0, isDark ? 'rgba(6, 182, 212, 0.13)' : 'rgba(14, 165, 233, 0.10)');
      g2.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Blob 3: Neon Magenta / Rose
      const b3x = width * 0.5 + Math.cos(time * 0.75) * 120;
      const b3y = height * 0.82 + Math.sin(time * 0.65) * 90;
      const g3 = ctx.createRadialGradient(b3x, b3y, 0, b3x, b3y, width * 0.35);
      g3.addColorStop(0, isDark ? 'rgba(236, 72, 153, 0.11)' : 'rgba(244, 63, 94, 0.08)');
      g3.addColorStop(1, 'rgba(236, 72, 153, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, width, height);

      // ─── 2. Gravitational Core Glow Behind Points ────────────────────────
      const isMobile = width < 640;
      const gravityRadius = isMobile ? Math.min(210, Math.max(160, width * 0.48)) : GRAVITY_RADIUS;
      const maxPull = isMobile ? 18 : MAX_PULL;

      const coreGrad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        gravityRadius
      );
      if (isDark) {
        coreGrad.addColorStop(0, 'rgba(6, 182, 212, 0.28)');    // Cyan core
        coreGrad.addColorStop(0.3, 'rgba(139, 92, 246, 0.22)'); // Violet
        coreGrad.addColorStop(0.65, 'rgba(236, 72, 153, 0.12)'); // Magenta
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        coreGrad.addColorStop(0, 'rgba(14, 165, 233, 0.24)');   // Sky Blue
        coreGrad.addColorStop(0.32, 'rgba(124, 58, 237, 0.18)'); // Violet
        coreGrad.addColorStop(0.65, 'rgba(236, 72, 153, 0.10)'); // Pink
        coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = coreGrad;
      ctx.fillRect(
        Math.max(0, mouse.x - gravityRadius),
        Math.max(0, mouse.y - gravityRadius),
        gravityRadius * 2,
        gravityRadius * 2
      );

      // ─── 3. Gravitational Dot Matrix (No lines, points only) ─────────────
      const basePointSize = BASE_POINT_SIZE;
      const gravRadSq = gravityRadius * gravityRadius;

      // Color palette chromatic stops for warped points:
      // 0: Cyan, 1: Violet, 2: Magenta, 3: Amber
      const paletteDark = [
        [6, 182, 212],   // Cyan
        [139, 92, 246],  // Violet
        [236, 72, 153],  // Magenta
        [245, 158, 11],  // Amber
      ];
      const paletteLight = [
        [2, 132, 199],   // Blue
        [124, 58, 237],  // Purple
        [225, 29, 72],   // Rose
        [217, 119, 6],   // Amber
      ];
      const palette = isDark ? paletteDark : paletteLight;

      // Instant single-pass GPU blit for all unwarped background points,
      // clipping out the circular gravity well around the cursor.
      if (offscreenCanvas) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.arc(mouse.x, mouse.y, gravityRadius, 0, Math.PI * 2);
        ctx.clip('evenodd');
        ctx.drawImage(offscreenCanvas, 0, 0, width, height);
        ctx.restore();
      }

      // Gravitational bounding box around cursor for active warping
      const minX = Math.max(0, Math.floor((mouse.x - gravityRadius) / CELL_SIZE) * CELL_SIZE);
      const maxX = Math.min(width, Math.ceil((mouse.x + gravityRadius) / CELL_SIZE) * CELL_SIZE);
      const minY = Math.max(0, Math.floor((mouse.y - gravityRadius) / CELL_SIZE) * CELL_SIZE);
      const maxY = Math.min(height, Math.ceil((mouse.y + gravityRadius) / CELL_SIZE) * CELL_SIZE);

      // Render warped points inside the gravitational field with spacetime displacement
      for (let x0 = minX; x0 <= maxX; x0 += CELL_SIZE) {
        for (let y0 = minY; y0 <= maxY; y0 += CELL_SIZE) {
          const dx = mouse.x - x0;
          const dy = mouse.y - y0;
          const distSq = dx * dx + dy * dy;
          if (distSq >= gravRadSq) continue;

          const dist = Math.sqrt(distSq);
          const normDist = dist / gravityRadius; // 0 (at cursor) to 1 (at boundary)

          // Non-linear gravitational pull (strongest at center)
          const gravity = Math.pow(1 - normDist, 1.85);
          const pull = gravity * maxPull;

          // Frame-dragging swirl component (spacetime twist)
          const swirl = Math.sin(normDist * Math.PI) * SWIRL_STRENGTH;
          const cosS = Math.cos(swirl);
          const sinS = Math.sin(swirl);

          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);

          // Inward vector rotated by swirl
          const rx = nx * cosS - ny * sinS;
          const ry = nx * sinS + ny * cosS;

          let drawX = x0 + rx * pull;
          let drawY = y0 + ry * pull;

          // Gravitational wave ripple influence (only compute if ripples exist)
          if (ripples.length > 0) {
            for (let i = 0; i < ripples.length; i++) {
              const rip = ripples[i];
              const rdx = drawX - rip.x;
              const rdy = drawY - rip.y;
              const rdist = Math.hypot(rdx, rdy);
              const rdiff = Math.abs(rdist - rip.radius);
              if (rdiff < 35) {
                const wavePush = Math.sin((rdiff / 35) * Math.PI) * 12 * rip.alpha;
                drawX += (rdx / (rdist || 1)) * wavePush;
                drawY += (rdy / (rdist || 1)) * wavePush;
              }
            }
          }

          // Chromatic color bending based on angle around gravitational center + distance
          const angle = Math.atan2(dy, dx) + time * 0.9;
          const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);
          const colorPos = (normalizedAngle / (Math.PI * 2)) * palette.length;
          const idx1 = Math.floor(colorPos) % palette.length;
          const idx2 = (idx1 + 1) % palette.length;
          const blend = colorPos - Math.floor(colorPos);

          const r = Math.round(palette[idx1][0] * (1 - blend) + palette[idx2][0] * blend);
          const g = Math.round(palette[idx1][1] * (1 - blend) + palette[idx2][1] * blend);
          const b = Math.round(palette[idx1][2] * (1 - blend) + palette[idx2][2] * blend);

          const rawAlpha = isDark
            ? 0.18 + gravity * 0.82
            : 0.20 + gravity * 0.78;
          const alpha = Math.round(rawAlpha * 100) / 100;

          const pointSize = basePointSize + gravity * 0.65; // Max ~1.2px
          const pointFill = `rgba(${r}, ${g}, ${b}, ${alpha})`;

          // Subtle micro-halo for points near high-gravity core
          if (gravity > 0.7) {
            ctx.beginPath();
            ctx.arc(drawX, drawY, pointSize * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`;
            ctx.fill();
          }

          // Draw the warped point
          ctx.beginPath();
          ctx.arc(drawX, drawY, pointSize, 0, Math.PI * 2);
          ctx.fillStyle = pointFill;
          ctx.fill();
        }
      }

      // ─── 4. Gravitational Ripple Waves on Click ──────────────────────────
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.radius += 6.5;
        rip.alpha *= 0.935;

        if (rip.alpha < 0.015 || rip.radius > rip.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        const ripGrad = ctx.createRadialGradient(
          rip.x,
          rip.y,
          Math.max(0, rip.radius - 24),
          rip.x,
          rip.y,
          rip.radius
        );
        ripGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        ripGrad.addColorStop(
          0.85,
          isDark
            ? `rgba(236, 72, 153, ${rip.alpha * 0.45})`
            : `rgba(124, 58, 237, ${rip.alpha * 0.35})`
        );
        ripGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = ripGrad;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Pause animation when tab is inactive to preserve CPU / battery
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        lastMoveTime = Date.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [resolvedTheme]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}
