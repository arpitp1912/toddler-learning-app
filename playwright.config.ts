import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (service worker included).
// WebKit stands in for iOS Safari; Chromium is a second engine.
// Not 4173, so a manual `npm run preview` (or a tunnel to it) can keep running.
const PORT = 4174;
const sizes = { ipad: { width: 1180, height: 820 }, iphone: { width: 390, height: 844 } };

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: (['webkit', 'chromium'] as const).flatMap((engine) =>
    Object.entries(sizes).map(([name, viewport]) => ({
      name: `${engine}-${name}`,
      use: {
        ...(engine === 'webkit' ? devices['Desktop Safari'] : devices['Desktop Chrome']),
        viewport,
        hasTouch: name === 'iphone',
      },
    })),
  ),
});
