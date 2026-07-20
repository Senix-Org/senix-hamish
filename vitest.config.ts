import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config for Senix.
 *
 * Mirrors the tsconfig path aliases (`@features/*` and `@/*`) so tests can
 * import feature code exactly as the app does. Tests run in the Node
 * environment because every unit under test is server-side. External
 * services (Supabase, GitHub, Upstash, LLM SDKs, Whop) are mocked per
 * test file, so the suite runs with zero real credentials.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@features\//, replacement: path.resolve(__dirname, 'features') + '/' },
      { find: /^@\//, replacement: path.resolve(__dirname, 'src') + '/' },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    env: {
      // Defense-in-depth alongside captureServerEvent's NODE_ENV guard:
      // blank the PostHog key so tests can never emit real analytics even in
      // CI, where the workflow-level env carries the production key for the
      // build step (root cause of the "user-1" person in PostHog).
      NEXT_PUBLIC_POSTHOG_KEY: '',
    },
    include: [
      'features/**/__tests__/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'tests/load/**'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      all: true,
      include: [
        'features/**/*.ts',
        'src/middleware.ts',
        'src/app/**/route.ts',
        'src/app/dashboard/actions.ts',
        'src/app/dashboard/page.tsx',
      ],
      exclude: [
        '**/__tests__/**',
        'features/**/*.test.ts',
        'features/review-queue/worker/index.ts',
      ],
    },
  },
});
