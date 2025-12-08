# VTracer WASM

A browser-based image to SVG vectorizer powered by [VTracer](https://github.com/visioncortex/vtracer) and WebAssembly.

## Features

- 100% client-side processing - no uploads, complete privacy
- Real-time preview
- Adjustable vectorization parameters
- Support for color and black & white modes
- Multiple curve fitting options (Pixel, Polygon, Spline)

## Live Demo

[https://jarettrude.github.io/vtracer-wasm](https://jarettrude.github.io/vtracer-wasm)

## Development

```bash
npm install
npm run build:wasm   # download WASM artifacts from the jarettrude/vtracer repository
npm run dev
```

## Build

```bash
npm run build:wasm   # ensure WASM artifacts are present/updated
npm run build
```

## Tech Stack

- [Astro](https://astro.build/) - Static site framework
- [Svelte](https://svelte.dev/) - UI components
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [VTracer](https://github.com/visioncortex/vtracer) - Image vectorization (WASM)

## License

MIT - See [LICENSE](LICENSE)

## Credits

- [VTracer](https://github.com/visioncortex/vtracer) by Vision Cortex
