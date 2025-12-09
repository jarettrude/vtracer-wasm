/**
 * VTracer WASM Vectorization Engine
 * 
 * High-performance image-to-SVG conversion using WebAssembly.
 * Supports multiple image formats including HEIC/HEIF, with real-time
 * progress tracking and comprehensive vectorization options.
 */

import type { VectorizeOptions } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

const isDev = import.meta.env.DEV;

/**
 * Supported image MIME types and their handling
 */
/**
 * Supported image MIME types for native browser processing
 * These formats can be handled directly without conversion
 */
const NATIVE_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

/**
 * HEIC/HEIF MIME types requiring conversion
 * These formats need preprocessing before vectorization
 */
const HEIC_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

/**
 * Check if a file is a HEIC/HEIF image (by MIME type or extension)
 */
/**
 * Check if a file is HEIC/HEIF format
 * @param file - File object to check
 * @returns boolean - True if HEIC/HEIF format
 */
function isHeicFile(file: File): boolean {
  const mimeMatch = HEIC_TYPES.includes(file.type.toLowerCase());
  const extMatch = /\.(heic|heif)$/i.test(file.name);
  return mimeMatch || extMatch;
}

/**
 * Convert HEIC/HEIF file to PNG blob for browser compatibility
 * Uses heic2any library for format conversion
 * @param file - HEIC/HEIF file to convert
 * @returns Promise<Blob> - Converted PNG blob
 */
async function convertHeicToBlob(file: File): Promise<Blob> {
  if (isDev) console.log('[vtracer] Converting HEIC to PNG...');
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({
    blob: file,
    toType: 'image/png',
    quality: 1,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (isDev) console.log('[vtracer] HEIC conversion complete');
  return blob;
}

export type { VectorizeOptions } from './types.js';
export { DEFAULT_OPTIONS } from './types.js';

/**
 * WASM module instance cache
 * Prevents multiple initialization of the same module
 */
let wasmModule: any = null;

/**
 * Initialize the WASM module with error handling
 * @returns Promise<any> - Initialized WASM module instance
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
 * Vectorize image data to SVG using WASM engine
 * @param imageData - Image data to vectorize
 * @param options - Vectorization parameters
 * @param onProgress - Progress callback function
 * @returns Promise<VectorizeResult> - SVG output and metadata
 */
export async function vectorize(
  imageData: ImageData,
  options: VectorizeOptions = DEFAULT_OPTIONS,
  onProgress?: (stage: string, value: number) => void
): Promise<VectorizeResult> {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, data } = imageData;
  
  if (isDev) {
    console.log('[vtracer] Starting with options:', opts);
    console.log('[vtracer] Image size:', width, 'x', height);
  }
  
  onProgress?.('Loading WASM', 0);
  
  const wasm = await initWasm();
  
  onProgress?.('Processing', 0.1);
  
  const colorPrecision = Math.max(1, Math.min(8, opts.color_precision));
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
 * Supports: PNG, JPEG, GIF, BMP, WebP, AVIF, HEIC/HEIF
 */
/**
 * Load image from File object with size optimization
 * Supports: PNG, JPEG, GIF, BMP, WebP, AVIF, HEIC/HEIF
 * @param file - File object to load
 * @returns Promise<ImageData> - Processed image data
 */
export async function loadImage(file: File): Promise<ImageData> {
  let imageBlob: Blob = file;
  if (isHeicFile(file)) {
    try {
      imageBlob = await convertHeicToBlob(file);
    } catch (e) {
      throw new Error(`Failed to convert HEIC image: ${e}`);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
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
      
      const imageData = ctx.getImageData(0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(imageData);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. Format may not be supported by your browser.'));
    };
    
    img.src = url;
  });
}

/**
 * Load image from URL with CORS support
 * @param url - Image URL to load
 * @returns Promise<ImageData> - Loaded image data
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
 * Convert SVG string to data URL for embedding
 * @param svg - SVG string to convert
 * @returns string - Base64-encoded data URL
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Download SVG content as a file
 * Creates a temporary download link and triggers download
 * @param svg - SVG content to download
 * @param filename - Output filename (defaults to 'vector.svg')
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

