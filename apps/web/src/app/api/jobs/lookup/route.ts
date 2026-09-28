import { NextResponse } from 'next/server';
import { MAX_LOOKUP_IDS } from '@worklens/data';
import { getRepository, getRequestContext } from '@/server/repository';

const ID_PATTERN = /^[a-z0-9-]{1,80}$/;

/**
 * GET /api/jobs/lookup?ids=a,b — 保存・比較トレー用の公開状態の照会。
 * 掲載終了は最小限の情報、非公開・存在しないIDは同じ応答にする（原稿を再表示しない）。
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').map((v) => v.trim()).filter((v) => ID_PATTERN.test(v)))].slice(0, MAX_LOOKUP_IDS);
  const items = ids.length === 0 ? [] : await getRepository().lookup(ids, await getRequestContext());
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
