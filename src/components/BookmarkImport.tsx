import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Check } from 'lucide-react';

interface BookmarkEntry {
  title: string;
  url: string;
  folder?: string;
}

interface BookmarkImportProps {
  open: boolean;
  onClose: () => void;
  onImport: (bookmarks: BookmarkEntry[], targetComponentId: string) => void;
  components: Array<{ id: string; title: string }>;
}

function parseBookmarkHtml(html: string): BookmarkEntry[] {
  const bookmarks: BookmarkEntry[] = [];
  let currentFolder = '';

  // 匹配书签
  // 提取所有 <A HREF="..."> 标签
  const lines = html.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测文件夹
    const folderMatch = trimmed.match(/<DT><H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      currentFolder = folderMatch[1].trim();
      continue;
    }

    // 检测书签
    const bookmarkMatch = trimmed.match(/<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const url = bookmarkMatch[1].trim();
      const title = bookmarkMatch[2].trim();
      if (url && title && (url.startsWith('http://') || url.startsWith('https://'))) {
        bookmarks.push({ title, url, folder: currentFolder });
      }
    }
  }

  return bookmarks;
}

export function BookmarkImport({ open, onClose, onImport, components }: BookmarkImportProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [targetComponent, setTargetComponent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // 默认选择第一个组件
  useEffect(() => {
    if (!targetComponent && components.length > 0) {
      setTargetComponent(components[0].id);
    }
  }, [components, targetComponent]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const html = event.target?.result as string;
      const parsed = parseBookmarkHtml(html);
      setBookmarks(parsed);
      setSelectedIds(new Set(parsed.map((_, i) => i)));
    };
    reader.readAsText(file);
  };

  const toggleSelect = (index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === bookmarks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookmarks.map((_, i) => i)));
    }
  };

  const handleImport = () => {
    const selected = bookmarks.filter((_, i) => selectedIds.has(i));
    if (selected.length === 0 || !targetComponent) return;
    onImport(selected, targetComponent);
    setBookmarks([]);
    setSelectedIds(new Set());
    onClose();
  };

  const resetFile = () => {
    setBookmarks([]);
    setSelectedIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>

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
          {/* 第一步：选择文件 */}
          {bookmarks.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all"
            >
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">点击选择书签 HTML 文件</p>
              <p className="text-xs text-gray-500 mt-1">
                从浏览器导出书签为 HTML 文件后上传
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Chrome: 书签管理器 → 导出书签<br />
                Edge: 收藏夹 → 导出<br />
                Firefox: 书签 → 导入和备份 → 导出书签到 HTML
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <>
              {/* 导入目标 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">导入到</label>
                <select
                  value={targetComponent || components[0]?.id || ''}
                  onChange={e => setTargetComponent(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {components.length === 0 ? (
                    <option value="">请先创建一个组件</option>
                  ) : (
                    components.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))
                  )}
                </select>
              </div>

              {/* 书签列表 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    共找到 {bookmarks.length} 个书签
                  </span>
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    {selectedIds.size === bookmarks.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
                  {bookmarks.map((bm, i) => (
                    <div
                      key={i}
                      onClick={() => toggleSelect(i)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm ${
                        selectedIds.has(i) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedIds.has(i) ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                      }`}>
                        {selectedIds.has(i) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-800 dark:text-gray-100 truncate">{bm.title}</div>
                        <div className="text-xs text-gray-400 truncate">{bm.url}</div>
                      </div>
                      {bm.folder && (
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0 max-w-[100px] truncate">
                          {bm.folder}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        {bookmarks.length > 0 && (
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
                disabled={selectedIds.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                导入 {selectedIds.size > 0 ? `(${selectedIds.size} 个)` : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
