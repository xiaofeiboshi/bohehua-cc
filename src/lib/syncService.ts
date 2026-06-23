import { supabase } from './supabase';
import type { Page, Component, Item } from '../types';

type TableName = 'pages' | 'components' | 'items';

// 通用保存函数
async function saveToSupabase<T extends Page | Component | Item>(
  table: TableName,
  data: T,
  userId: string
): Promise<void> {
  const record = { ...data, user_id: userId };
  // @ts-expect-error - supabase-js 类型推断问题，运行时正常
  const { error } = await supabase.from(table).upsert(record, { onConflict: 'id' });
  if (error && error.code !== '23505') {
    console.error(`保存 ${table} 失败:`, error.message);
  }
}

// 通用删除函数
async function deleteFromSupabase(table: TableName, id: string): Promise<void> {
  // @ts-expect-error - supabase-js 类型推断
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`删除 ${table} 失败:`, error.message);
}

// 从 Supabase 加载用户的所有数据
export async function loadUserData(userId: string): Promise<{
  pages: Page[];
  components: Component[];
  items: Item[];
} | null> {
  try {
    const [pagesRes, componentsRes, itemsRes] = await Promise.all([
      supabase.from('pages').select('*').eq('user_id', userId).order('sort_order'),
      supabase.from('components').select('*').eq('user_id', userId).order('sort_order'),
      supabase.from('items').select('*').eq('user_id', userId).order('sort_order'),
    ]);

    return {
      pages: (pagesRes.data || []) as unknown as Page[],
      components: (componentsRes.data || []) as unknown as Component[],
      items: (itemsRes.data || []) as unknown as Item[],
    };
  } catch (e) {
    console.error('加载数据失败:', e);
    return null;
  }
}

// 同步单个分页
export async function syncPage(page: Page, userId: string): Promise<void> {
  await saveToSupabase('pages', page, userId);
}

// 删除分页
export async function removePage(pageId: string): Promise<void> {
  await deleteFromSupabase('pages', pageId);
}

// 同步单个组件
export async function syncComponent(component: Component, userId: string): Promise<void> {
  await saveToSupabase('components', component, userId);
}

// 删除组件
export async function removeComponent(componentId: string): Promise<void> {
  await deleteFromSupabase('components', componentId);
}

// 同步单个条目
export async function syncItem(item: Item, userId: string): Promise<void> {
  await saveToSupabase('items', item, userId);
}

// 删除条目
export async function removeItem(itemId: string): Promise<void> {
  await deleteFromSupabase('items', itemId);
}
