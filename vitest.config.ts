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
      // `server-only` throws on import in a plain Node context; Next swaps it
      // for an empty module in server builds via the `react-server` condition.
      // Vitest (Node) does the same here so server-only modules are testable.
      { find: /^server-only$/, replacement: path.resolve(__dirname, 'node_modules/server-only/empty.js') },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
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
