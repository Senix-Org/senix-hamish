'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

/**
 * Product demo video — 3-D treatment using site brand greens only:
 * - Rotating conic-gradient green border (GSAP spinner)
 * - Floating / levitating frame (GSAP sine wave)
 * - Mouse-tracking perspective tilt (GSAP rotateX/Y)
 * - Diagonal green shine sweep every ~6 s
 * - Deep shadow layer for physical depth
 * - L-shaped brand-green corner accents
 */
export function TraeDemoSection(): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  /* ── GSAP: all animations ── */
  useEffect(() => {
    if (!sectionRef.current) return;
    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      if (!section) return;

      const label = section.querySelector('[data-demo-label]');
      const title = section.querySelector('[data-demo-title]');
      const desc = section.querySelector('[data-demo-desc]');
      const caption = section.querySelector('[data-demo-caption]');

      ctx = gsap.context(() => {
        /* scroll reveal */
        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: 'top 76%', once: true },
        });
        tl.fromTo(label, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
          .fromTo(title, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power4.out' }, '-=0.28')
          .fromTo(desc, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, '-=0.35')
          .fromTo(
            floatRef.current,
            { opacity: 0, y: 56, scale: 0.95 },
            { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out' },
            '-=0.4',
          )
          .fromTo(caption, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.3');

        if (reduced) return;

        /* rotating green border */
        if (spinnerRef.current) {
          gsap.to(spinnerRef.current, { rotation: 360, duration: 5, ease: 'none', repeat: -1 });
        }

        /* floating */
        if (floatRef.current) {
          gsap.to(floatRef.current, {
            y: -12,
            duration: 4,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: 0.6,
          });
        }

        /* diagonal shine sweep */
        if (shineRef.current) {
          gsap.fromTo(
            shineRef.current,
            { x: '-110%', opacity: 1 },
            { x: '210%', opacity: 1, duration: 1.1, ease: 'power1.inOut', repeat: -1, repeatDelay: 5.5, delay: 2.5 },
          );
        }

        /* mouse-tilt */
        const onMove = (e: MouseEvent): void => {
          if (!tiltRef.current) return;
          const r = tiltRef.current.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
          const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
          gsap.to(tiltRef.current, {
            rotateY: dx * 7,
            rotateX: -dy * 4.5,
            transformPerspective: 1200,
            duration: 0.55,
            ease: 'power2.out',
          });
        };
        const onLeave = (): void => {
          gsap.to(tiltRef.current, {
            rotateY: 0,
            rotateX: 0,
            duration: 1.4,
            ease: 'elastic.out(1, 0.4)',
          });
        };
        section.addEventListener('mousemove', onMove, { passive: true });
        section.addEventListener('mouseleave', onLeave);
      }, section);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  /* ── video: lazy-load src via IntersectionObserver, then autoplay ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    // Only fetch the video file once the section enters the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        if (!video.src) {
          video.src = '/demo.mp4';
          video.load();
        }
        if (!reduced) video.play().catch(() => { /* autoplay blocked */ });
      },
      { rootMargin: '200px' },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [reduced]);

  const toggleMute = (): void => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const togglePlay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBlock: 'clamp(72px,9vw,120px)',
      }}
    >
      {/* ── Brand-green ambient glow blobs ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 55% at 50% 8%, rgba(50,240,140,0.09) 0%, transparent 62%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 45% 35% at 15% 60%, rgba(50,240,140,0.045) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 85% 55%, rgba(96,242,189,0.035) 0%, transparent 65%)' }} />
        {/* Noise grain for solid, tactile feel */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.018,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: '160px 160px',
        }} />
      </div>

      <div className="trae-section" style={{ position: 'relative' }}>
        {/* ── Section header ── */}
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px,5vw,56px)' }}>
          <p data-demo-label className="trae-section-label" style={{ opacity: 0 }}>
            Live demo
          </p>
          <h2
            data-demo-title
            style={{
              marginTop: '12px',
              fontSize: 'clamp(28px,4vw,48px)',
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#f5f9fe',
              opacity: 0,
            }}
          >
            From PR opened to risk summary:{' '}
            {/* brand gradient — same as trae-gradient-text */}
            <span className="trae-gradient-text">30 seconds.</span>
          </h2>
          <p
            data-demo-desc
            className="trae-section-desc"
            style={{ marginInline: 'auto', textAlign: 'center', opacity: 0 }}
          >
            Watch Senix analyze a real pull request and post a behavioral comment with risk tags,
            focus files, and a summary reviewers actually read.
          </p>
        </div>

        {/* ── 3-D perspective wrapper ── */}
        <div style={{ perspective: '1300px', display: 'flex', justifyContent: 'center' }}>
          <div
            ref={tiltRef}
            style={{ transformStyle: 'preserve-3d', width: '100%', maxWidth: '940px' }}
          >
            {/* float target + scroll-reveal target */}
            <div ref={floatRef} style={{ position: 'relative', opacity: 0 }}>

              {/* Deep shadow — card casting shadow downward into the page */}
              <div aria-hidden style={{
                position: 'absolute',
                left: '5%',
                right: '5%',
                bottom: '-40px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.9)',
                filter: 'blur(28px)',
                zIndex: -2,
              }} />

              {/* Outer green ambient halo */}
              <div aria-hidden style={{
                position: 'absolute',
                inset: '-28px',
                borderRadius: '24px',
                background: 'radial-gradient(ellipse at center, rgba(50,240,140,0.18) 0%, rgba(50,240,140,0.04) 45%, transparent 70%)',
                filter: 'blur(12px)',
                zIndex: -1,
              }} />

              {/* ── Rotating green border (conic overflow trick) ── */}
              <div style={{
                position: 'relative',
                borderRadius: '14px',
                padding: '2px',
                overflow: 'hidden',
                background: 'transparent',
              }}>
                {/* Spinner — 400% wide so corners stay filled during rotation */}
                <div
                  ref={spinnerRef}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: '-150%',
                    left: '-150%',
                    width: '400%',
                    height: '400%',
                    background: 'conic-gradient(from 0deg, transparent 0deg, transparent 55deg, #0a3d1e 70deg, #1a7a45 90deg, #28b868 115deg, #32f08c 140deg, #60f2bd 155deg, #a0fde7 162deg, #60f2bd 170deg, #32f08c 185deg, #28b868 200deg, #1a7a45 215deg, #0a3d1e 230deg, transparent 248deg, transparent 360deg)',
                    transformOrigin: '50% 50%',
                  }}
                />

                {/* Inner frame — dark bg clips to show only the 2px rotating border */}
                <div style={{
                  position: 'relative',
                  zIndex: 1,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#09090b',
                }}>

                  {/* Chrome bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '11px 16px',
                    borderBottom: '1px solid rgba(50,240,140,0.12)',
                    background: 'linear-gradient(90deg, #0d0e10 0%, rgba(50,240,140,0.04) 50%, #0d0e10 100%)',
                  }}>
                    <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#ff5f57', flexShrink: 0 }} aria-hidden />
                    <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#febc2e', flexShrink: 0 }} aria-hidden />
                    <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#28c840', flexShrink: 0 }} aria-hidden />
                    <span style={{
                      marginLeft: '12px',
                      flex: 1,
                      borderRadius: '4px',
                      border: '1px solid rgba(50,240,140,0.08)',
                      background: '#0a0b0d',
                      padding: '3px 12px',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#787d87',
                    }}>
                      github.com / your-org / your-repo / pull / 247
                    </span>
                  </div>

                  {/* ── Video ── */}
                  <div className="group" style={{ position: 'relative', background: '#09090b' }}>
                    <video
                      ref={videoRef}
                      loop
                      muted={muted}
                      playsInline
                      preload="none"
                      style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                    />

                    {/* Diagonal green shine sweep */}
                    <div
                      ref={shineRef}
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '28%',
                        background: 'linear-gradient(108deg, transparent 0%, rgba(50,240,140,0.04) 30%, rgba(96,242,189,0.09) 50%, rgba(50,240,140,0.04) 70%, transparent 100%)',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Top edge gleam line */}
                    <div aria-hidden style={{
                      position: 'absolute',
                      top: 0,
                      left: '10%',
                      right: '10%',
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent, rgba(50,240,140,0.4) 40%, rgba(160,253,231,0.55) 50%, rgba(50,240,140,0.4) 60%, transparent)',
                    }} />

                    {/* Play overlay */}
                    {!playing && (
                      <button
                        type="button"
                        onClick={togglePlay}
                        aria-label="Play demo video"
                        style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.35)',
                          border: 'none', cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        className="hover:bg-black/20"
                      >
                        <span style={{
                          display: 'flex',
                          height: '72px',
                          width: '72px',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          border: '1px solid rgba(50,240,140,0.5)',
                          background: 'rgba(50,240,140,0.1)',
                          backdropFilter: 'blur(8px)',
                          boxShadow: '0 0 48px -8px rgba(50,240,140,0.45), inset 0 1px 0 rgba(96,242,189,0.2)',
                          transition: 'all 0.2s',
                        }}>
                          <svg width="22" height="22" viewBox="0 0 20 20" fill="#32f08c" style={{ marginLeft: '3px' }} aria-hidden>
                            <path d="M4 3.5l13 6.5-13 6.5V3.5z" />
                          </svg>
                        </span>
                      </button>
                    )}

                    {/* Hover controls */}
                    <div
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ position: 'absolute', bottom: '12px', right: '12px', display: 'flex', gap: '8px' }}
                    >
                      {[
                        {
                          onClick: toggleMute,
                          label: muted ? 'Unmute' : 'Mute',
                          icon: muted ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            </svg>
                          ),
                        },
                        {
                          onClick: togglePlay,
                          label: playing ? 'Pause' : 'Play',
                          icon: playing ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path d="M4 3.5l13 6.5-13 6.5V3.5z" />
                            </svg>
                          ),
                        },
                      ].map(({ onClick, label, icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={onClick}
                          aria-label={label}
                          style={{
                            height: '32px', width: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '4px',
                            border: '1px solid rgba(50,240,140,0.2)',
                            background: 'rgba(0,0,0,0.72)',
                            color: '#a6aab5',
                            backdropFilter: 'blur(8px)',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s, color 0.2s',
                          }}
                          className="hover:border-[#32f08c]/55 hover:text-[#32f08c]"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Green status footer strip */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    borderTop: '1px solid rgba(50,240,140,0.1)',
                    background: 'linear-gradient(90deg, rgba(50,240,140,0.04) 0%, #0d0e10 50%, rgba(50,240,140,0.04) 100%)',
                  }}>
                    <span aria-hidden style={{
                      height: '6px', width: '6px', borderRadius: '50%',
                      background: '#32f08c',
                      boxShadow: '0 0 7px 1px rgba(50,240,140,0.7)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#787d87' }}>
                      Senix · Analysis complete
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(50,240,140,0.65)' }}>
                      ~30s
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Bottom "sinking into the page" fade ── */}
              {/* Sits over the card, fades bottom into the page background */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '52%',
                  background: 'linear-gradient(to top, #09090b 0%, rgba(9,9,11,0.88) 22%, rgba(9,9,11,0.55) 48%, rgba(9,9,11,0.15) 70%, transparent 100%)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  borderRadius: '0 0 12px 12px',
                }}
              />

              {/* Extra wide blur pool below the card — deepens the "submerged" look */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: '-18px',
                  left: '-8%',
                  right: '-8%',
                  height: '80px',
                  background: 'linear-gradient(to top, #09090b 0%, rgba(9,9,11,0.92) 35%, transparent 100%)',
                  filter: 'blur(8px)',
                  zIndex: 11,
                  pointerEvents: 'none',
                }}
              />

              {/* L-shaped brand-green corner accents */}
              {([
                { top: '-5px', left: '-5px', borderTop: '2px solid #32f08c', borderLeft: '2px solid #32f08c', borderRadius: '5px 0 0 0' },
                { top: '-5px', right: '-5px', borderTop: '2px solid #32f08c', borderRight: '2px solid #32f08c', borderRadius: '0 5px 0 0' },
                { bottom: '-5px', left: '-5px', borderBottom: '2px solid #32f08c', borderLeft: '2px solid #32f08c', borderRadius: '0 0 0 5px' },
                { bottom: '-5px', right: '-5px', borderBottom: '2px solid #32f08c', borderRight: '2px solid #32f08c', borderRadius: '0 0 5px 0' },
              ] as React.CSSProperties[]).map((style, i) => (
                <div key={i} aria-hidden style={{ position: 'absolute', height: '22px', width: '22px', opacity: 0.6, ...style }} />
              ))}
            </div>
          </div>
        </div>

        {/* Caption row */}
        <div
          data-demo-caption
          style={{
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '22px',
            maxWidth: '940px',
            marginInline: 'auto',
          }}
        >
          <p style={{ fontSize: '12px', color: '#787d87' }}>
            Real pull request. Real output. No staging environment.
          </p>
          <div style={{ display: 'flex', gap: '18px' }}>
            {['Analysis in 30s', 'Zero config', 'Private by default'].map((label) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#787d87' }}>
                <span aria-hidden style={{ height: '6px', width: '6px', borderRadius: '50%', background: 'rgba(50,240,140,0.55)', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
