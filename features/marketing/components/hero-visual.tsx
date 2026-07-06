'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

const Spline = dynamic(
  () => import('@splinetool/react-spline').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <HeroVisualSkeleton />,
  },
);

function HeroVisualSkeleton(): React.ReactElement {
  return (
    <div
      className="hero-visual-skeleton aspect-square w-full max-w-md animate-pulse rounded-[10px] border border-white/[0.06] bg-zinc-900/40"
      aria-hidden
    />
  );
}

/**
 * Canvas wireframe node graph fallback. Cursor-reactive rotation.
 */
function WireframeFallback(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frame = 0;
    let mouseX = 0;
    let mouseY = 0;
    let raf = 0;

    const nodes = Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const radius = 0.28 + (i % 3) * 0.06;
      return {
        bx: Math.cos(angle) * radius,
        by: Math.sin(angle) * radius,
        bz: Math.sin(angle * 2) * 0.12,
      };
    });

    const edges: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      edges.push([i, (i + 1) % nodes.length]);
      if (i % 3 === 0) edges.push([i, (i + 5) % nodes.length]);
    }

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
    };

    const draw = (): void => {
      frame += reduced ? 0.002 : 0.008;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) * 0.85;

      const rotY = frame + mouseX;
      const rotX = mouseY * 0.8;

      const projected = nodes.map((n) => {
        let x = n.bx;
        let y = n.by;
        let z = n.bz;

        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const nx = x * cosY - z * sinY;
        const nz = x * sinY + z * cosY;
        x = nx;
        z = nz;

        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const ny = y * cosX - z * sinX;
        const nz2 = y * sinX + z * cosX;
        y = ny;
        z = nz2;

        const perspective = 1 / (1.4 - z);
        return {
          x: cx + x * scale * perspective,
          y: cy + y * scale * perspective,
          z,
        };
      });

      for (const [a, b] of edges) {
        const n1 = projected[a];
        const n2 = projected[b];
        const alpha = 0.15 + ((n1.z + n2.z) / 2 + 0.5) * 0.25;
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      }

      for (const p of projected) {
        const r = 2.5 + (p.z + 0.5) * 2;
        const alpha = 0.35 + (p.z + 0.5) * 0.45;
        ctx.fillStyle = `rgba(62, 207, 142, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-square w-full max-w-md rounded-[10px] border border-white/[0.06] bg-zinc-950/30"
      aria-hidden
    />
  );
}

type HeroVisualProps = {
  className?: string;
};

/**
 * Hero 3D visual: lazy Spline when configured, otherwise wireframe canvas.
 */
export function HeroVisual({ className = '' }: HeroVisualProps): React.ReactElement {
  const sceneUrl = process.env.NEXT_PUBLIC_SPLINE_HERO_URL;
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  if (reduced || !sceneUrl) {
    return (
      <div className={`relative ${className}`}>
        <WireframeFallback />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!ready ? <HeroVisualSkeleton /> : null}
      <div className={ready ? 'block' : 'sr-only'}>
        <Spline scene={sceneUrl} onLoad={() => setReady(true)} className="aspect-square w-full max-w-md" />
      </div>
    </div>
  );
}
