import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // For GitHub Pages project site, set base to repo name
  // Comment out or remove for custom domain
  site: 'https://jarettrude.github.io',
  base: '/vtracer-wasm',
  integrations: [svelte()],
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
