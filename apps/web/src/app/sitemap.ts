import type { MetadataRoute } from 'next';
import { OCCUPATIONS, isHubIndexable } from '@worklens/domain';
import { getSiteUrl, isDemoMode } from '@/server/env';
import { getRepository, getRequestContext } from '@/server/repository';

/**
 * サイトマップ（SEO04）。デモでは何も載せない。本番でも空・薄いハブ、検索条件の組合せ、facts_link求人は載せない。
 * URL は絶対URL（SITE_URL、未設定なら本番ドメイン）で出力する。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isDemoMode()) return [];
  const base = getSiteUrl();
  const ctx = await getRequestContext();
  const repo = getRepository();
  const hubs = await Promise.all(OCCUPATIONS.map(async (o) => ({ slug: o.slug, hub: await repo.occupationHub(o.slug, ctx) })));
  return [
    { url: `${base}/` },
    ...hubs.filter(({ hub }) => isHubIndexable(hub.visibleCount, { demo: false })).map(({ slug }) => ({ url: `${base}/occupations/${slug}` })),
  ];
}
