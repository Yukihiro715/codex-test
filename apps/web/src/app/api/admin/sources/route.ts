import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/server/admin';
import { getRepository, getRequestContext } from '@/server/repository';

/** GET /api/admin/sources — ソース一覧と収集・表示・停止状態（要管理者） */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await getRepository().listSources(await getRequestContext());
  return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
}
