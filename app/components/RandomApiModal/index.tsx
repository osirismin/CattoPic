'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cross1Icon, Link2Icon } from '../ui/icons';
import { useTags } from '../../hooks/useTags';
import TagSelector from './TagSelector';
import OrientationSelector from './OrientationSelector';
import FormatSelector from './FormatSelector';
import LinkOutput from './LinkOutput';

interface RandomApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type Orientation = 'auto' | 'landscape' | 'portrait';
export type Format = 'auto' | 'original' | 'webp' | 'avif';

export default function RandomApiModal({ isOpen, onClose }: RandomApiModalProps) {
  const { tags, isLoading } = useTags();

  // 状态管理
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [format, setFormat] = useState<Format>('auto');
  const [baseUrl, setBaseUrl] = useState<string>(
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_WORKER_URL ||
    ''
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        if (!res.ok) return;
        const config = await res.json() as { apiUrl?: string };
        if (!cancelled && config.apiUrl) {
          setBaseUrl(config.apiUrl);
        }
      } catch {
      }
    };

    void fetchConfig();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 构建 URL
  const generatedUrl = useMemo(() => {
    const resolvedBase = baseUrl || 'https://your-worker.workers.dev';
    const url = new URL('/api/random', resolvedBase);

    if (includeTags.length > 0) {
      url.searchParams.set('tags', includeTags.join(','));
    }
    if (excludeTags.length > 0) {
      url.searchParams.set('exclude', excludeTags.join(','));
    }
    if (orientation !== 'auto') {
      url.searchParams.set('orientation', orientation);
    }
    if (format !== 'auto') {
      url.searchParams.set('format', format);
    }

    return url.toString();
  }, [baseUrl, includeTags, excludeTags, orientation, format]);

  // 切换包含标签
  const toggleIncludeTag = (tagName: string) => {
    setIncludeTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName);
      }
      // 如果在排除列表中，先移除
      setExcludeTags(ex => ex.filter(t => t !== tagName));
      return [...prev, tagName];
    });
  };

  // 切换排除标签
  const toggleExcludeTag = (tagName: string) => {
    setExcludeTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName);
      }
      // 如果在包含列表中，先移除
      setIncludeTags(inc => inc.filter(t => t !== tagName));
      return [...prev, tagName];
    });
  };

  // 重置所有选项
  const resetAll = () => {
    setIncludeTags([]);
    setExcludeTags([]);
    setOrientation('auto');
    setFormat('auto');
  };

  if (!isOpen) return null;

  const tagNames = tags.map(t => t.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden"
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3 rounded-full mr-4">
                  <Link2Icon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">随机图 API 生成器</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetAll}
                  className="px-3 py-1.5 text-sm rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  重置
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Cross1Icon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : (
                <>
                  {/* 标签选择器 */}
                  <TagSelector
                    availableTags={tagNames}
                    includeTags={includeTags}
                    excludeTags={excludeTags}
                    onToggleInclude={toggleIncludeTag}
                    onToggleExclude={toggleExcludeTag}
                  />

                  {/* 方向选择器 */}
                  <OrientationSelector
                    value={orientation}
                    onChange={setOrientation}
                  />

                  {/* 格式选择器 */}
                  <FormatSelector
                    value={format}
                    onChange={setFormat}
                  />

                  {/* 链接输出 */}
                  <LinkOutput url={generatedUrl} />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
