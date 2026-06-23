import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 简单的 ID 生成器（避免依赖 uuid 库的体积）
let counter = 0;
export function generateId(): string {
  counter++;
  return `${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 9)}`;
}

// 从 URL 提取域名
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// 获取 favicon URL
export function getFaviconUrl(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

// 检测是否是有效 URL
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// 自动给 URL 添加协议头
export function normalizeUrl(str: string): string {
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return `https://${str}`;
}
