import type { Metadata } from 'next';
import { getAppBaseUrl } from '@features/shared/mcp-config';

/**
 * Central SEO configuration. Every public page builds its metadata from
 * here so titles, descriptions, canonical URLs, and social cards stay
 * consistent. The base URL is read from NEXT_PUBLIC_APP_URL (via
 * getAppBaseUrl) so previews and self-hosted deployments resolve correctly.
 */
export const siteConfig = {
  name: 'Senix',
  defaultTitle: 'Senix — AI Code Review for Pull Requests',
  titleTemplate: '%s | Senix',
  description:
    'Senix reads every PR your team opens and posts a behavioral summary with risk level as a comment within 30 seconds. Built for teams shipping with Cursor, Copilot, and Claude Code.',
  ogImage: '/api/og',
  twitter: '@senixdev',
} as const;

/** Absolute base URL, no trailing slash. */
export function baseUrl(): string {
  return getAppBaseUrl();
}

/** Build an absolute canonical URL for a path (e.g. "/pricing"). */
export function canonicalUrl(path = '/'): string {
  const clean = path === '/' ? '' : `/${path.replace(/^\/+/, '')}`;
  return `${baseUrl()}${clean}`;
}

/**
 * Root-level metadata applied in the app layout. Sets metadataBase (so
 * relative OG image paths resolve), the title template, default social
 * cards, and the home canonical.
 */
export const rootMetadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  alternates: { canonical: canonicalUrl('/') },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    url: canonicalUrl('/'),
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitter,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
};

/**
 * Build per-page metadata. Pass a path for the canonical URL, and optional
 * title/description/keywords overrides. The title is fed through the
 * "%s | Senix" template unless `absoluteTitle` is set.
 */
export function buildMetadata({
  title,
  description = siteConfig.description,
  path = '/',
  keywords,
  absoluteTitle = false,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  absoluteTitle?: boolean;
}): Metadata {
  const url = canonicalUrl(path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      title,
      description,
      url,
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: {
      card: 'summary_large_image',
      site: siteConfig.twitter,
      title,
      description,
      images: [siteConfig.ogImage],
    },
  };
}
