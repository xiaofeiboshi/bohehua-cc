import { useState, useRef } from 'react';
import { X, Upload, FileText, Check, FolderOpen, Bookmark } from 'lucide-react';

interface BookmarkEntry {
  title: string;
  url: string;
  group?: string; // 子文件夹名
  folder: string; // 顶级文件夹名
}

interface ParsedFolder {
  name: string;
  totalCount: number;
  groups: string[]; // 子文件夹名列表
  items: BookmarkEntry[];
  selected: boolean;
}

interface BookmarkImportProps {
  open: boolean;
  onClose: () => void;
  onImport: (folders: Array<{ name: string; items: Array<{ title: string; url: string; group?: string }> }>) => void;
}

function parseBookmarkHtml(html: string): BookmarkEntry[] {
  const bookmarks: BookmarkEntry[] = [];
  let folderStack: string[] = []; // 文件夹层级栈
  const lines = html.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测文件夹开始 <DT><H3>
    const folderMatch = trimmed.match(/<DT><H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      const folderName = folderMatch[1].trim();
      folderStack.push(folderName);
      continue;
    }

    // 检测文件夹结束 </DL>
    if (trimmed === '</DL>' || trimmed === '</dl>') {
      if (folderStack.length > 0) folderStack.pop();
      continue;
    }

    // 检测书签 <A HREF="...">
    const bookmarkMatch = trimmed.match(/<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const url = bookmarkMatch[1].trim();
      const title = bookmarkMatch[2].trim();
      if (url && title && (url.startsWith('http://') || url.startsWith('https://'))) {
        // 顶级文件夹 = folderStack[0]，子文件夹 = folderStack[1]（如果有）
        const topFolder = folderStack[0] || '未分类';
        const subFolder = folderStack.length > 1 ? folderStack[folderStack.length - 1] : undefined;
        // 如果只有一层文件夹，则顶级就是文件夹本身，没有子分组
        // 如果有两层及以上，顶层是组件名，第二层是分组名
        bookmarks.push({
          title,
          url,
          folder: topFolder,
          group: folderStack.length > 1 ? subFolder : undefined,
        });
      }
    }
  }

  return bookmarks;
}

export function BookmarkImport({ open, onClose, onImport }: BookmarkImportProps) {
  const [parsedFolders, setParsedFolders] = useState<ParsedFolder[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const html = event.target?.result as string;
      const parsed = parseBookmarkHtml(html);

      // 按顶级文件夹分组
      const folderMap = new Map<string, ParsedFolder>();
      parsed.forEach(bm => {
        if (!folderMap.has(bm.folder)) {
          folderMap.set(bm.folder, { name: bm.folder, totalCount: 0, groups: [], items: [], selected: true });
        }
        const folder = folderMap.get(bm.folder)!;
        folder.totalCount++;
        folder.items.push(bm);
        if (bm.group && !folder.groups.includes(bm.group)) {
          folder.groups.push(bm.group);
        }
      });

      setParsedFolders(Array.from(folderMap.values()));
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const toggleFolder = (index: number) => {
    setParsedFolders(prev => prev.map((f, i) => i === index ? { ...f, selected: !f.selected } : f));
  };

  const selectAll = () => {
    const allSelected = parsedFolders.every(f => f.selected);
    setParsedFolders(prev => prev.map(f => ({ ...f, selected: !allSelected })));
  };

  const handleImport = () => {
    const selected = parsedFolders.filter(f => f.selected);
    if (selected.length === 0) return;
    onImport(selected.map(f => ({
      name: f.name,
      items: f.items,
    })));
    setParsedFolders([]);
    setStep('upload');
    onClose();
  };

  const resetFile = () => {
    setParsedFolders([]);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalSelected = parsedFolders.filter(f => f.selected).reduce((sum, f) => sum + f.totalCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

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
          {step === 'upload' ? (
            /* 上传界面 */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all"
            >
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">点击选择书签 HTML 文件</p>
              <p className="text-xs text-gray-500 mt-1">从浏览器导出书签为 HTML 文件后上传</p>
              <p className="text-xs text-gray-400 mt-3">
                Chrome: 书签管理器 → 导出书签<br />
                Edge: 收藏夹 → 导出<br />
                Firefox: 书签 → 导入和备份 → 导出书签到 HTML
              </p>
              <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileSelect} className="hidden" />
            </div>
          ) : (
            /* 预览界面 */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  已解析 <span className="text-blue-600 dark:text-blue-400 font-bold">{parsedFolders.reduce((s, f) => s + f.totalCount, 0)}</span> 个书签
                </p>
                <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  {parsedFolders.every(f => f.selected) ? '取消全选' : '全选'}
                </button>
              </div>

              {/* 文件夹列表 */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {parsedFolders.map((folder, idx) => (
                  <div key={folder.name}
                    className={`rounded-xl border transition-all ${
                      folder.selected
                        ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/15'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                    }`}
                  >
                    {/* 文件夹标题行 */}
                    <div
                      onClick={() => toggleFolder(idx)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                        folder.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                      }`}>
                        {folder.selected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <FolderOpen className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{folder.name}</div>
                        <div className="text-xs text-gray-400">{folder.totalCount} 个书签{folder.groups.length > 0 ? ` · ${folder.groups.length} 个子分组` : ''}</div>
                      </div>
                      {/* 导入方式提示 */}
                      <span className="text-xs text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                        新建组件
                      </span>
                    </div>

                    {/* 展开显示各组详情 */}
                    {folder.selected && folder.groups.length > 0 && (
                      <div className="px-4 pb-3 pl-14 space-y-1">
                        {folder.groups.map(group => {
                          const count = folder.items.filter(i => i.group === group).length;
                          return (
                            <div key={group} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Bookmark className="w-3 h-3" />
                              <span>{group}</span>
                              <span className="text-gray-400">({count})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 未分类的书签 */}
              {parsedFolders.some(f => f.name === '未分类') && (
                <p className="text-xs text-gray-400 italic">
                  * "未分类"中的书签不在任何文件夹中
                </p>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={resetFile} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              重新选择文件
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={totalSelected === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                导入 ({totalSelected} 个书签)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
