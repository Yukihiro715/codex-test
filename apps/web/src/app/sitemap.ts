import type { MetadataRoute } from 'next';
import { OCCUPATIONS, isHubIndexable } from '@worklens/domain';
import { isDemoMode } from '@/server/env';
import { getRepository, getRequestContext } from '@/server/repository';

/**
 * サイトマップ（SEO04）。デモでは何も載せない。本番でも空・薄いハブ、検索条件の組合せ、facts_link求人は載せない。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isDemoMode()) return [];
  const ctx = await getRequestContext();
  const repo = getRepository();
  const hubs = await Promise.all(OCCUPATIONS.map(async (o) => ({ slug: o.slug, hub: await repo.occupationHub(o.slug, ctx) })));
  return hubs.filter(({ hub }) => isHubIndexable(hub.visibleCount, { demo: false })).map(({ slug }) => ({ url: `/occupations/${slug}` }));
}
