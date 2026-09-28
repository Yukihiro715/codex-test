import type { MetadataRoute } from 'next';

/**
 * 外部遷移・API・管理画面はクロール対象外。各ページのindex可否はmeta robotsで個別に判定する
 * （robotsで遮断するとnoindexを読めなくなるため、一覧・詳細は遮断しない）。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/out/', '/admin'] }],
  };
}
