// ============ 数据模型 ============

export type ComponentType = 'link-list';

export interface Page {
  id: string;
  title: string;
  sortOrder: number;
  columns: number; // 2-8，组件网格列数
  background?: string; // 自定义背景 URL 或 "bing"
}

export interface Component {
  id: string;
  pageId: string;
  type: ComponentType;
  title: string;
  sortOrder: number;
  config: Record<string, unknown>;
}

export interface Item {
  id: string;
  componentId: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  tags: string[];
  source: 'manual' | 'auto' | 'external-drag';
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
}

// ============ 右键菜单 ============

export type ContextMenuTarget = 'page' | 'component' | 'item' | 'empty';

export interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  targetType: ContextMenuTarget;
  targetId: string | null;
}

// ============ 拖拽 ============

export interface DragItem {
  id: string;
  type: 'item' | 'component';
  sourceContainerId: string;
}

// ============ Store ============

export interface AppStore {
  // 数据
  pages: Page[];
  components: Component[];
  items: Item[];
  currentPageId: string | null;

  // 用户
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;

  // 认证
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadFromSupabase: (userId: string) => Promise<void>;

  // 页面管理
  setCurrentPage: (pageId: string) => void;
  addPage: (title?: string) => void;
  renamePage: (pageId: string, title: string) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (orderedIds: string[]) => void;
  setPageColumns: (pageId: string, columns: number) => void;
  setPageBackground: (pageId: string, background: string) => void;

  // 组件管理
  addComponent: (pageId: string, title?: string, type?: ComponentType) => void;
  renameComponent: (componentId: string, title: string) => void;
  deleteComponent: (componentId: string) => void;
  moveComponent: (componentId: string, targetPageId: string, sortOrder?: number) => void;
  reorderComponents: (pageId: string, orderedIds: string[]) => void;

  // 条目管理
  addItem: (componentId: string, title: string, url: string, description?: string, source?: 'manual' | 'auto' | 'external-drag') => void;
  editItem: (itemId: string, updates: Partial<Item>) => void;
  deleteItem: (itemId: string) => void;
  moveItem: (itemId: string, targetComponentId: string, sortOrder?: number) => void;
  copyItem: (itemId: string, targetComponentId: string) => void;
  reorderItems: (componentId: string, orderedIds: string[]) => void;
  toggleFavorite: (itemId: string) => void;

  // 从外部拖入链接
  addExternalLink: (componentId: string, url: string) => void;

  // 自动抓取元数据后添加条目
  fetchAndAddItem: (componentId: string, url: string, source?: 'manual' | 'auto' | 'external-drag') => Promise<void>;

  // 重新抓取已有条目的元数据
  refetchItem: (itemId: string) => Promise<void>;
}
