import { getFullUrl } from "./baseUrl";
import type { ImageFile } from "../types";

/**
 * 复制文本到剪贴板
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // 优先使用 Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // 后备方案：使用传统的 document.execCommand 方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 防止滚动
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      console.error("复制失败:", err);
      return false;
    }
  } catch (err) {
    console.error("复制失败:", err);
    return false;
  }
};

/**
 * 构建Markdown图片链接
 */
export const buildMarkdownLink = (url: string, altText: string): string => {
  return `![${altText}](${url})`;
};

/**
 * 构建HTML图片标签
 */
export const buildHtmlImgTag = (url: string, altText: string): string => {
  return `<img src="${url}" alt="${altText}" />`;
};

/**
 * 复制图片链接（原始格式）
 */
export const copyOriginalUrl = async (image: ImageFile): Promise<boolean> => {
  const url = getFullUrl(image.urls?.original || '');
  return copyToClipboard(url);
};

/**
 * 复制图片链接（WebP格式）
 */
export const copyWebpUrl = async (image: ImageFile): Promise<boolean> => {
  const url = getFullUrl(image.urls?.webp || '');
  return copyToClipboard(url);
};

/**
 * 复制图片链接（AVIF格式）
 */
export const copyAvifUrl = async (image: ImageFile): Promise<boolean> => {
  const url = getFullUrl(image.urls?.avif || '');
  return copyToClipboard(url);
};

/**
 * 复制Markdown格式的图片链接
 */
export const copyMarkdownLink = async (image: ImageFile): Promise<boolean> => {
  // 优先使用WebP链接
  const url = getFullUrl(image.urls?.webp || image.urls?.original || '');
  const markdown = buildMarkdownLink(url, image.originalName);
  return copyToClipboard(markdown);
};

/**
 * 复制HTML格式的图片标签
 */
export const copyHtmlImgTag = async (image: ImageFile): Promise<boolean> => {
  // 优先使用WebP链接
  const url = getFullUrl(image.urls?.webp || image.urls?.original || '');
  const html = buildHtmlImgTag(url, image.originalName);
  return copyToClipboard(html);
};
