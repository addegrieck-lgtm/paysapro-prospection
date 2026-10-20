import { defineConfig } from 'vitest/config';

// Le JSX (hono/jsx) est configuré dans tsconfig.json (jsxImportSource), repris automatiquement par Vitest.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
