import { z } from 'zod';
import { sourceOverridesSchema, type SourceOverrides } from '@worklens/domain';

/**
 * 管理画面デモの状態（ソースの停止・有効化と操作履歴）。
 * M0はDBがないため、このブラウザのCookieだけに保存する（他の閲覧者には影響しない）。
 * 有効化の可否はサーバー側の審査条件で判定し、Cookieの値をそのまま信用しない。
 */
export const DEMO_STATE_COOKIE = 'wl_demo_sources';
export const DEMO_STATE_MAX_HISTORY = 12;

const historyEntrySchema = z.object({
  at: z.string().max(40),
  sourceId: z.string().max(64),
  action: z.enum(['pause', 'resume', 'fetch_on', 'fetch_off', 'display', 'reset']),
  detail: z.string().max(80).optional(),
  result: z.enum(['applied', 'blocked']),
});

const demoStateSchema = z.object({
  v: z.literal(1),
  overrides: sourceOverridesSchema,
  history: z.array(historyEntrySchema).max(DEMO_STATE_MAX_HISTORY),
});

export type DemoHistoryEntry = z.infer<typeof historyEntrySchema>;
export type DemoState = z.infer<typeof demoStateSchema>;

export const EMPTY_DEMO_STATE: DemoState = { v: 1, overrides: {}, history: [] };

export function decodeDemoState(raw: string | undefined): DemoState {
  if (!raw) return EMPTY_DEMO_STATE;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = demoStateSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : EMPTY_DEMO_STATE;
  } catch {
    return EMPTY_DEMO_STATE;
  }
}

export function encodeDemoState(state: DemoState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

export function withHistory(state: DemoState, entry: DemoHistoryEntry): DemoState {
  return { ...state, history: [entry, ...state.history].slice(0, DEMO_STATE_MAX_HISTORY) };
}

export function withOverride(state: DemoState, sourceId: string, patch: SourceOverrides[string]): DemoState {
  return { ...state, overrides: { ...state.overrides, [sourceId]: { ...state.overrides[sourceId], ...patch } } };
}
