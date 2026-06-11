import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Minimal ambient typing so the config compiles without @types/node.
declare const process: { env: Record<string, string | undefined> };

// Build version: set by CI/deploy (VITE_APP_VERSION = git short sha) so every
// push to main produces a distinct, identifiable build that auto-rolls out to
// clients. Plain local builds get "dev".
const APP_VERSION = process.env.VITE_APP_VERSION || 'dev';
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the service worker ourselves (src/main.tsx) so we can poll
      // for new builds and reload clients onto the latest version.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],

      manifest: {
        name: 'Direct',
        short_name: 'Direct',
        description: 'Peer-to-peer chat — messages never stored on servers',
        theme_color: '#8B5CF6',
        background_color: '#1A1820',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg',                  sizes: 'any',     type: 'image/svg+xml' },
        ],
      },

      workbox: {
        // Precache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // SPA routing: serve index.html for any unmatched navigation
        navigateFallback: '/index.html',
        // Don't intercept backend, auth or WebSocket routes
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/ws/, /^\/users/, /^\/friends/, /^\/photos/, /^\/notifications/, /^\/health/],

        runtimeCaching: [
          // Google Fonts stylesheets — cache first, 1 year
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts files — cache first, 1 year
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Avatar images — stale while revalidate, 7 days
          {
            urlPattern: /\/avatars\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'avatars',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  server: {
    port: 5173,
    host: true,
  },
});
