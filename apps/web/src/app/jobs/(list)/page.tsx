import type { Metadata } from 'next';
import { SearchView } from '@/components/search/search-view';
import { runSearch } from '@/server/search';
import { getRepository } from '@/server/repository';

export const metadata: Metadata = {
  title: '求人を探す',
  // 検索条件の組合せページはindexしない（SEO03・SEO04）
  robots: { index: false, follow: true },
};

export default async function JobsPage({ searchParams }: PageProps<'/jobs'>) {
  const params = await searchParams;
  const initial = await runSearch(params);
  return <SearchView initial={initial} sourceIds={[...getRepository().sourceIds()]} />;
}
