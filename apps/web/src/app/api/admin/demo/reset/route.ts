import { NextResponse } from 'next/server';
import { isAdminRequest, readDemoState, writeDemoState } from '@/server/admin';
import { withHistory } from '@/server/demo-state';
import { isSameOriginRequest } from '@/server/request-guards';

/** POST /api/admin/demo/reset — 管理画面デモの操作をすべて元に戻す（要管理者） */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const state = await readDemoState();
  await writeDemoState(withHistory({ ...state, overrides: {} }, { at: new Date().toISOString(), sourceId: '-', action: 'reset', result: 'applied' }));
  return NextResponse.json({ message: 'デモの操作をすべて元に戻しました。' });
}
