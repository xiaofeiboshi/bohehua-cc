/**
 * 自动抓取网页元数据（标题、描述、图标）
 * 通过 CORS 代理获取页面 HTML，解析 <title> 和 <meta> 标签
 */

export interface PageMetadata {
  title: string;
  description: string;
  icon: string | null;
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    const url = new URL(base);
    if (href.startsWith('//')) return `${url.protocol}${href}`;
    if (href.startsWith('/')) return `${url.protocol}//${url.host}${href}`;
    return `${url.protocol}//${url.host}/${href}`;
  } catch {
    return href;
  }
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const defaults: PageMetadata = { title: '', description: '', icon: null };

  try {
    const encodedUrl = encodeURIComponent(url);
    // 使用免费 CORS 代理来绕过浏览器同源策略
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodedUrl}`;
    const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) return defaults;
    const html = await response.text();

    // 解析 <title> 标签
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200)
      : '';

    // 解析 <meta name="description"> 标签
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
    );
    let description = descMatch
      ? descMatch[1].trim().replace(/\s+/g, ' ').substring(0, 500)
      : '';

    // 如果 meta description 没有，试 og:description
    if (!description) {
      const ogDescMatch = html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i
      );
      description = ogDescMatch
        ? ogDescMatch[1].trim().replace(/\s+/g, ' ').substring(0, 500)
        : '';
    }

    // 解析 favicon / apple-touch-icon
    const iconSelectors = [
      /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      /<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["'][^>]*>/i,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    ];
    let icon: string | null = null;
    for (const pattern of iconSelectors) {
      const match = html.match(pattern);
      if (match) {
        icon = resolveUrl(url, match[1]);
        break;
      }
    }

    return { title, description, icon };
  } catch {
    return defaults;
  }
}
