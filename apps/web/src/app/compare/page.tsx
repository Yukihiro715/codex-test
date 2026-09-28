import type { Metadata } from 'next';
import { buildComparisonRows, normalizeCompareIds, type PublicJobSummary } from '@worklens/domain';
import { CompareView } from '@/components/compare/compare-view';
import { getRepository, getRequestContext } from '@/server/repository';

export const metadata: Metadata = {
  title: '求人を比較',
  robots: { index: false, follow: false },
};

export default async function ComparePage({ searchParams }: PageProps<'/compare'>) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.ids) ? sp.ids.join(',') : (sp.ids ?? '');
  const { ids, truncated } = normalizeCompareIds(raw.split(','));
  // 比較を開くたびに各求人の公開状態を再検査する
  const items = ids.length === 0 ? [] : await getRepository().lookup(ids, await getRequestContext());
  const jobs = items.flatMap((item): PublicJobSummary[] => (item.status === 'public' ? [item.job] : []));
  return <CompareView items={items} rows={buildComparisonRows(jobs)} truncated={truncated} />;
}
