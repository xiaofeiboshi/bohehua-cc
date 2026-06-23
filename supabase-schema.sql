-- =============================================
-- 薄荷花网 - 数据库表结构
-- 在 Supabase SQL Editor 中运行此脚本
-- =============================================

-- 1. 分页表
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT '新分页',
  sort_order INTEGER NOT NULL DEFAULT 0,
  columns INTEGER NOT NULL DEFAULT 2,
  background TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 组件表
CREATE TABLE public.components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL DEFAULT 'link-list',
  title TEXT NOT NULL DEFAULT '新组件',
  sort_order INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 条目表
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID REFERENCES public.components(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  is_favorite BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 索引（加速查询）
-- =============================================
CREATE INDEX idx_pages_user_id ON public.pages(user_id);
CREATE INDEX idx_components_page_id ON public.components(page_id);
CREATE INDEX idx_items_component_id ON public.items(component_id);
CREATE INDEX idx_pages_sort_order ON public.pages(user_id, sort_order);
CREATE INDEX idx_components_sort_order ON public.components(page_id, sort_order);
CREATE INDEX idx_items_sort_order ON public.items(component_id, sort_order);

-- =============================================
-- 行级安全策略（RLS）
-- =============================================

-- 启用 RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- 分页策略：用户只能看自己的
CREATE POLICY "用户只能管理自己的分页"
  ON public.pages
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 组件策略：用户只能看自己的
CREATE POLICY "用户只能管理自己的组件"
  ON public.components
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 条目策略：用户只能看自己的
CREATE POLICY "用户只能管理自己的条目"
  ON public.items
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- 自动更新 updated_at 时间戳
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER components_updated_at
  BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
