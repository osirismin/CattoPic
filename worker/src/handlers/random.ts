import type { Context } from 'hono';
import type { Env } from '../types';
import { MetadataService } from '../services/metadata';
import { errorResponse } from '../utils/response';
import { parseTags, isMobileDevice, getBestFormat } from '../utils/validation';
import { buildImageUrls } from '../utils/imageTransform';

// GET /api/random - Get random image (PUBLIC - no auth required)
export async function randomHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const url = new URL(c.req.url);

    // Parse query parameters
    const tagsParam = url.searchParams.get('tags');
    const excludeParam = url.searchParams.get('exclude');
    const orientationParam = url.searchParams.get('orientation');
    const formatParam = url.searchParams.get('format');

    const tags = parseTags(tagsParam);
    const exclude = parseTags(excludeParam);

    // Determine orientation (default to auto-detect based on device)
    let orientation: string | undefined;
    if (orientationParam === 'landscape' || orientationParam === 'portrait') {
      orientation = orientationParam;
    } else {
      // Default: auto-detect based on user agent
      const userAgent = c.req.header('User-Agent');
      orientation = isMobileDevice(userAgent) ? 'portrait' : 'landscape';
    }

    // Get random image metadata
    const metadata = new MetadataService(c.env.DB);
    const image = await metadata.getRandomImage({
      tags: tags.length > 0 ? tags : undefined,
      exclude: exclude.length > 0 ? exclude : undefined,
      orientation
    });

    if (!image) {
      return errorResponse('No images found matching criteria', 404);
    }

    const baseUrl = c.env.R2_PUBLIC_URL;
    const urls = buildImageUrls({
      baseUrl,
      image,
      options: {
        generateWebp: !!image.paths.webp,
        generateAvif: !!image.paths.avif,
      },
    });

    let targetUrl: string;

    if (image.format === 'gif') {
      // Always serve original for GIF
      targetUrl = urls.original;
    } else {
      // Determine best format based on Accept header or explicit format param
      if (formatParam === 'original') {
        targetUrl = urls.original;
      } else if (formatParam === 'webp') {
        targetUrl = urls.webp || urls.original;
      } else if (formatParam === 'avif') {
        targetUrl = urls.avif || urls.original;
      } else {
        const acceptHeader = c.req.header('Accept');
        const best = getBestFormat(acceptHeader);
        if (best === 'avif' && urls.avif) {
          targetUrl = urls.avif;
        } else if (best === 'webp' && urls.webp) {
          targetUrl = urls.webp;
        } else {
          targetUrl = urls.original;
        }
      }
    }

    if (!targetUrl) {
      return errorResponse('Image file not found', 404);
    }

    // Redirect instead of proxying: avoids fetching transformed URLs from within the Worker.
    return new Response(null, {
      status: 302,
      headers: {
        Location: targetUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('Random handler error:', err);
    return errorResponse('Failed to get random image');
  }
}
