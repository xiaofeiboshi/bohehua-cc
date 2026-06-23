import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item } from '../types';
import { getDomainFromUrl, getFaviconUrl, cn } from '../lib/utils';
import { ExternalLink, GripVertical, Heart, Trash2 } from 'lucide-react';

interface ItemCardProps {
  item: Item;
  onDelete?: (itemId: string) => void;
  onFavorite?: (itemId: string) => void;
  onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

export function ItemCard({ item, onDelete, onFavorite, onContextMenu }: ItemCardProps) {
  const [imgError, setImgError] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'item', item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 优先使用自动抓取的图标，其次用 Google Favicon 服务
  const favicon = item.icon || getFaviconUrl(item.url);
  const domain = getDomainFromUrl(item.url);

  const handleClick = (e: React.MouseEvent) => {
    // 如果不是点击了操作按钮，就在新标签页打开
    if ((e.target as HTMLElement).closest('.item-action')) return;
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150',
        'hover:bg-gray-100 dark:hover:bg-gray-700/50',
        'border border-transparent hover:border-gray-200 dark:hover:border-gray-600',
        isDragging && 'opacity-40 shadow-lg scale-95'
      )}
      onContextMenu={(e) => onContextMenu?.(e, item.id)}
      onClick={handleClick}
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="item-action cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* 图标 */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {favicon && !imgError ? (
          <img
            src={favicon}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {item.title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* 标题和域名 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">
          {item.title}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
          {domain}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="item-action flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(item.id); }}
            className={cn(
              'p-1 rounded transition-colors',
              item.isFavorite
                ? 'text-red-500 hover:text-red-600'
                : 'text-gray-400 hover:text-red-400'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', item.isFavorite && 'fill-current')} />
          </button>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded text-gray-400 hover:text-blue-500 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
