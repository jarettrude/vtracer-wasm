/**
 * VTracer WASM-based vectorization engine
 * Uses the real vtracer Rust library compiled to WebAssembly
 */

import type { VectorizeOptions } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

const isDev = import.meta.env.DEV;

export type { VectorizeOptions } from './types.js';
export { DEFAULT_OPTIONS } from './types.js';

// WASM module instance
let wasmModule: any = null;

/**
 * Initialize the WASM module
 */
async function initWasm(): Promise<any> {
  if (wasmModule) return wasmModule;
  
  if (isDev) console.log('[vtracer] Loading WASM module...');
  try {
    const wasm = await import('./vtracer-wasm/vtracer_wasm.js');
    if (isDev) console.log('[vtracer] WASM module imported, initializing...');
    await wasm.default();
    if (isDev) console.log('[vtracer] WASM initialized successfully');
    wasmModule = wasm;
    return wasmModule;
  } catch (e) {
    if (isDev) console.error('[vtracer] Failed to load WASM:', e);
    throw e;
  }
}

/**
 * Vectorization result
 */
export interface VectorizeResult {
  svg: string;
  width: number;
  height: number;
  pathCount: number;
  colorCount: number;
  duration: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (stage: string, progress: number) => void;

/**
 * Main vectorization function using real vtracer WASM
 */
export async function vectorize(
  imageData: ImageData,
  options: Partial<VectorizeOptions> = {},
  onProgress?: ProgressCallback
): Promise<VectorizeResult> {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, data } = imageData;
  
  if (isDev) {
    console.log('[vtracer] Starting with options:', opts);
    console.log('[vtracer] Image size:', width, 'x', height);
  }
  
  onProgress?.('Loading WASM', 0);
  
  // Initialize WASM module
  const wasm = await initWasm();
  
  onProgress?.('Processing', 0.1);
  
  // Build config JSON for vtracer
  // visioncortex expects 0 <= color_precision < 8; enforce this here
  const colorPrecision = Math.max(0, Math.min(7, opts.color_precision));
  const config = {
    clustering_mode: opts.colormode === 'bw' ? 'binary' : 'color',
    mode: opts.mode,
    hierarchical: opts.hierarchical,
    filter_speckle: opts.filter_speckle,
    color_precision: colorPrecision,
    layer_difference: opts.layer_difference,
    corner_threshold: opts.corner_threshold,
    length_threshold: opts.length_threshold,
    max_iterations: 10,
    splice_threshold: opts.splice_threshold,
    path_precision: opts.path_precision,
  };
  
  if (isDev) console.log('[vtracer] Config:', config);
  
  onProgress?.('Vectorizing', 0.3);
  
  // Call the WASM function
  // Note: data is Uint8ClampedArray, we need to copy it to Uint8Array
  // Using data.buffer directly can cause issues with byte offset/length
  const imageBytes = new Uint8Array(data);
  if (isDev) console.log('[vtracer] Image bytes length:', imageBytes.length, 'expected:', width * height * 4);
  
  let svg: string;
  try {
    svg = wasm.convert_to_svg(
      imageBytes,
      width,
      height,
      JSON.stringify(config)
    );
  } catch (e) {
    if (isDev) console.error('[vtracer] WASM convert_to_svg failed:', e);
    throw e;
  }
  
  const duration = performance.now() - startTime;
  
  // Count paths in SVG
  const pathCount = (svg.match(/<path/g) || []).length;
  
  if (pathCount === 0) {
    if (isDev) console.warn('[vtracer] No paths generated! SVG:', svg);
  }
  
  if (isDev) {
    console.log('[vtracer] Complete in', duration.toFixed(0), 'ms');
    console.log('[vtracer] SVG size:', svg.length, 'bytes');
    console.log('[vtracer] Paths:', pathCount);
  }
  
  onProgress?.('Complete', 1.0);
  
  return {
    svg,
    width,
    height,
    pathCount,
    colorCount: Math.pow(2, colorPrecision),
    duration,
  };
}

/**
 * Load image from File object
 */
export async function loadImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Limit size for performance
      const MAX_SIZE = 4096;
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(imageData);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Load image from URL
 */
export async function loadImageFromUrl(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      const MAX_SIZE = 4096;
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(ctx.getImageData(0, 0, width, height));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Convert SVG to data URL
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Download SVG as file
 */
export function downloadSvg(svg: string, filename: string = 'vector.svg'): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

