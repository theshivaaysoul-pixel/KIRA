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
    let lastMoveTime = Date.now();
    const ripples: Ripple[] = [];

    // Configuration — ultra-fine micro-grid density & delicate point sizing
    const CELL_SIZE = 10; // Decreased grid size for high-density micro-matrix
    const GRAVITY_RADIUS = 240; // Distance of gravitational influence
    const MAX_PULL = 22; // Subtle, elegant spacetime displacement
    const SWIRL_STRENGTH = 0.30; // Relativistic frame-drag swirl factor

    const handleResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });

    // Initial center position
    mouse.targetX = width / 2;
    mouse.targetY = height / 3;
    mouse.x = mouse.targetX;
    mouse.y = mouse.targetY;

    const onPointerMove = (e: PointerEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
      lastMoveTime = Date.now();
    };

    const onPointerLeave = () => {
      mouse.active = false;
    };

    const onPointerDown = (e: MouseEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 8,
        maxRadius: 320,
        alpha: 0.9,
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    let time = 0;

    const render = () => {
      time += 0.016;

      const isDark =
        document.documentElement.classList.contains('dark') ||
        resolvedTheme === 'dark';

      // Idle autonomous subtle drift if mouse has been still for > 2.5s
      const isIdle = Date.now() - lastMoveTime > 2500 || !mouse.active;
      if (isIdle) {
        const driftX = width / 2 + Math.cos(time * 0.65) * (width * 0.28);
        const driftY = height / 2 + Math.sin(time * 0.95) * (height * 0.22);
        mouse.targetX = driftX;
        mouse.targetY = driftY;
      }

      // Smooth lerp chasing target position (spring physics)
      mouse.x += (mouse.targetX - mouse.x) * 0.095;
      mouse.y += (mouse.targetY - mouse.y) * 0.095;

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
      const coreGrad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        GRAVITY_RADIUS
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
        Math.max(0, mouse.x - GRAVITY_RADIUS),
        Math.max(0, mouse.y - GRAVITY_RADIUS),
        GRAVITY_RADIUS * 2,
        GRAVITY_RADIUS * 2
      );

      // ─── 3. Gravitational Dot Matrix (No lines, points only) ─────────────
      const basePointColor = isDark
        ? 'rgba(255, 255, 255, 0.11)'
        : 'rgba(99, 102, 241, 0.13)';
      const basePointSize = 0.55; // Delicate, micro-sized dots

      const gravRadSq = GRAVITY_RADIUS * GRAVITY_RADIUS;

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

      // Gravitational bounding box around cursor
      const minX = Math.max(0, Math.floor((mouse.x - GRAVITY_RADIUS) / CELL_SIZE) * CELL_SIZE);
      const maxX = Math.min(width, Math.ceil((mouse.x + GRAVITY_RADIUS) / CELL_SIZE) * CELL_SIZE);
      const minY = Math.max(0, Math.floor((mouse.y - GRAVITY_RADIUS) / CELL_SIZE) * CELL_SIZE);
      const maxY = Math.min(height, Math.ceil((mouse.y + GRAVITY_RADIUS) / CELL_SIZE) * CELL_SIZE);

      // Fast single-pass batch for unwarped background points
      ctx.beginPath();
      ctx.fillStyle = basePointColor;
      for (let x0 = 0; x0 <= width; x0 += CELL_SIZE) {
        const inXRange = x0 >= minX && x0 <= maxX;
        for (let y0 = 0; y0 <= height; y0 += CELL_SIZE) {
          if (inXRange && y0 >= minY && y0 <= maxY) {
            const dx = mouse.x - x0;
            const dy = mouse.y - y0;
            if (dx * dx + dy * dy < gravRadSq) {
              continue; // Handled individually below with gravitational warp
            }
          }
          ctx.moveTo(x0 + basePointSize, y0);
          ctx.arc(x0, y0, basePointSize, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // Render warped points inside the gravitational field with spacetime displacement
      for (let x0 = minX; x0 <= maxX; x0 += CELL_SIZE) {
        for (let y0 = minY; y0 <= maxY; y0 += CELL_SIZE) {
          const dx = mouse.x - x0;
          const dy = mouse.y - y0;
          const distSq = dx * dx + dy * dy;
          if (distSq >= gravRadSq) continue;

          const dist = Math.sqrt(distSq);
          const normDist = dist / GRAVITY_RADIUS; // 0 (at cursor) to 1 (at boundary)

          // Non-linear gravitational pull (strongest at center)
          const gravity = Math.pow(1 - normDist, 1.85);
          const pull = gravity * MAX_PULL;

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

          // Gravitational wave ripple influence
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

          const alpha = isDark
            ? 0.18 + gravity * 0.82
            : 0.20 + gravity * 0.78;

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
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerDown);
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
