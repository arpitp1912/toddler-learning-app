import { defineConfig } from 'vitest/config';

// Unit tests only. Browser tests in tests/ run under Playwright.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
