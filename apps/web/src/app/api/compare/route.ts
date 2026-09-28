import { NextResponse } from 'next/server';
import { buildComparisonRows, normalizeCompareIds, type PublicJobSummary } from '@worklens/domain';
import { getRepository, getRequestContext } from '@/server/repository';

/** GET /api/compare?ids=a,b,c — 最大3件。各求人の公開状態を再検査してから比較行を作る。 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const { ids, truncated } = normalizeCompareIds(raw.split(','));
  const items = ids.length === 0 ? [] : await getRepository().lookup(ids, await getRequestContext());
  const jobs = items.flatMap((item): PublicJobSummary[] => (item.status === 'public' ? [item.job] : []));
  return NextResponse.json({ items, truncated, rows: buildComparisonRows(jobs) }, { headers: { 'Cache-Control': 'no-store' } });
}
