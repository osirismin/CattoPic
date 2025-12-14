// Image Compression Service using Cloudflare Images binding
import type {
  ImagesBinding,
  CompressionOptions,
  CompressedImage,
  CompressionResult,
} from '../types';
import { ImageProcessor } from './imageProcessor';

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  quality: 90,
  maxWidth: 3840,
  maxHeight: 3840,
  preserveAnimation: true,
  generateWebp: true,
  generateAvif: true,
};

export class CompressionService {
  private images: ImagesBinding;

  constructor(images: ImagesBinding) {
    this.images = images;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableTransformError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    return (
      lower.includes('network connection lost') ||
      lower.includes('connection lost') ||
      lower.includes('fetch failed') ||
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('econnreset') ||
      lower.includes('eai_again') ||
      lower.includes('temporar')
    );
  }

  private async withRetry<T>(
    label: string,
    fn: () => Promise<T>,
    options?: { attempts?: number; baseDelayMs?: number }
  ): Promise<T> {
    const attempts = options?.attempts ?? 3;
    const baseDelayMs = options?.baseDelayMs ?? 120;

    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt >= attempts || !this.isRetryableTransformError(err)) {
          throw err;
        }
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`${label} attempt ${attempt} failed (retrying in ${delayMs}ms):`, err);
        await this.sleep(delayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Compress image to WebP and AVIF formats
   */
  async compress(
    data: ArrayBuffer,
    format: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check for animated GIF
    const isAnimated = format === 'gif' && this.isAnimatedGif(data);

    // Skip compression for animated GIFs if preserveAnimation is true
    if (isAnimated && opts.preserveAnimation) {
      return { original: data, isAnimated: true };
    }

    const result: CompressionResult = { original: data, isAnimated: false };

    // Get original dimensions
    const { width, height } = await ImageProcessor.getImageDimensions(data);

    // Calculate target dimensions
    const targetDims = this.calculateDimensions(
      width,
      height,
      opts.maxWidth,
      opts.maxHeight
    );

    // AVIF dimensions (with 1600px max while preserving aspect ratio)
    const avifDims = this.calculateDimensions(
      width,
      height,
      Math.min(opts.maxWidth, 1600),
      Math.min(opts.maxHeight, 1600)
    );

    // Generate WebP first; AVIF is more failure-prone, so run after WebP to reduce concurrent load.
    const webpResult = opts.generateWebp
      ? await this.withRetry('WebP compression', () => this.compressToFormat(data, 'image/webp', opts.quality, targetDims), { attempts: 2 })
        .catch((e) => {
          console.error('WebP compression failed:', e);
          return null;
        })
      : null;

    const avifResult = opts.generateAvif
      ? await this.withRetry('AVIF compression', () => this.compressToFormat(data, 'image/avif', opts.quality, avifDims), { attempts: 3 })
        .catch((e) => {
          console.error('AVIF compression failed:', e);
          return null;
        })
      : null;

    if (webpResult) result.webp = webpResult;
    if (avifResult) result.avif = avifResult;

    return result;
  }

  /**
   * Compress image to specific format
   */
  private async compressToFormat(
    data: ArrayBuffer,
    format: 'image/webp' | 'image/avif',
    quality: number,
    dimensions: { width: number; height: number }
  ): Promise<CompressedImage> {
    const transformer = this.images.input(data);

    const output = await transformer
      .transform({
        width: dimensions.width,
        height: dimensions.height,
        fit: 'scale-down',
      })
      .output({
        format,
        quality,
      });

    const response = output.response();
    const compressedData = await response.arrayBuffer();

    return {
      data: compressedData,
      contentType: output.contentType(),
      size: compressedData.byteLength,
    };
  }

  /**
   * Calculate target dimensions while maintaining aspect ratio
   */
  private calculateDimensions(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    const scale = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  /**
   * Detect if GIF is animated (has multiple frames)
   */
  private isAnimatedGif(data: ArrayBuffer): boolean {
    const bytes = new Uint8Array(data);
    let frameCount = 0;

    // Look for multiple Graphic Control Extensions (0x21 0xF9) or Image Descriptors (0x2C)
    for (let i = 0; i < bytes.length - 1; i++) {
      // Graphic Control Extension
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
        frameCount++;
        if (frameCount > 1) return true;
      }
      // Image Descriptor
      if (bytes[i] === 0x2C) {
        frameCount++;
        if (frameCount > 1) return true;
      }
    }

    return false;
  }
}

/**
 * Parse compression options from FormData
 */
export function parseCompressionOptions(formData: FormData): CompressionOptions {
  const parseNumber = (value: string | null, defaultValue: number): number => {
    if (!value) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  };

  return {
    quality: parseNumber(formData.get('quality') as string | null, DEFAULT_OPTIONS.quality),
    maxWidth: parseNumber(formData.get('maxWidth') as string | null, DEFAULT_OPTIONS.maxWidth),
    maxHeight: parseNumber(formData.get('maxHeight') as string | null, DEFAULT_OPTIONS.maxHeight),
    preserveAnimation: formData.get('preserveAnimation') !== 'false',
    generateWebp: formData.get('generateWebp') === null
      ? DEFAULT_OPTIONS.generateWebp
      : formData.get('generateWebp') !== 'false',
    generateAvif: formData.get('generateAvif') === null
      ? DEFAULT_OPTIONS.generateAvif
      : formData.get('generateAvif') !== 'false',
  };
}
