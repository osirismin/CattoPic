import type { Context } from 'hono';
import type { Env, ImageMetadata, UploadResult } from '../types';
import { StorageService } from '../services/storage';
import { MetadataService } from '../services/metadata';
import { CacheService } from '../services/cache';
import { ImageProcessor } from '../services/imageProcessor';
import { CompressionService, parseCompressionOptions } from '../services/compression';
import { successResponse, errorResponse } from '../utils/response';
import { generateImageId, parseTags, parseNumber } from '../utils/validation';

/**
 * Single file upload handler - processes one image with full parallelization
 * Used by frontend concurrent upload for per-file progress tracking
 */
export async function uploadSingleHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;
    const tagsString = formData.get('tags') as string | null;
    const expiryMinutes = parseNumber(formData.get('expiryMinutes') as string | null, 0);
    const compressionOptions = parseCompressionOptions(formData);

    if (!file || typeof file === 'string') {
      return errorResponse('No file provided');
    }

    const tags = parseTags(tagsString);
    const storage = new StorageService(c.env.R2_BUCKET);
    const metadata = new MetadataService(c.env.DB);
    const compression = c.env.IMAGES ? new CompressionService(c.env.IMAGES) : null;

    // Read file data
    const arrayBuffer = await file.arrayBuffer();

    // Get image info
    const imageInfo = await ImageProcessor.getImageInfo(arrayBuffer);

    if (!ImageProcessor.isSupportedFormat(imageInfo.format)) {
      return errorResponse(`Unsupported format: ${imageInfo.format}`);
    }

    // Generate unique ID and paths
    const id = generateImageId();
    const paths = StorageService.generatePaths(id, imageInfo.orientation, imageInfo.format);
    const contentType = ImageProcessor.getContentType(imageInfo.format);

    const isGif = imageInfo.format === 'gif';
    let webpSize = 0;
    let avifSize = 0;

    // Parallel upload: original + compression (WebP/AVIF)
    if (!isGif && compression) {
      // For non-GIF: upload original and compress in parallel
      const [, compressionResult] = await Promise.all([
        storage.upload(paths.original, arrayBuffer, contentType),
        compression.compress(arrayBuffer, imageInfo.format, compressionOptions),
      ]);

      // Upload compressed versions in parallel
      const uploadPromises: Promise<void>[] = [];

      if (compressionResult.webp) {
        uploadPromises.push(
          storage.upload(paths.webp, compressionResult.webp.data, 'image/webp')
            .then(() => { webpSize = compressionResult.webp!.size; })
        );
      } else {
        uploadPromises.push(
          storage.upload(paths.webp, arrayBuffer, contentType)
            .then(() => { webpSize = file.size; })
        );
      }

      if (compressionResult.avif) {
        uploadPromises.push(
          storage.upload(paths.avif, compressionResult.avif.data, 'image/avif')
            .then(() => { avifSize = compressionResult.avif!.size; })
        );
      } else {
        uploadPromises.push(
          storage.upload(paths.avif, arrayBuffer, contentType)
            .then(() => { avifSize = file.size; })
        );
      }

      await Promise.all(uploadPromises);
    } else if (!isGif) {
      // No compression service: upload original and fallback copies in parallel
      await Promise.all([
        storage.upload(paths.original, arrayBuffer, contentType),
        storage.upload(paths.webp, arrayBuffer, contentType).then(() => { webpSize = file.size; }),
        storage.upload(paths.avif, arrayBuffer, contentType).then(() => { avifSize = file.size; }),
      ]);
    } else {
      // GIF: only upload original
      await storage.upload(paths.original, arrayBuffer, contentType);
    }

    // Calculate expiry time
    let expiryTime: string | undefined;
    if (expiryMinutes > 0) {
      const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
      expiryTime = expiry.toISOString();
    }

    // Create and save metadata
    const imageMetadata: ImageMetadata = {
      id,
      originalName: file.name,
      uploadTime: new Date().toISOString(),
      expiryTime,
      orientation: imageInfo.orientation,
      tags,
      format: imageInfo.format,
      width: imageInfo.width,
      height: imageInfo.height,
      paths,
      sizes: {
        original: file.size,
        webp: webpSize,
        avif: avifSize,
      },
    };

    await metadata.saveImage(imageMetadata);

    // Build result
    const baseUrl = c.env.R2_PUBLIC_URL;
    const result: UploadResult = {
      id,
      status: 'success',
      urls: {
        original: `${baseUrl}/${paths.original}`,
        webp: isGif ? '' : `${baseUrl}/${paths.webp}`,
        avif: isGif ? '' : `${baseUrl}/${paths.avif}`,
      },
      orientation: imageInfo.orientation,
      tags,
      sizes: imageMetadata.sizes,
      expiryTime,
      format: imageInfo.format,
    };

    // Invalidate caches (non-blocking)
    const cache = new CacheService(c.env.CACHE_KV);
    c.executionCtx.waitUntil(
      Promise.all([
        cache.invalidateImagesList(),
        cache.invalidateTagsList(),
      ])
    );

    return successResponse({ result });
  } catch (err) {
    console.error('Single upload error:', err);
    return errorResponse('Upload failed');
  }
}
