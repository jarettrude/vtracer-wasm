/**
 * HEIC2ANY Library TypeScript Definitions
 * 
 * Type declarations for the heic2any library which provides
 * HEIC/HEIF to PNG/JPEG conversion in the browser. Supports
 * blob conversion with quality and format options.
 */

declare module 'heic2any' {
  /**
   * Conversion options for HEIC/HEIF processing
   * Controls output format, quality, and conversion behavior
   */
  export interface Heic2AnyOptions {
    blob: Blob;
    toType?: string;
    quality?: number;
    multiple?: boolean;
  }

  /**
   * Convert HEIC/HEIF files to browser-compatible formats.
   * Object-form overload, matching usage in vectorizer.ts:
   *   heic2any({ blob, toType, quality })
   */
  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;

  /**
   * Convert HEIC/HEIF files to browser-compatible formats.
   * Positional overload for the library's documented API:
   *   heic2any(blob, { toType, quality })
   */
  export default function heic2any(
    blob: Blob,
    options?: Omit<Heic2AnyOptions, 'blob'>
  ): Promise<Blob | Blob[]>;
}
