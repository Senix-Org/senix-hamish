import { ImageResponse } from 'next/og';

/**
 * Dynamic Open Graph image (1200x630) used as the default social card for
 * every page. Generated with next/og so it always reflects current
 * branding — no binary asset to keep in sync. Referenced by the SEO config
 * as `/api/og`.
 */
export function GET(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#08090a',
          backgroundImage:
            'radial-gradient(circle at 25% 0%, rgba(16,156,99,0.25), transparent 45%)',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              backgroundColor: '#169c63',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eafff4',
              fontSize: '34px',
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ color: '#e7ece9', fontSize: '30px', fontWeight: 600 }}>senix</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              color: '#e7ece9',
              fontSize: '72px',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            AI Code Review for Pull Requests
          </div>
          <div style={{ color: '#3ecf8e', fontSize: '34px', fontWeight: 500 }}>
            Behavioral summary + risk level in 30s
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
