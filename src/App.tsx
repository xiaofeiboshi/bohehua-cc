import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAppStore } from './store/useAppStore';
import { PageBar } from './components/PageBar';
import { ComponentContainer } from './components/ComponentContainer';
import { ContextMenu } from './components/ContextMenu';
import { EditDialog } from './components/EditDialog';
import { AuthModal } from './components/AuthModal';
import { BookmarkImport } from './components/BookmarkImport';
import type { ContextMenuState, ContextMenuTarget } from './types';
import { isValidUrl, normalizeUrl } from './lib/utils';
import { Bookmark, Columns2, Image, LogIn, LogOut, Upload } from 'lucide-react';

function getDropTargetFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const componentEl = el.closest('[data-component-id]');
  return componentEl?.getAttribute('data-component-id') || null;
}

const BING_URL = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';
const GRADIENT_BG = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';

const PRESET_BACKGROUNDS = [
  { name: '渐变暗色', value: GRADIENT_BG },
  { name: '渐变紫蓝', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: '渐变暖橙', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: '渐变森林', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Bing 每日壁纸', value: 'bing' },
];

function App() {
  const {
    pages, components, items, currentPageId,
    addPage, renamePage, deletePage, setPageColumns, setPageBackground,
    addComponent, renameComponent, deleteComponent,
    addItem, fetchAndAddItem, moveItem, copyItem, deleteItem,
    reorderItems, reorderComponents, reorderPages,
    initAuth, signOut,
    isAuthenticated, isAuthLoading, userEmail,
  } = useAppStore();

  // ===== 认证 =====
  const [showAuthModal, setShowAuthModal] = useState(false);
  // ===== 书签导入 =====
  const [showBookmarkImport, setShowBookmarkImport] = useState(false);

  // 初始化认证
  useEffect(() => { initAuth(); }, [initAuth]);

  // ===== 拖拽状态 =====
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [activeItemData, setActiveItemData] = useState<typeof items[0] | null>(null);
  const [dropTargetComponentId, setDropTargetComponentId] = useState<string | null>(null);

  // ===== 右键菜单 =====
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false, x: 0, y: 0, targetType: 'empty', targetId: null,
  });

  // ===== 重命名对话框 =====
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean; title: string; targetType: ContextMenuTarget; targetId: string | null; currentName: string;
  }>({ open: false, title: '', targetType: 'empty', targetId: null, currentName: '' });

  // ===== Bing 壁纸 =====
  const [bingBg, setBingBg] = useState<string>('');

  // ===== 背景/列数选择器 =====
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // ===== 外部拖入 =====
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== 传感器 =====
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ===== 当前页面数据 =====
  const currentPage = pages.find(p => p.id === currentPageId);
  const pageComponents = components
    .filter(c => c.pageId === currentPageId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const getComponentItems = useCallback(
    (componentId: string) => items.filter(i => i.componentId === componentId),
    [items]
  );

  // ===== Bing 壁纸 =====
  useEffect(() => {
    fetch(BING_URL)
      .then(r => r.json())
      .then(data => {
        if (data?.images?.[0]?.url) {
          setBingBg(`https://www.bing.com${data.images[0].url}`);
        }
      })
      .catch(() => {});
  }, []);

  // ===== 背景样式 =====
  const getBgStyle = (): React.CSSProperties => {
    if (!currentPage) return { background: GRADIENT_BG };
    const bg = currentPage.background;
    if (!bg || bg === GRADIENT_BG) return { background: GRADIENT_BG };
    if (bg === 'bing' && bingBg) {
      return { backgroundImage: `url(${bingBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' };
    }
    if (bg.startsWith('http')) {
      return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' };
    }
    return { background: bg };
  };

  // ===== 右键菜单 =====
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, type: ContextMenuTarget, id: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ show: true, x: e.clientX, y: e.clientY, targetType: type, targetId: id });
    },
    []
  );

  const handleContextAction = useCallback(
    (action: string, _targetType: string, targetId: string | null) => {
      switch (action) {
        case 'rename-page': {
          const p = pages.find(x => x.id === targetId);
          if (p) setRenameDialog({ open: true, title: '重命名分页', targetType: 'page', targetId, currentName: p.title });
          break;
        }
        case 'rename-component': {
          const c = components.find(x => x.id === targetId);
          if (c) setRenameDialog({ open: true, title: '重命名组件', targetType: 'component', targetId, currentName: c.title });
          break;
        }
        case 'add-page': addPage(); break;
        case 'add-component': if (currentPageId) addComponent(currentPageId); break;
        case 'delete-page': if (targetId) deletePage(targetId); break;
        case 'delete-component': if (targetId) { deleteComponent(targetId); } break;
        case 'delete-item': if (targetId) deleteItem(targetId); break;
        case 'toggle-favorite': if (targetId) useAppStore.getState().toggleFavorite(targetId); break;
        case 'open-link': {
          const it = items.find(i => i.id === targetId);
          if (it?.url) window.open(it.url, '_blank');
          break;
        }
        case 'copy-link': {
          const it = items.find(i => i.id === targetId);
          if (it?.url) navigator.clipboard.writeText(it.url);
          break;
        }
        case 'paste-link': {
          if (!targetId && currentPageId) {
            const firstComp = pageComponents[0];
            if (firstComp) {
              navigator.clipboard.readText().then(text => {
                if (text && isValidUrl(normalizeUrl(text))) {
                  fetchAndAddItem(firstComp.id, normalizeUrl(text), 'manual');
                }
              }).catch(() => {});
            }
          }
          break;
        }
      }
    },
    [pages, components, items, currentPageId, pageComponents, addPage, addComponent, deletePage, deleteItem, fetchAndAddItem]
  );

  // ===================================================================
  // ===== 拖拽核心：多容器 Sortable（条目 ↔ 组件 ↔ 分页） =====
  // ===================================================================

  // ===== 书签导入处理（带撤销功能） =====
  const [undoImport, setUndoImport] = useState<{
    pageIds: string[];
    totalCount: number;
  } | null>(null);
  const undoImportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBookmarkImport = useCallback(
    (importPages: Array<{
      name: string;
      components: Array<{ name: string; items: Array<{ title: string; url: string; group?: string }> }>;
      directItems: Array<{ title: string; url: string }>;
    }>) => {
      const createdPageIds: string[] = [];
      let totalItems = 0;

      importPages.forEach(importPage => {
        // 创建分页
        const newPageId = addPage(importPage.name);
        createdPageIds.push(newPageId);

        // 处理直接放在一级下的书签 → 创建"默认"组件
        if (importPage.directItems.length > 0) {
          const defaultCompId = addComponent(newPageId, '默认');
          importPage.directItems.forEach(item => {
            addItem(defaultCompId, item.title, item.url, '', 'manual');
            totalItems++;
          });
        }

        // 处理二级文件夹 → 创建组件
        importPage.components.forEach(comp => {
          const compId = addComponent(newPageId, comp.name);
          comp.items.forEach(item => {
            addItem(compId, item.title, item.url, '', 'manual', item.group);
            totalItems++;
          });
        });
      });

      if (undoImportTimer.current) clearTimeout(undoImportTimer.current);
      setUndoImport({ pageIds: createdPageIds, totalCount: totalItems });
    },
    [addPage, addComponent, addItem]
  );

  const handleUndoImport = () => {
    if (!undoImport) return;
    // 删除创建的分页（级联删除所有组件和条目）
    undoImport.pageIds.forEach(id => deletePage(id));
    setUndoImport(null);
  };

  // --- 从 active/over 的 data 中提取组件ID ---
  const getComponentIdFromData = (data: any): string | null => {
    if (!data) return null;
    if (data.type === 'item') return data.item?.componentId || null;
    if (data.type === 'component') return data.component?.id || null;
    return null;
  };

  // --- 拖拽开始 ---
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    setActiveDragType(data?.type || null);
    if (data?.type === 'item') {
      setActiveItemData(data.item);
    } else {
      setActiveItemData(null);
    }
  };

  // --- 拖拽悬停（关键：跨容器检测 + 视觉效果） ---
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDropTargetComponentId(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // 只在拖拽条目时处理跨容器
    if (activeData?.type !== 'item') return;

    const activeCompId = activeData.item?.componentId;
    const overCompId = getComponentIdFromData(overData);

    // 检测悬停到的组件
    let targetCompId: string | null = null;

    if (overCompId) {
      targetCompId = overCompId;
    } else if (overData?.type === 'component-drop') {
      // 兼容旧数据格式（如果有遗留数据）
      targetCompId = overData.componentId;
    }

    if (targetCompId) {
      // 如果是当前条目自己所在的组件，不显示高亮
      const isSameContainer = activeCompId === targetCompId;
      setDropTargetComponentId(isSameContainer ? null : targetCompId);
    } else {
      setDropTargetComponentId(null);
    }
  };

  // --- 拖拽结束（执行移动/排序） ---
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current;
    const overData = over?.data?.current || null;

    // 清理拖拽状态
    setActiveDragType(null);
    setActiveItemData(null);
    setDropTargetComponentId(null);

    if (!over) return;
    if (active.id === over.id) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;
    const shiftKey = event.activatorEvent instanceof MouseEvent && event.activatorEvent.shiftKey;

    // ========== 场景 1：条目拖拽 ==========
    if (activeData?.type === 'item') {
      const item = activeData.item;
      const activeCompId = item.componentId;
      const overCompId = getComponentIdFromData(overData);

      // 跨组件移动
      if (overCompId && overCompId !== activeCompId) {
        if (shiftKey) {
          copyItem(activeStr, overCompId);
        } else {
          moveItem(activeStr, overCompId);
        }
        return;
      }

      // 同组件内排序（发生在两个条目之间）
      if (overData?.type === 'item') {
        const overItem = overData.item;
        if (item.componentId === overItem.componentId) {
          const compItems = items
            .filter(i => i.componentId === item.componentId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const oldIdx = compItems.findIndex(i => i.id === activeStr);
          const newIdx = compItems.findIndex(i => i.id === overStr);
          if (oldIdx !== -1 && newIdx !== -1) {
            const [moved] = compItems.splice(oldIdx, 1);
            compItems.splice(newIdx, 0, moved);
            reorderItems(item.componentId, compItems.map(i => i.id));
          }
          return;
        }
      }

      return;
    }

    // ========== 场景 2：组件拖拽排序 ==========
    if (activeData?.type === 'component') {
      const comps = pageComponents;
      const oldIdx = comps.findIndex(c => c.id === activeStr);
      const newIdx = comps.findIndex(c => c.id === overStr);
      if (oldIdx !== -1 && newIdx !== -1) {
        const [moved] = comps.splice(oldIdx, 1);
        comps.splice(newIdx, 0, moved);
        if (currentPageId) reorderComponents(currentPageId, comps.map(c => c.id));
      }
      return;
    }

    // ========== 场景 3：分页拖拽排序 ==========
    if (activeData?.type === 'page') {
      const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIdx = sorted.findIndex(p => p.id === activeStr);
      const newIdx = sorted.findIndex(p => p.id === overStr);
      if (oldIdx !== -1 && newIdx !== -1) {
        const [moved] = sorted.splice(oldIdx, 1);
        sorted.splice(newIdx, 0, moved);
        reorderPages(sorted.map(p => p.id));
      }
    }
  };

  // ===== 外部拖入 =====
  const handleExternalDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      setIsDraggingExternal(true);
      if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
    }
  };

  const handleExternalDragLeave = () => {
    dragLeaveTimer.current = setTimeout(() => setIsDraggingExternal(false), 100);
  };

  const handleExternalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingExternal(false);
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && isValidUrl(normalizeUrl(url))) {
      const cleanUrl = normalizeUrl(url);
      const targetComponentId = getDropTargetFromPoint(e.clientX, e.clientY);
      if (targetComponentId) {
        fetchAndAddItem(targetComponentId, cleanUrl, 'external-drag');
      }
    }
  };

  useEffect(() => {
    const handler = () => { if (isDraggingExternal) setIsDraggingExternal(false); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [isDraggingExternal]);

  // ===== 加载中 =====
  if (isAuthLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: GRADIENT_BG }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // ===== 渲染 =====
  if (!currentPage) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: GRADIENT_BG }}>
        <div className="text-center">
          <p className="text-gray-400 mb-4">暂无分页</p>
          <button onClick={() => addPage('首页')} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            创建分页
          </button>
        </div>
      </div>
    );
  }

  const columns = currentPage.columns || 2;

  return (
    <div
      className="w-screen min-h-screen text-white"
      style={getBgStyle()}
      onDragOver={handleExternalDragOver}
      onDragLeave={handleExternalDragLeave}
      onDrop={handleExternalDrop}
    >
      <div className="min-h-screen" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4">
            {/* 顶部栏 */}
            <header className="flex items-center justify-between py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-blue-400" />
                <h1 className="text-base font-bold tracking-tight">薄荷花网</h1>
              </div>
              <div className="flex items-center gap-1.5">
                {/* 列数选择 */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnPicker(!showColumnPicker)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center gap-1"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>{columns}列</span>
                  </button>
                  {showColumnPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-xl border border-gray-700 p-1.5 min-w-[120px]">
                        {[1,2,3,4,5,6,7,8].map(n => (
                          <button
                            key={n}
                            onClick={() => { if (currentPageId) setPageColumns(currentPageId, n); setShowColumnPicker(false); }}
                            className={`w-full px-3 py-1.5 text-xs rounded-lg text-left transition-colors ${columns === n ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                          >
                            {n} 列
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* 背景选择 */}
                <div className="relative">
                  <button
                    onClick={() => setShowBgPicker(!showBgPicker)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center gap-1"
                  >
                    <Image className="w-3.5 h-3.5" />
                    <span>背景</span>
                  </button>
                  {showBgPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowBgPicker(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-xl border border-gray-700 p-1.5 min-w-[150px]">
                        {PRESET_BACKGROUNDS.map(bg => (
                          <button
                            key={bg.name}
                            onClick={() => { if (currentPageId) setPageBackground(currentPageId, bg.value); setShowBgPicker(false); }}
                            className={`w-full px-3 py-1.5 text-xs rounded-lg text-left transition-colors ${(currentPage?.background === bg.value) || (!currentPage?.background && bg.value === GRADIENT_BG) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                          >
                            {bg.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button onClick={() => setShowBookmarkImport(true)} className="px-2.5 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>导入</span>
                </button>

                <button onClick={() => addPage()} className="px-2.5 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all">
                  + 分页
                </button>

                {/* 认证按钮 */}
                {isAuthenticated ? (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                    <span className="text-xs text-white/60 hidden sm:inline truncate max-w-[100px]">{userEmail}</span>
                    <button onClick={signOut} className="px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all flex items-center gap-1" title="退出登录">
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                ) : !isAuthLoading && (
                  <button onClick={() => setShowAuthModal(true)} className="px-2 py-1.5 text-xs rounded-lg bg-blue-600/80 hover:bg-blue-600 border border-blue-500/30 transition-all flex items-center gap-1">
                    <LogIn className="w-3 h-3" />
                    <span>登录</span>
                  </button>
                )}
              </div>
            </header>

            {/* 分页栏 */}
            <div className="py-2">
              <SortableContext items={pages.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                <PageBar pages={pages} currentPageId={currentPageId} onContextMenu={handleContextMenu} />
              </SortableContext>
            </div>

            {/* 组件区域 — 网格布局 */}
            <main className="pb-8">
              {pageComponents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <p className="text-base mb-3">这个分页还没有内容</p>
                  <button
                    onClick={() => addComponent(currentPageId!)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg text-sm"
                  >
                    + 添加第一个组件
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {pageComponents.map((comp) => {
                      const compId = comp.id;
                      // 判断这个组件是否是当前拖拽悬停的目标
                      const isDropTarget =
                        activeDragType === 'item' && dropTargetComponentId === compId;

                      return (
                        <ComponentContainer
                          key={compId}
                          component={comp}
                          items={getComponentItems(compId)}
                          onContextMenu={handleContextMenu}
                          isOver={isDropTarget}
                        />
                      );
                    })}
                  </div>
                  <button
                    onClick={() => addComponent(currentPageId!)}
                    className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 text-white/50 hover:text-white/80 transition-all bg-white/5 hover:bg-white/10 text-sm"
                  >
                    + 添加组件
                  </button>
                </div>
              )}
            </main>
          </div>

          {/* 拖拽预览 */}
          <DragOverlay>
            {activeItemData ? (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-xl px-4 py-2.5 border border-blue-400/50 max-w-[300px]">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {activeItemData.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {(() => { try { return new URL(activeItemData.url).hostname.replace('www.', ''); } catch { return activeItemData.url; } })()}
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* 右键菜单 */}
          <ContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(m => ({ ...m, show: false }))}
            onAction={handleContextAction}
          />

          {/* 重命名对话框 */}
          <EditDialog
            open={renameDialog.open}
            title={renameDialog.title}
            fields={[{ key: 'name', label: '名称', type: 'text', required: true, placeholder: '输入名称...' }]}
            initialValues={{ name: renameDialog.currentName }}
            onSave={(values) => {
              if (renameDialog.targetType === 'page' && renameDialog.targetId)
                renamePage(renameDialog.targetId, values.name);
              else if (renameDialog.targetType === 'component' && renameDialog.targetId)
                renameComponent(renameDialog.targetId, values.name);
              setRenameDialog(m => ({ ...m, open: false }));
            }}
            onClose={() => setRenameDialog(m => ({ ...m, open: false }))}
          />

          {/* 登录/注册对话框 */}
          <AuthModal
            open={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={() => setShowAuthModal(false)}
          />

          {/* 书签导入对话框 */}
          <BookmarkImport
            open={showBookmarkImport}
            onClose={() => setShowBookmarkImport(false)}
            onImport={handleBookmarkImport}
          />
        </DndContext>

        {/* 外部拖入提示 */}
        {isDraggingExternal && (
          <div
            className="fixed inset-0 z-30 bg-blue-900/20 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setIsDraggingExternal(false)}
          >
            <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl px-8 py-6 text-center border-2 border-dashed border-blue-400 pointer-events-none">
              <p className="text-lg font-medium text-gray-800 dark:text-gray-100">拖到组件中放置链接</p>
              <p className="text-sm text-gray-500 mt-1">松开以添加到组件</p>
            </div>
          </div>
        )}

        {/* 导入撤销提示 */}
        {undoImport && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800/95 dark:bg-gray-700/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-600/50 px-5 py-3 flex items-center gap-4 animate-in slide-up">
            <span className="text-sm text-gray-100">
              已导入 {undoImport.totalCount} 个书签
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndoImport}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors"
              >
                撤销导入
              </button>
              <button
                onClick={() => setUndoImport(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
