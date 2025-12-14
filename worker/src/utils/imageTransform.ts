import type { CompressionOptions, ImageMetadata } from '../types';

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  quality: 90,
  maxWidth: 0,
  maxHeight: 0,
  preserveAnimation: true,
  generateWebp: true,
  generateAvif: true,
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.trunc(num));
}

function buildPublicUrl(baseUrl: string, key: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
  return new URL(normalizedKey, base).toString();
}

function calculateDimensions(
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

function buildCdnCgiOptionsString(options: {
  format: 'webp' | 'avif';
  quality: number;
  width?: number;
  height?: number;
  fit?: 'scale-down';
}): string {
  const parts: string[] = [
    `format=${options.format}`,
    `quality=${clampInt(options.quality, 1, 100)}`,
  ];

  if (options.width && options.height) {
    parts.push(`width=${options.width}`);
    parts.push(`height=${options.height}`);
    parts.push(`fit=${options.fit || 'scale-down'}`);
  }

  return parts.join(',');
}

function buildTransformedUrl(originalUrl: string, optionsString: string): string {
  const url = new URL(originalUrl);
  return `${url.origin}/cdn-cgi/image/${optionsString}${url.pathname}${url.search}`;
}

export function buildImageUrls(params: {
  baseUrl: string;
  image: Pick<ImageMetadata, 'format' | 'width' | 'height' | 'paths'>;
  options?: CompressionOptions;
  preferStoredVariants?: boolean;
}): { original: string; webp: string; avif: string } {
  const { baseUrl, image, options, preferStoredVariants = true } = params;
  const opts: Required<CompressionOptions> = { ...DEFAULT_OPTIONS, ...(options || {}) };

  const originalUrl = buildPublicUrl(baseUrl, image.paths.original);

  const formatLower = (image.format || '').toLowerCase();
  const isGif = formatLower === 'gif';
  if (isGif) {
    return { original: originalUrl, webp: '', avif: '' };
  }

  const canTransformFromOriginal =
    formatLower === 'jpeg' || formatLower === 'jpg' || formatLower === 'png';

  const generateWebp = opts.generateWebp !== false;
  const generateAvif = opts.generateAvif !== false;

  const isWebpMarker = !!image.paths.webp
    && image.paths.webp === image.paths.original
    && formatLower !== 'webp';
  const isAvifMarker = !!image.paths.avif
    && image.paths.avif === image.paths.original
    && formatLower !== 'avif';

  const webpStored = preferStoredVariants && image.paths.webp && !isWebpMarker
    ? buildPublicUrl(baseUrl, image.paths.webp)
    : '';
  const avifStored = preferStoredVariants && image.paths.avif && !isAvifMarker
    ? buildPublicUrl(baseUrl, image.paths.avif)
    : '';

  const quality = clampInt(toPositiveInt(opts.quality, DEFAULT_OPTIONS.quality), 1, 100);
  const maxWidth = toPositiveInt(opts.maxWidth, DEFAULT_OPTIONS.maxWidth);
  const maxHeight = toPositiveInt(opts.maxHeight, DEFAULT_OPTIONS.maxHeight);
  const hasResizeLimit = maxWidth > 0 && maxHeight > 0;

  const webpUrl = (() => {
    if (!generateWebp) return '';
    if (webpStored) return webpStored;
    if (formatLower === 'webp') return originalUrl;
    if (!canTransformFromOriginal) return '';

    const dims = hasResizeLimit
      ? calculateDimensions(image.width, image.height, maxWidth, maxHeight)
      : undefined;

    const optionsString = buildCdnCgiOptionsString({
      format: 'webp',
      quality,
      width: dims?.width,
      height: dims?.height,
      fit: dims ? 'scale-down' : undefined,
    });

    return buildTransformedUrl(originalUrl, optionsString);
  })();

  const avifUrl = (() => {
    if (!generateAvif) return '';
    if (avifStored) return avifStored;
    if (formatLower === 'avif') return originalUrl;
    if (!canTransformFromOriginal) return '';

    const dims = hasResizeLimit
      ? calculateDimensions(image.width, image.height, maxWidth, maxHeight)
      : undefined;

    const optionsString = buildCdnCgiOptionsString({
      format: 'avif',
      quality,
      width: dims?.width,
      height: dims?.height,
      fit: dims ? 'scale-down' : undefined,
    });

    return buildTransformedUrl(originalUrl, optionsString);
  })();

  return { original: originalUrl, webp: webpUrl, avif: avifUrl };
}
