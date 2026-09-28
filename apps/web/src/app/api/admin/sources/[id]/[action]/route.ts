import { NextResponse } from 'next/server';
import { z } from 'zod';
import { displayModeAtMost, fetchActivationBlockers, publicActivationBlockers, DISPLAY_MODE_LABELS } from '@worklens/domain';
import { isAdminRequest, readDemoState, writeDemoState } from '@/server/admin';
import { withHistory, withOverride, type DemoHistoryEntry } from '@/server/demo-state';
import { getRepository, getRequestContext } from '@/server/repository';
import { isSameOriginRequest } from '@/server/request-guards';

const ACTIONS = ['pause', 'resume', 'fetch-on', 'fetch-off', 'display'] as const;
type Action = (typeof ACTIONS)[number];
const displaySchema = z.object({ displayMode: z.enum(['none', 'link_only', 'facts_link', 'full_authorized']) });

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST /api/admin/sources/:id/(pause|resume|fetch-on|fetch-off|display) — 管理画面デモの操作（要管理者）。
 * 停止（公開拒否フラグ）は常に先に書き込み、有効化は審査条件をサーバー側で検査する。
 * M0ではこのブラウザのCookieにだけ保存する（M1でDB・監査ログに置き換え）。
 */
export async function POST(request: Request, ctx: RouteContext<'/api/admin/sources/[id]/[action]'>) {
  if (!isAdminRequest(request)) return json({ error: 'unauthorized', message: '管理者としてログインしてください。' }, 401);
  if (!isSameOriginRequest(request)) return json({ error: 'forbidden' }, 403);
  const { id, action: rawAction } = await ctx.params;
  if (!(ACTIONS as readonly string[]).includes(rawAction)) return json({ error: 'not_found' }, 404);
  const action = rawAction as Action;

  const repo = getRepository();
  const requestCtx = await getRequestContext();
  const row = await repo.getSource(id, requestCtx);
  if (!row) return json({ error: 'not_found', message: 'ソースが見つかりません。' }, 404);

  const env = { now: requestCtx.now, liveCrawlEnabled: requestCtx.liveCrawlEnabled };
  let state = await readDemoState();
  const at = new Date().toISOString();
  const record = async (entry: Omit<DemoHistoryEntry, 'at' | 'sourceId'>) => {
    state = withHistory(state, { ...entry, at, sourceId: id });
    await writeDemoState(state);
  };

  if (action === 'pause') {
    state = withOverride(state, id, { publicEnabled: false });
    await record({ action: 'pause', result: 'applied' });
  } else if (action === 'fetch-off') {
    state = withOverride(state, id, { fetchEnabled: false });
    await record({ action: 'fetch_off', result: 'applied' });
  } else if (action === 'resume' || action === 'fetch-on') {
    const blockers = action === 'resume' ? publicActivationBlockers(row.base, env) : fetchActivationBlockers(row.base, env);
    if (blockers.length > 0) {
      await record({ action: action === 'resume' ? 'resume' : 'fetch_on', result: 'blocked' });
      return json({ error: 'activation_blocked', message: `有効化できません：${blockers.join('／')}`, reasons: blockers }, 409);
    }
    state = withOverride(state, id, action === 'resume' ? { publicEnabled: true } : { fetchEnabled: true });
    await record({ action: action === 'resume' ? 'resume' : 'fetch_on', result: 'applied' });
  } else {
    const parsed = displaySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'invalid', message: '表示方式の指定が正しくありません。' }, 400);
    const mode = parsed.data.displayMode;
    if (!displayModeAtMost(mode, row.base.displayMode)) {
      await record({ action: 'display', detail: mode, result: 'blocked' });
      return json({ error: 'activation_blocked', message: `審査で認められた表示方式（${DISPLAY_MODE_LABELS[row.base.displayMode]}）より広げられません。` }, 409);
    }
    state = withOverride(state, id, { displayMode: mode });
    await record({ action: 'display', detail: mode, result: 'applied' });
  }

  const updated = await repo.getSource(id, { ...requestCtx, sourceOverrides: state.overrides });
  const messages: Record<Action, string> = {
    pause: '公開を停止しました。検索・求人詳細・比較・保存・外部遷移から即時に外れます（データは削除していません）。',
    resume: '公開を再開しました。',
    'fetch-on': '収集を有効にしました（M0は架空fixtureのみで、実サイトへは取得しません）。',
    'fetch-off': '収集を停止しました。',
    display: '表示方式を変更しました。',
  };
  return json({ row: updated, message: messages[action] });
}
