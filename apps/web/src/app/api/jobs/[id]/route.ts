import { NextResponse } from 'next/server';
import { getRepository, getRequestContext } from '@/server/repository';

/**
 * GET /api/jobs/:id — 公開projection。本文は full_authorized の場合だけ含まれる。
 * 掲載終了は 410、非公開・存在しないIDは区別せず 404。
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/jobs/[id]'>) {
  const { id } = await ctx.params;
  const result = await getRepository().getJob(id, await getRequestContext());
  const status = result.status === 'public' ? 200 : result.status === 'expired' ? 410 : 404;
  return NextResponse.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
}
