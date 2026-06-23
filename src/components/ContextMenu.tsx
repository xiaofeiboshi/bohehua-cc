import { useEffect, useRef } from 'react';
import type { ContextMenuState } from '../types';
import { cn } from '../lib/utils';

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onAction: (action: string, targetType: string, targetId: string | null) => void;
}

const MENU_ITEMS: Record<string, Array<{ action: string; label: string; danger?: boolean }>> = {
  page: [
    { action: 'rename-page', label: '重命名' },
    { action: 'add-component', label: '添加组件' },
    { action: 'add-page', label: '添加分页' },
    { action: 'delete-page', label: '删除分页', danger: true },
  ],
  component: [
    { action: 'rename-component', label: '重命名' },
    { action: 'add-item', label: '添加条目' },
    { action: 'paste-link', label: '从剪贴板导入链接' },
    { action: 'delete-component', label: '删除组件', danger: true },
  ],
  item: [
    { action: 'open-link', label: '在新标签页打开' },
    { action: 'copy-link', label: '复制链接' },
    { action: 'edit-item', label: '编辑条目' },
    { action: 'toggle-favorite', label: '收藏/取消收藏' },
    { action: 'delete-item', label: '删除条目', danger: true },
  ],
  empty: [
    { action: 'add-component', label: '添加组件' },
    { action: 'paste-link', label: '粘贴链接' },
  ],
};

export function ContextMenu({ menu, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!menu.show) return null;

  const items = MENU_ITEMS[menu.targetType] || [];

  // 调整菜单位置，避免溢出屏幕
  const adjustedX = Math.min(menu.x, window.innerWidth - 200);
  const adjustedY = Math.min(menu.y, window.innerHeight - items.length * 40 - 20);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[180px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {items.map((item) => (
          <button
            key={item.action}
            onClick={() => {
              onAction(item.action, menu.targetType, menu.targetId);
              onClose();
            }}
            className={cn(
              'w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2',
              item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
