import type { MetadataRoute } from 'next';
import { getSiteUrl, isDemoMode } from '@/server/env';

/**
 * 外部遷移・API・管理画面はクロール対象外。各ページのindex可否はmeta robotsで個別に判定する
 * （robotsで遮断するとnoindexを読めなくなるため、一覧・詳細は遮断しない）。
 * sitemap はデモでは載せない（デモの sitemap は空で、全ページ noindex）。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/out/', '/admin'] }],
    ...(isDemoMode() ? {} : { sitemap: `${getSiteUrl()}/sitemap.xml` }),
  };
}
