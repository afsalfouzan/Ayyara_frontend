import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Staff choose when to reload into a new version (no surprise reloads mid-task).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ayyara Rebirth Admin',
        short_name: 'Ayyara Admin',
        description: 'Stock, orders and sales for Ayyara Rebirth.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f5f4',
        theme_color: '#171717',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell (JS, CSS, icons) is cached. API responses hold
        // customer and business data, so they always go to the network and are
        // never stored by the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.includes('/api/'), handler: 'NetworkOnly' }],
        cleanupOutdatedCaches: true,
        // Phone / laptop alerts: shows push messages and handles taps (public/push-sw.js).
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
});
