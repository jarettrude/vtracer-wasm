import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  // For GitHub Pages project site, set base to repo name
  // Comment out or remove for custom domain
  site: 'https://jarettrude.github.io',
  base: '/vtracer-wasm',
  integrations: [
    svelte(),
    AstroPWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'VTRacer-WASM-Square.svg', 'VTRacer-WASM-Full.svg', 'robots.txt'],
      manifest: {
        name: 'VTracer WASM - Image to SVG Converter',
        short_name: 'VTracer',
        description: 'Free offline image to SVG converter. Convert raster images to vector graphics entirely in your browser using WebAssembly. No uploads, complete privacy.',
        theme_color: '#188F54',
        background_color: '#000000',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        categories: ['graphics', 'utilities', 'productivity'],
        icons: [
          {
            src: 'favicon-16x16.png',
            sizes: '16x16',
            type: 'image/png',
          },
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: 'VTRacer-WASM-Full.jpeg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'VTracer WASM Desktop Interface',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB to handle large images
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['vtracer-wasm'],
    },
    build: {
      target: 'esnext',
    },
    // Ensure WASM files are served correctly
    assetsInclude: ['**/*.wasm'],
  },
  output: 'static',
});
