import { NextResponse } from 'next/server';
import { runSearch } from '@/server/search';

/** GET /api/jobs — 検索・絞り込み件数・ページング（1ページ20件）。公開projectionだけを返す。 */
export async function GET(request: Request) {
  const result = await runSearch(new URL(request.url).searchParams);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
