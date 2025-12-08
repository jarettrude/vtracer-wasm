/**
 * VTracer WASM - TypeScript Environment Definitions
 * 
 * Ambient type declarations for Vite/Astro environment variables.
 * Extends ImportMetaEnv and ImportMeta with build-time environment
 * variable typing for development and production configurations.
 */

/// <reference types="astro/client" />
/**
 * Environment variable interface for build-time configuration
 * Extends standard ImportMetaEnv with custom environment variables
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
}

/**
 * Import meta interface with environment variable access
 * Provides typed access to import.meta.env properties
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
