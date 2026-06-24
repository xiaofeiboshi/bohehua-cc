import { useState, useRef, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Component as ComponentType, Item } from '../types';
import { useAppStore } from '../store/useAppStore';
import { ItemCard } from './ItemCard';
import { EditDialog } from './EditDialog';
import { cn, isValidUrl, normalizeUrl } from '../lib/utils';
import { GripVertical, Plus, Link, MoreHorizontal, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface ComponentContainerProps {
  component: ComponentType;
  items: Item[];
  onContextMenu: (e: React.MouseEvent, type: 'component' | 'item', id: string) => void;
  isOver?: boolean;
}

export function ComponentContainer({ component, items, onContextMenu, isOver }: ComponentContainerProps) {
  const { fetchAndAddItem, editItem, deleteItem, toggleFavorite } = useAppStore();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  // 折叠状态：key=分组名，value=是否展开
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isComponentDragging,
  } = useSortable({
    id: component.id,
    data: { type: 'component', component, pageId: component.pageId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 快速添加条目（带自动抓取）
  const handleQuickAdd = async () => {
    const url = newUrl.trim();
    if (!url) { setShowNewItemInput(false); return; }
    if (!isValidUrl(normalizeUrl(url))) {
      setShowNewItemInput(false);
      return;
    }
    const cleanUrl = normalizeUrl(url);
    setIsFetching(true);
    setNewUrl('');
    setNewTitle('');
    try {
      await fetchAndAddItem(component.id, cleanUrl);
    } catch {}
    setIsFetching(false);
    setShowNewItemInput(false);
  };

  const handleEdit = (values: Record<string, string>) => {
    if (!editingItem) return;
    editItem(editingItem.id, {
      title: values.title,
      url: values.url,
      description: values.description,
    });
    setEditingItem(null);
  };

  const handleNativeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleNativeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && isValidUrl(normalizeUrl(url))) {
      fetchAndAddItem(component.id, normalizeUrl(url), 'external-drag');
    }
  };

  // 按 group 分组
  const { grouped, ungrouped } = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: Record<string, Item[]> = {};
    const noGroup: Item[] = [];
    sorted.forEach(item => {
      if (item.group) {
        if (!groups[item.group]) groups[item.group] = [];
        groups[item.group].push(item);
      } else {
        noGroup.push(item);
      }
    });
    return { grouped: groups, ungrouped: noGroup };
  }, [items]);

  const allItemIds = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder).map(i => i.id), [items]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const groupNames = Object.keys(grouped).sort();

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-component-id={component.id}
      className={cn(
        'group/component bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-2xl border transition-all duration-200 overflow-hidden',
        isComponentDragging && 'opacity-30',
        isOver && 'ring-2 ring-blue-400 border-blue-400/50 bg-blue-500/5'
      )}
      onDragOver={handleNativeDragOver}
      onDrop={handleNativeDrop}
      onContextMenu={(e) => onContextMenu(e, 'component', component.id)}
    >
      {/* 标题栏 */}
      <div
        {...attributes}
        {...listeners}
        className="drag-handle flex items-center gap-2 px-4 py-3 border-b border-white/10 dark:border-white/5 cursor-grab active:cursor-grabbing select-none hover:bg-white/5 transition-colors"
      >
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <h3 className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {component.title}
        </h3>
        <span className="text-xs text-gray-400 tabular-nums">{items.length}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu(e as any, 'component', component.id); }}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors opacity-0 group-hover/component:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowNewItemInput(true);
            setTimeout(() => urlInputRef.current?.focus(), 100);
          }}
          className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors opacity-0 group-hover/component:opacity-100"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 快速添加输入框 */}
      {showNewItemInput && (
        <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30">
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="输入网址..."
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
                if (e.key === 'Escape') { setShowNewItemInput(false); setNewUrl(''); setNewTitle(''); }
              }}
            />
            <button
              onClick={handleQuickAdd}
              disabled={isFetching}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isFetching ? '抓取中' : '添加'}
            </button>
          </div>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="标题（可选，不填则用域名）"
            className="mt-2 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd();
              if (e.key === 'Escape') { setShowNewItemInput(false); setNewUrl(''); setNewTitle(''); }
            }}
          />
        </div>
      )}

      {/* 条目列表（按分组展示） */}
      <div className="p-2">
        <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
          <div className="min-h-[40px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500">
                <Link className="w-6 h-6 mb-2 opacity-50" />
                <p className="text-xs">从浏览器拖入链接，或点击 + 添加</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* 无分组的条目 */}
                {ungrouped.length > 0 && (
                  <div className="space-y-0.5">
                    {ungrouped.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onDelete={deleteItem}
                        onFavorite={toggleFavorite}
                        onContextMenu={(e, id) => onContextMenu(e, 'item', id)}
                      />
                    ))}
                  </div>
                )}

                {/* 分组的条目 */}
                {groupNames.map(groupName => {
                  const groupItems = grouped[groupName];
                  const isCollapsed = collapsedGroups[groupName];
                  return (
                    <div key={groupName}>
                      {/* 分组标题 */}
                      <div
                        onClick={() => toggleGroup(groupName)}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer select-none rounded-lg hover:bg-white/5 transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{groupName}</span>
                        <span className="text-gray-400 tabular-nums">({groupItems.length})</span>
                      </div>
                      {!isCollapsed && (
                        <div className="space-y-0.5 ml-1 pl-3 border-l border-white/10 dark:border-white/5">
                          {groupItems.map(item => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              onDelete={deleteItem}
                              onFavorite={toggleFavorite}
                              onContextMenu={(e, id) => onContextMenu(e, 'item', id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      {/* 编辑对话框 */}
      {editingItem && (
        <EditDialog
          open={!!editingItem}
          title="编辑条目"
          fields={[
            { key: 'title', label: '标题', type: 'text', required: true },
            { key: 'url', label: '网址', type: 'url', required: true },
            { key: 'description', label: '描述', type: 'textarea', placeholder: '可选描述' },
          ]}
          initialValues={{
            title: editingItem.title,
            url: editingItem.url,
            description: editingItem.description || '',
          }}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
