import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Page } from '../types';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

interface PageTabProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, pageId: string) => void;
  onDelete: (pageId: string) => void;
}

function PageTab({ page, isActive, onClick, onContextMenu, onDelete }: PageTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: page.id,
    data: { type: 'page', page },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, page.id)}
      className={cn(
        'group flex items-center gap-2 px-4 py-2 text-sm rounded-xl cursor-pointer select-none transition-all duration-150 border',
        isActive
          ? 'bg-white/20 dark:bg-white/15 text-white border-white/20 shadow-sm font-medium'
          : 'text-white/70 hover:text-white hover:bg-white/10 border-transparent'
      )}
    >
      <span className="truncate max-w-[120px]">{page.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(page.id);
        }}
        className={cn(
          'p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
          'text-white/50 hover:text-white hover:bg-white/20'
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface PageBarProps {
  pages: Page[];
  currentPageId: string | null;
  onContextMenu: (e: React.MouseEvent, type: 'page' | 'empty', id: string | null) => void;
}

export function PageBar({ pages, currentPageId, onContextMenu }: PageBarProps) {
  const { addPage, setCurrentPage, deletePage } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newPageName, setNewPageName] = useState('');

  const sortedPages = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddPage = () => {
    if (isAdding && newPageName.trim()) {
      addPage(newPageName.trim());
      setNewPageName('');
      setIsAdding(false);
    } else {
      setIsAdding(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (newPageName.trim()) {
        addPage(newPageName.trim());
        setNewPageName('');
        setIsAdding(false);
      }
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewPageName('');
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-1"
      onContextMenu={(e) => onContextMenu(e, 'empty', null)}
    >
      {sortedPages.map((page) => (
        <PageTab
          key={page.id}
          page={page}
          isActive={page.id === currentPageId}
          onClick={() => setCurrentPage(page.id)}
          onContextMenu={(e, id) => onContextMenu(e, 'page', id)}
          onDelete={deletePage}
        />
      ))}

      {/* 添加分页按钮 */}
      <div className="flex items-center gap-1">
        {isAdding ? (
          <input
            type="text"
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!newPageName.trim()) setIsAdding(false); }}
            placeholder="分页名称"
            className="w-24 px-3 py-1.5 text-sm rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/40"
            autoFocus
          />
        ) : (
          <button
            onClick={handleAddPage}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/20"
          >
            <Plus className="w-4 h-4" />
            <span>新增</span>
          </button>
        )}
      </div>
    </div>
  );
}
