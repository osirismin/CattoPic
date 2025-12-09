'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTags } from '../../hooks/useTags';
import TagList from './TagList';
import TagCreateForm from './TagCreateForm';
import TagEditModal from './TagEditModal';
import TagDeleteConfirm from './TagDeleteConfirm';
import { showToast } from '../ToastContainer';
import { Tag } from '../../types';
import { Spinner, TrashIcon } from '../ui/icons';

export default function TagManagement() {
  const {
    tags,
    isLoading,
    error,
    selectedTags,
    fetchTags,
    createTag,
    renameTag,
    deleteTag,
    deleteTags,
    toggleTagSelection,
    selectAllTags,
    clearSelection,
  } = useTags();

  // 组件挂载时立即刷新标签列表
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 创建标签
  const handleCreate = async (name: string) => {
    setIsProcessing(true);
    const success = await createTag(name);
    setIsProcessing(false);
    if (success) {
      showToast('标签创建成功', 'success');
    } else {
      showToast('标签创建失败', 'error');
    }
    return success;
  };

  // 重命名标签
  const handleRename = async (oldName: string, newName: string) => {
    setIsProcessing(true);
    const success = await renameTag(oldName, newName);
    setIsProcessing(false);
    setEditingTag(null);
    if (success) {
      showToast('标签重命名成功', 'success');
    } else {
      showToast('标签重命名失败', 'error');
    }
  };

  // 删除单个标签
  const handleDelete = async (tag: Tag) => {
    setIsProcessing(true);
    const success = await deleteTag(tag.name);
    setIsProcessing(false);
    setDeletingTag(null);
    if (success) {
      showToast('标签删除成功', 'success');
    } else {
      showToast('标签删除失败', 'error');
    }
  };

  // 批量删除标签
  const handleBatchDelete = async () => {
    setIsProcessing(true);
    const success = await deleteTags(Array.from(selectedTags));
    setIsProcessing(false);
    setShowBatchDeleteConfirm(false);
    if (success) {
      showToast(`成功删除 ${selectedTags.size} 个标签`, 'success');
    } else {
      showToast('批量删除失败', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="h-12 w-12 text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
      >
        {error}
        <button
          onClick={fetchTags}
          className="ml-2 underline hover:no-underline"
        >
          重试
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 创建标签表单 */}
      <TagCreateForm onSubmit={handleCreate} isProcessing={isProcessing} />

      {/* 批量操作栏 */}
      <AnimatePresence>
        {selectedTags.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800"
          >
            <span className="text-indigo-700 dark:text-indigo-300 text-sm font-medium">
              已选择 {selectedTags.size} 个标签
            </span>
            <div className="flex space-x-2">
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消选择
              </button>
              <button
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                <span>批量删除</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 标签列表 */}
      <TagList
        tags={tags}
        selectedTags={selectedTags}
        onToggleSelect={toggleTagSelection}
        onSelectAll={selectAllTags}
        onEdit={setEditingTag}
        onDelete={setDeletingTag}
      />

      {/* 编辑弹窗 */}
      <TagEditModal
        tag={editingTag}
        isOpen={!!editingTag}
        isProcessing={isProcessing}
        onClose={() => setEditingTag(null)}
        onSubmit={handleRename}
      />

      {/* 删除确认 - 单个 */}
      <TagDeleteConfirm
        isOpen={!!deletingTag}
        tagName={deletingTag?.name || ''}
        tagCount={deletingTag?.count || 0}
        isProcessing={isProcessing}
        onCancel={() => setDeletingTag(null)}
        onConfirm={() => deletingTag && handleDelete(deletingTag)}
      />

      {/* 删除确认 - 批量 */}
      <TagDeleteConfirm
        isOpen={showBatchDeleteConfirm}
        tagName={`${selectedTags.size} 个标签`}
        isBatch
        isProcessing={isProcessing}
        onCancel={() => setShowBatchDeleteConfirm(false)}
        onConfirm={handleBatchDelete}
      />
    </div>
  );
}
