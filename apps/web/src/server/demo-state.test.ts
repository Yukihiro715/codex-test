import { describe, expect, it } from 'vitest';
import { DEMO_STATE_MAX_HISTORY, EMPTY_DEMO_STATE, decodeDemoState, encodeDemoState, withHistory, withOverride } from './demo-state';

describe('管理画面デモの状態（Cookie）', () => {
  it('エンコードして元に戻せる', () => {
    const state = withOverride(EMPTY_DEMO_STATE, 'demo_agency', { publicEnabled: false });
    expect(decodeDemoState(encodeDemoState(state))).toEqual(state);
  });

  it('不正な値・改ざんされた値は空の状態として扱う', () => {
    expect(decodeDemoState('not-base64-json')).toEqual(EMPTY_DEMO_STATE);
    const tampered = Buffer.from(JSON.stringify({ v: 1, overrides: { 'bad id!': { publicEnabled: true } }, history: [] })).toString('base64url');
    expect(decodeDemoState(tampered)).toEqual(EMPTY_DEMO_STATE);
  });

  it('操作履歴は新しい順に上限件数まで', () => {
    let state = EMPTY_DEMO_STATE;
    for (let i = 0; i < DEMO_STATE_MAX_HISTORY + 3; i += 1) {
      state = withHistory(state, { at: `2026-09-29T00:00:${String(i).padStart(2, '0')}Z`, sourceId: 'demo_agency', action: 'pause', result: 'applied' });
    }
    expect(state.history).toHaveLength(DEMO_STATE_MAX_HISTORY);
    expect(state.history[0]?.at).toBe('2026-09-29T00:00:14Z');
  });
});
