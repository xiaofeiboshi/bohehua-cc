-- 给 items 表添加 group 列（用于书签子分组）
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS "group" TEXT;
