import { useState, useRef } from 'react';
import { X, Upload, FileText, Check, FolderOpen, Bookmark, ChevronDown, ChevronRight } from 'lucide-react';

// ===== 数据结构 =====
interface ParsedItem {
  title: string;
  url: string;
  group?: string; // 三级文件夹名
}

interface ParsedComponent {
  name: string; // 二级文件夹名
  items: ParsedItem[];
}

interface ParsedPage {
  name: string; // 一级文件夹名
  items: ParsedItem[]; // 直接放在一级下的书签（没有二级文件夹）
  components: ParsedComponent[];
}

interface PagePreview {
  name: string;
  components: ParsedComponent[];
  directItems: ParsedItem[];
  selected: boolean;
}

interface BookmarkImportProps {
  open: boolean;
  onClose: () => void;
  onImport: (pages: Array<{
    name: string;
    components: Array<{ name: string; items: Array<{ title: string; url: string; group?: string }> }>;
    directItems: Array<{ title: string; url: string }>;
  }>) => void;
}

// ===== 解析书签 HTML（三级文件夹） =====
let parseFolderStack: string[] = [];

function parseBookmarkHtml(html: string): ParsedPage[] {
  parseFolderStack = [];
  const pageMap = new Map<string, ParsedPage>();
  const lines = html.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    const folderMatch = trimmed.match(/<DT><H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      parseFolderStack.push(folderMatch[1].trim());
      continue;
    }

    if (trimmed.startsWith('</DL>') || trimmed.startsWith('</dl>')) {
      if (parseFolderStack.length > 0) parseFolderStack.pop();
      continue;
    }

    const bookmarkMatch = trimmed.match(/<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (!bookmarkMatch) continue;

    const url = bookmarkMatch[1].trim();
    const title = bookmarkMatch[2].trim();
    if (!url || !title || !url.startsWith('http')) continue;

    const depth = parseFolderStack.length;

    // 不在任何文件夹 → 未分类
    if (depth === 0) {
      if (!pageMap.has('未分类')) {
        pageMap.set('未分类', { name: '未分类', items: [], components: [] });
      }
      pageMap.get('未分类')!.items.push({ title, url });
      continue;
    }

    const pageName = parseFolderStack[0];
    if (!pageMap.has(pageName)) {
      pageMap.set(pageName, { name: pageName, items: [], components: [] });
    }
    const page = pageMap.get(pageName)!;

    if (depth === 1) {
      // 直接在一级文件夹下
      page.items.push({ title, url });
    } else {
      // depth >= 2：在二级或更深的文件夹下
      const compName = parseFolderStack[1];
      let comp = page.components.find(c => c.name === compName);
      if (!comp) {
        comp = { name: compName, items: [] };
        page.components.push(comp);
      }
      // 三级及以上作为 group
      const group = depth >= 3 ? parseFolderStack[2] : undefined;
      comp.items.push({ title, url, group });
    }
  }

  return Array.from(pageMap.values());
}

export function BookmarkImport({ open, onClose, onImport }: BookmarkImportProps) {
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const html = event.target?.result as string;
      const parsed = parseBookmarkHtml(html);
      setPages(parsed.map(p => ({ name: p.name, components: p.components, directItems: p.items, selected: true })));
      setExpandedPages(new Set(parsed.map(p => p.name)));
    };
    reader.readAsText(file);
  };

  const togglePage = (name: string) => {
    setPages(prev => prev.map(p => p.name === name ? { ...p, selected: !p.selected } : p));
  };

  const toggleExpanded = (name: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    const allSelected = pages.every(p => p.selected);
    setPages(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  const handleImportAction = () => {
    const selectedPages = pages.filter(p => p.selected);
    if (selectedPages.length === 0) return;
    onImport(selectedPages.map(p => ({
      name: p.name,
      components: p.components,
      directItems: p.directItems,
    })));
    setPages([]);
    onClose();
  };

  const resetFile = () => {
    setPages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalSelected = pages.filter(p => p.selected).reduce((sum, p) => {
    return sum + p.directItems.length + p.components.reduce((s, c) => s + c.items.length, 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* 标题 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" />
            导入浏览器书签
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {pages.length === 0 ? (
            /* 上传界面 */
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all"
            >
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">点击选择书签 HTML 文件</p>
              <p className="text-xs text-gray-500 mt-1">从浏览器导出书签为 HTML 文件后上传</p>
              <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileSelect} className="hidden" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* 顶部统计 */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  共解析 <span className="font-bold text-blue-600 dark:text-blue-400">{totalSelected}</span> 个书签
                </p>
                <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  {pages.every(p => p.selected) ? '取消全选' : '全选'}
                </button>
              </div>

              {/* 分页列表 */}
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {pages.map((page) => {
                  const totalItems = page.directItems.length + page.components.reduce((s, c) => s + c.items.length, 0);
                  const isExpanded = expandedPages.has(page.name);
                  return (
                    <div key={page.name} className={`rounded-xl border transition-all ${page.selected ? 'border-blue-200 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
                      {/* 分页行 */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => togglePage(page.name)} className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${page.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                          {page.selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <button onClick={() => toggleExpanded(page.name)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <FolderOpen className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{page.name}</span>
                          <span className="text-xs text-gray-400 ml-2">({totalItems} 条)</span>
                        </div>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
                          新分页
                        </span>
                      </div>

                      {/* 展开的内容 */}
                      {isExpanded && (
                        <div className="pb-3 pl-14 pr-4 space-y-1.5">
                          {/* 直接放在一级下的书签 */}
                          {page.directItems.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-700/30">
                              <Bookmark className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">本级书签</span>
                              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {page.directItems.length} 条 → <span className="text-blue-500 font-medium">默认组件</span>
                              </span>
                            </div>
                          )}

                          {/* 二级文件夹 = 组件 */}
                          {page.components.map(comp => {
                            const groupCounts = new Map<string, number>();
                            let ungroupedCount = 0;
                            comp.items.forEach(item => {
                              if (item.group) {
                                groupCounts.set(item.group, (groupCounts.get(item.group) || 0) + 1);
                              } else {
                                ungroupedCount++;
                              }
                            });

                            return (
                              <div key={comp.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-700/30">
                                <Bookmark className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{comp.name}</span>
                                  <span className="text-xs text-gray-400 ml-1">({comp.items.length} 条)</span>
                                  {/* 三级分组提示 */}
                                  {groupCounts.size > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Array.from(groupCounts.entries()).map(([g, c]) => (
                                        <span key={g} className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                          📁 {g} ({c})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">
                                  新组件
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {pages.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={resetFile} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">重新选择文件</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                取消
              </button>
              <button onClick={handleImportAction} disabled={totalSelected === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                导入 ({totalSelected} 条)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
