import Image from "next/image";
import { ImageFile } from "../types";
import { ImageData } from "../types/image";
import { getFullUrl } from "../utils/baseUrl";
import { useState, useEffect, useCallback } from "react";
import { imageQueue } from "../utils/imageQueue";
import { LoadingSpinner } from "./LoadingSpinner";
import { DownloadIcon } from "./ui/icons";

type ImageType = ImageFile | (ImageData & { status: 'success' });

interface ImagePreviewProps {
  image: ImageType;
  priority?: boolean;
  onLoad?: () => void;
  quality?: number;
}

export const ImagePreview = ({ 
  image, 
  priority = false, 
  onLoad,
  quality = 20 
}: ImagePreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [blurDataUrl, setBlurDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 判断图片类型并获取适当的URL
  const isImageFile = 'urls' in image && 'sizes' in image;
  const imageUrl = getFullUrl(
    image.urls?.webp || image.urls?.original || ''
  );
  
  // 获取格式
  const format = isImageFile 
    ? (image as ImageFile).format?.toLowerCase() 
    : (image as ImageData).format?.toLowerCase() || '';

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const loadImage = async () => {
      try {
        // Generate placeholder for non-GIF images
        if (format !== "gif") {
          const placeholder = await generateBlurPlaceholder(imageUrl);
          setBlurDataUrl(placeholder);
        }

        // Add to queue with priority flag
        if (!imageQueue.isPreloaded(imageUrl)) {
          imageQueue.add(imageUrl, priority);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load image");
        setIsLoading(false);
      }
    };

    loadImage();
    return () => {
      setBlurDataUrl(null);
    };
  }, [imageUrl, priority, format]);

  const generateBlurPlaceholder = async (imageUrl: string) => {
    // Generate a more detailed placeholder
    return `data:image/svg+xml;base64,${Buffer.from(
      `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <filter id="b" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect width="100%" height="100%" filter="url(#b)" opacity="0.5"/>
      </svg>`
    ).toString('base64')}`;
  };

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <span>Failed to load image</span>
      </div>
    );
  }

  if (format === "gif") {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <img
          src={imageUrl}
          alt={image.originalName}
          className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleLoadComplete}
          onError={() => setError("Failed to load GIF")}
        />
        <a
          href={imageUrl}
          download={image.originalName}
          className="absolute bottom-4 right-4 bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-full shadow-lg transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}
          title="下载GIF"
        >
          <DownloadIcon className="h-5 w-5" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Image
        src={imageUrl}
        alt={image.originalName || ''}
        fill
        className={`object-contain transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        quality={quality}
        placeholder={blurDataUrl ? "blur" : "empty"}
        blurDataURL={blurDataUrl || undefined}
        onLoadingComplete={handleLoadComplete}
        onError={() => setError("Failed to load image")}
      />
      {isLoading && <LoadingSpinner />}
    </div>
  );
};
