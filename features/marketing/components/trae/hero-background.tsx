'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type Dot = {
  x: number;
  y: number;
  baseOpacity: number;
  phase: number;
  speed: number;
};

const SPACING = 14;
const DOT_RADIUS = 1;
const MOUSE_RADIUS = 140;

/**
 * Dot-matrix particle canvas for the hero backdrop.
 */
export function TraeHeroBackground(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let dots: Dot[] = [];
    let mouse = { x: -1000, y: -1000 };

    const buildGrid = (width: number, height: number): void => {
      dots = [];
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          dots.push({
            x: col * SPACING + SPACING / 2,
            y: row * SPACING + SPACING / 2,
            baseOpacity: 0.07 + Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2,
            speed: 0.25 + Math.random() * 0.45,
          });
        }
      }
    };

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid(width, height);
    };

    const draw = (time: number): void => {
      const { width, height } = container.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      const t = time * 0.001;

      for (const dot of dots) {
        let opacity = dot.baseOpacity;

        if (!reduced) {
          opacity += Math.sin(t * dot.speed + dot.phase) * 0.05;

          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS) {
            opacity += (1 - dist / MOUSE_RADIUS) * 0.32;
          }
        }

        opacity = Math.min(0.5, Math.max(0.035, opacity));
        const bright = opacity > 0.18;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = bright
          ? `rgba(50, 240, 140, ${opacity * 0.9})`
          : `rgba(150, 170, 158, ${opacity})`;
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent): void => {
      const rect = container.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onLeave = (): void => {
      mouse = { x: -1000, y: -1000 };
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const section = container.closest('section');

    if (reduced) {
      draw(0);
    } else {
      frame = requestAnimationFrame(draw);
      window.addEventListener('mousemove', onMove, { passive: true });
      section?.addEventListener('mouseleave', onLeave);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('mousemove', onMove);
      section?.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced]);

  return (
    <div ref={containerRef} aria-hidden className="trae-hero-bg pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* CodeRabbit-style large top-center gradient mesh */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 80% 55% at 50% -8%, rgba(50,240,140,0.16) 0%, transparent 65%)',
            'radial-gradient(ellipse 45% 40% at 10% 30%, rgba(96,242,189,0.07) 0%, transparent 55%)',
            'radial-gradient(ellipse 38% 35% at 88% 25%, rgba(50,240,140,0.05) 0%, transparent 55%)',
            'radial-gradient(ellipse 70% 55% at 72% 78%, rgba(50,240,140,0.04) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      {/* Subtle horizontal scan line at top for depth */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(50,240,140,0.35) 30%, rgba(160,253,231,0.3) 50%, rgba(50,240,140,0.35) 70%, transparent 100%)',
        }}
      />

      {/* Left ambient glow */}
      <div
        className="absolute -left-32 top-1/4 h-[400px] w-[400px] opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,240,140,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Right ambient glow */}
      <div
        className="absolute -right-24 top-1/3 h-[300px] w-[350px] opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(96,242,189,0.1) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: 'linear-gradient(to top, var(--trae-bg, #0a0b0d) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
