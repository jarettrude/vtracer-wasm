/**
 * VTracer WASM - Type Definitions and Default Options
 * 
 * Core data structures for the vectorization engine including:
 * - Geometric primitives (Point, Path, Color, CubicBezier)
 * - Vectorization configuration options
 * - Default parameters matching the official vtracer webapp
 */

/**
 * 2D point coordinate
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * SVG path data structure
 */
export interface Path {
  points: Point[];
  isHole: boolean;
  colorIndex: number;
}

/**
 * RGBA color representation
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Cubic Bezier curve control points
 */
export interface CubicBezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/**
 * Vectorization processing options
 * Controls how images are converted to SVG paths
 */
export interface VectorizeOptions {
  colormode: 'color' | 'bw';
  mode: 'spline' | 'polygon' | 'pixel';
  filter_speckle: number;
  corner_threshold: number;
  length_threshold: number;
  splice_threshold: number;
  path_precision: number;
  color_precision: number;
  layer_difference: number;
  hierarchical: 'stacked' | 'cutout';
}

/**
 * Default options (RAW values matching WasmConfig expectations).
 * - corner_threshold / splice_threshold: degrees (i32 in WASM)
 * - filter_speckle: raw size threshold (WASM squares internally)
 * - color_precision: raw 1–8 (WASM clamps + inverts internally)
 */
export const DEFAULT_OPTIONS: VectorizeOptions = {
  colormode: 'color',
  mode: 'spline',
  filter_speckle: 4,
  corner_threshold: 60,
  length_threshold: 4.0,
  splice_threshold: 45,
  path_precision: 8,
  color_precision: 6,
  layer_difference: 16,
  hierarchical: 'stacked',
};
