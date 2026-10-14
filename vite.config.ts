import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Lets a Cloudflare quick tunnel reach the local servers for remote phone testing.
const allowedHosts = ['.trycloudflare.com'];

export default defineConfig({
  server: { allowedHosts },
  preview: { allowedHosts },
  build: {
    // iOS / iPadOS Safari 16 is the floor (SPEC section 4).
    target: ['es2020', 'safari16'],
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Little Taps',
        short_name: 'Little Taps',
        description: 'Tap-to-discover pictures and sounds for toddlers.',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        background_color: '#F8EFD9',
        theme_color: '#F8EFD9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell plus every content asset, so the app runs in airplane mode.
        globPatterns: ['**/*.{js,css,html,json,webp,png,woff2,mp3,m4a}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // New content/deploys take over on the next launch without a prompt.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
});
