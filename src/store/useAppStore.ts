import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppStore, Page, Component, Item } from '../types';
import { generateId } from '../lib/utils';
import { fetchPageMetadata } from '../lib/fetchMetadata';
import {
  loadUserData, syncPage, removePage,
  syncComponent, removeComponent,
  syncItem, removeItem,
} from '../lib/syncService';
import { supabase } from '../lib/supabase';

const defaultData = () => {
  const pageId = generateId();
  const componentId = generateId();
  return {
    pages: [{ id: pageId, title: '默认分页', sortOrder: 0, columns: 2 }] as Page[],
    components: [{ id: componentId, pageId, type: 'link-list' as const, title: '常用链接', sortOrder: 0, config: {} }] as Component[],
    items: [
      { id: generateId(), componentId, title: 'Google', url: 'https://google.com', tags: [], source: 'manual' as const, isFavorite: false, sortOrder: 0, createdAt: new Date().toISOString() },
      { id: generateId(), componentId, title: 'GitHub', url: 'https://github.com', tags: [], source: 'manual' as const, isFavorite: false, sortOrder: 1, createdAt: new Date().toISOString() },
      { id: generateId(), componentId, title: 'Claude', url: 'https://claude.ai', tags: [], source: 'manual' as const, isFavorite: false, sortOrder: 2, createdAt: new Date().toISOString() },
    ] as Item[],
    currentPageId: pageId,
  };
};

const initial = defaultData();

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ===== 初始状态 =====
      pages: initial.pages,
      components: initial.components,
      items: initial.items,
      currentPageId: initial.currentPageId,
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      isAuthLoading: true,

      // ===== 认证 =====
      initAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            set({ userId: session.user.id, userEmail: session.user.email || null, isAuthenticated: true, isAuthLoading: false });
            await get().loadFromSupabase(session.user.id);
          } else {
            set({ isAuthLoading: false });
          }
        } catch {
          set({ isAuthLoading: false });
        }

        // 监听登录状态变化
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({ userId: session.user.id, userEmail: session.user.email || null, isAuthenticated: true });
            get().loadFromSupabase(session.user.id);
          } else {
            set({ userId: null, userEmail: null, isAuthenticated: false });
          }
        });
      },

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message || null;
      },

      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) return error.message;
        // 注册成功后立即登录
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        return signInError?.message || null;
      },

      signOut: async () => {
        await supabase.auth.signOut();
        const fresh = defaultData();
        set({
          userId: null, userEmail: null, isAuthenticated: false,
          pages: fresh.pages, components: fresh.components, items: fresh.items,
          currentPageId: fresh.currentPageId,
        });
      },

      loadFromSupabase: async (userId) => {
        const data = await loadUserData(userId);
        if (data && data.pages.length > 0) {
          set({
            pages: data.pages,
            components: data.components,
            items: data.items,
            currentPageId: data.pages[0].id,
          });
        }
      },

      // ===== 页面管理 =====
      setCurrentPage: (pageId) => {
        set({ currentPageId: pageId });
      },

      addPage: (title) => {
        const { pages, userId } = get();
        const newPage: Page = {
          id: generateId(),
          title: title || `分页 ${pages.length + 1}`,
          sortOrder: pages.length,
          columns: 2,
        };
        set({ pages: [...pages, newPage], currentPageId: newPage.id });
        if (userId) syncPage(newPage, userId);
      },

      renamePage: (pageId, title) => {
        const { userId } = get();
        const updated = get().pages.map(p => p.id === pageId ? { ...p, title } : p);
        set({ pages: updated });
        if (userId) {
          const page = updated.find(p => p.id === pageId);
          if (page) syncPage(page, userId);
        }
      },

      deletePage: (pageId) => {
        const { pages, components, currentPageId, userId } = get();
        if (pages.length <= 1) return;
        const newPages = pages.filter(p => p.id !== pageId);
        const deletedComponents = components.filter(c => c.pageId === pageId);
        const deletedIds = new Set(deletedComponents.map(c => c.id));
        set({
          pages: newPages,
          components: components.filter(c => c.pageId !== pageId),
          items: get().items.filter(i => !deletedIds.has(i.componentId)),
          currentPageId: currentPageId === pageId ? newPages[0]?.id || null : currentPageId,
        });
        if (userId) {
          removePage(pageId);
          deletedComponents.forEach(c => removeComponent(c.id));
          get().items.filter(i => deletedIds.has(i.componentId)).forEach(i => removeItem(i.id));
        }
      },

      reorderPages: (orderedIds) => {
        const { pages, userId } = get();
        const pageMap = new Map(pages.map(p => [p.id, p]));
        const reordered = orderedIds.map((id, idx) => {
          const p = pageMap.get(id);
          return p ? { ...p, sortOrder: idx } : null;
        }).filter(Boolean) as Page[];
        set({ pages: reordered });
        if (userId) reordered.forEach(p => syncPage(p, userId));
      },

      setPageColumns: (pageId, columns) => {
        const { userId } = get();
        const updated = get().pages.map(p => p.id === pageId ? { ...p, columns: Math.max(1, Math.min(8, columns)) } : p);
        set({ pages: updated });
        if (userId) {
          const page = updated.find(p => p.id === pageId);
          if (page) syncPage(page, userId);
        }
      },

      setPageBackground: (pageId, background) => {
        const { userId } = get();
        const updated = get().pages.map(p => p.id === pageId ? { ...p, background } : p);
        set({ pages: updated });
        if (userId) {
          const page = updated.find(p => p.id === pageId);
          if (page) syncPage(page, userId);
        }
      },

      // ===== 组件管理 =====
      addComponent: (pageId, title, type) => {
        const { components, userId } = get();
        const pageComponents = components.filter(c => c.pageId === pageId);
        const newComponent: Component = {
          id: generateId(),
          pageId,
          type: type || 'link-list',
          title: title || '新组件',
          sortOrder: pageComponents.length,
          config: {},
        };
        set({ components: [...components, newComponent] });
        if (userId) syncComponent(newComponent, userId);
        return newComponent.id; // 返回创建的组件 ID
      },

      renameComponent: (componentId, title) => {
        const { userId } = get();
        const updated = get().components.map(c => c.id === componentId ? { ...c, title } : c);
        set({ components: updated });
        if (userId) {
          const comp = updated.find(c => c.id === componentId);
          if (comp) syncComponent(comp, userId);
        }
      },

      deleteComponent: (componentId) => {
        const { userId } = get();
        set({
          components: get().components.filter(c => c.id !== componentId),
          items: get().items.filter(i => i.componentId !== componentId),
        });
        if (userId) {
          removeComponent(componentId);
          get().items.filter(i => i.componentId === componentId).forEach(i => removeItem(i.id));
        }
      },

      moveComponent: (componentId, targetPageId, sortOrder) => {
        const { userId } = get();
        const updated = get().components.map(c =>
          c.id === componentId ? { ...c, pageId: targetPageId, sortOrder: sortOrder ?? c.sortOrder } : c
        );
        set({ components: updated });
        if (userId) {
          const comp = updated.find(c => c.id === componentId);
          if (comp) syncComponent(comp, userId);
        }
      },

      reorderComponents: (pageId, orderedIds) => {
        const { components, userId } = get();
        const compMap = new Map(components.map(c => [c.id, c]));
        const reordered = orderedIds.map((id, idx) => {
          const c = compMap.get(id);
          return c && c.pageId === pageId ? { ...c, sortOrder: idx } : null;
        }).filter(Boolean) as Component[];
        const other = components.filter(c => c.pageId !== pageId);
        set({ components: [...other, ...reordered] });
        if (userId) reordered.forEach(c => syncComponent(c, userId));
      },

      // ===== 条目管理 =====
      addItem: (componentId, title, url, description, source, group) => {
        const { items, userId } = get();
        const componentItems = items.filter(i => i.componentId === componentId);
        const newItem: Item = {
          id: generateId(),
          componentId,
          title,
          url,
          description: description || '',
          tags: [],
          group: group || undefined,
          source: source || 'manual',
          isFavorite: false,
          sortOrder: componentItems.length,
          createdAt: new Date().toISOString(),
        };
        set({ items: [...items, newItem] });
        if (userId) syncItem(newItem, userId);
      },

      editItem: (itemId, updates) => {
        const { userId } = get();
        const updated = get().items.map(i => i.id === itemId ? { ...i, ...updates } : i);
        set({ items: updated });
        if (userId) {
          const item = updated.find(i => i.id === itemId);
          if (item) syncItem(item, userId);
        }
      },

      deleteItem: (itemId) => {
        set({ items: get().items.filter(i => i.id !== itemId) });
        if (get().userId) removeItem(itemId);
      },

      moveItem: (itemId, targetComponentId, sortOrder) => {
        const { items, userId } = get();
        const targetItems = items.filter(i => i.componentId === targetComponentId);
        const updated = items.map(i =>
          i.id === itemId ? { ...i, componentId: targetComponentId, sortOrder: sortOrder ?? targetItems.length } : i
        );
        set({ items: updated });
        if (userId) {
          const item = updated.find(i => i.id === itemId);
          if (item) syncItem(item, userId);
        }
      },

      copyItem: (itemId, targetComponentId) => {
        const { items, userId } = get();
        const source = items.find(i => i.id === itemId);
        if (!source) return;
        const targetItems = items.filter(i => i.componentId === targetComponentId);
        const copy: Item = {
          ...source,
          id: generateId(),
          componentId: targetComponentId,
          sortOrder: targetItems.length,
        };
        set({ items: [...items, copy] });
        if (userId) syncItem(copy, userId);
      },

      reorderItems: (componentId, orderedIds) => {
        const { items, userId } = get();
        const itemMap = new Map(items.map(i => [i.id, i]));
        const reordered = orderedIds.map((id, idx) => {
          const i = itemMap.get(id);
          return i && i.componentId === componentId ? { ...i, sortOrder: idx } : null;
        }).filter(Boolean) as Item[];
        const other = items.filter(i => i.componentId !== componentId);
        set({ items: [...other, ...reordered] });
        if (userId) reordered.forEach(i => syncItem(i, userId));
      },

      toggleFavorite: (itemId) => {
        const { userId } = get();
        const updated = get().items.map(i =>
          i.id === itemId ? { ...i, isFavorite: !i.isFavorite } : i
        );
        set({ items: updated });
        if (userId) {
          const item = updated.find(i => i.id === itemId);
          if (item) syncItem(item, userId);
        }
      },

      // ===== 外部链接 =====
      addExternalLink: (componentId, url) => {
        const { addItem } = get();
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          addItem(componentId, domain || url, url, '', 'external-drag');
        } catch {
          addItem(componentId, url, url, '', 'external-drag');
        }
      },

      // ===== 自动抓取 =====
      fetchAndAddItem: async (componentId, url, source) => {
        const { addItem } = get();
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          addItem(componentId, domain, url, '正在抓取页面信息...', source || 'manual');
        } catch {
          addItem(componentId, url, url, '正在抓取页面信息...', source || 'manual');
        }

        const meta = await fetchPageMetadata(url);
        const { items } = get();
        const candidates = items.filter(i => i.componentId === componentId && i.description === '正在抓取页面信息...');
        if (candidates.length > 0) {
          const item = candidates[candidates.length - 1];
          const updates: Partial<Item> = {};
          if (meta.title) updates.title = meta.title.substring(0, 200);
          if (meta.description) updates.description = meta.description.substring(0, 500);
          if (meta.icon) updates.icon = meta.icon;
          const updatedItems = items.map(i => i.id === item.id ? { ...i, ...updates, description: updates.description || '' } : i);
          set({ items: updatedItems });
          if (get().userId) {
            const updated = updatedItems.find(i => i.id === item.id);
            if (updated) syncItem(updated, get().userId!);
          }
        }
      },

      refetchItem: async (itemId) => {
        const { items } = get();
        const item = items.find(i => i.id === itemId);
        if (!item?.url) return;

        set({ items: items.map(i => i.id === itemId ? { ...i, description: '正在抓取页面信息...' } : i) });
        const meta = await fetchPageMetadata(item.url);
        const { items: updatedItems } = get();
        const updates: Partial<Item> = {};
        if (meta.title) updates.title = meta.title.substring(0, 200);
        if (meta.description) updates.description = meta.description.substring(0, 500);
        if (meta.icon) updates.icon = meta.icon;

        const final = updatedItems.map(i => i.id === itemId ? { ...i, ...updates, description: meta.description || '' } : i);
        set({ items: final });
        if (get().userId) {
          const updated = final.find(i => i.id === itemId);
          if (updated) syncItem(updated, get().userId!);
        }
      },
    }),
    {
      name: 'bohehua-nav-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化数据，不持久化认证状态
        pages: state.pages,
        components: state.components,
        items: state.items,
        currentPageId: state.currentPageId,
      }),
    }
  )
);
