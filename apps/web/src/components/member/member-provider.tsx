'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MemberSummary } from '@/lib/member';

interface MemberContextValue {
  /** ログインの入口を出すか（サーバーの設定。M0 ではデモのログインが使える環境だけ true） */
  loginAvailable: boolean;
  /** loading の間はログイン状態が未確定 */
  status: 'loading' | 'ready';
  member: MemberSummary | null;
  refresh: () => Promise<void>;
}

/** ログイン中の会員を取得する（失敗しても例外を出さず null を返す） */
async function fetchMember(): Promise<MemberSummary | null> {
  try {
    const res = await fetch('/api/member/session', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { member?: MemberSummary | null };
    return data.member ?? null;
  } catch {
    return null;
  }
}

const MemberContext = createContext<MemberContextValue>({
  loginAvailable: false,
  status: 'ready',
  member: null,
  refresh: async () => {},
});

/**
 * ログイン状態をブラウザ側で取得して配る。ページ自体は静的に生成したまま（Cookie を読まない）にし、
 * ヘッダーなどの表示だけを後から切り替える。ログインの入口がない環境では通信しない。
 */
export function MemberProvider({ loginAvailable, children }: { loginAvailable: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready'; member: MemberSummary | null }>(() => ({
    status: loginAvailable ? 'loading' : 'ready',
    member: null,
  }));

  /** ログイン・ログアウトの後に呼ぶ（画面を読み直さずにヘッダーなどを切り替える） */
  const refresh = useCallback(async () => {
    if (!loginAvailable) return;
    const member = await fetchMember();
    setState({ status: 'ready', member });
  }, [loginAvailable]);

  useEffect(() => {
    if (!loginAvailable) return;
    let cancelled = false;
    fetchMember().then((member) => {
      if (!cancelled) setState({ status: 'ready', member });
    });
    return () => {
      cancelled = true;
    };
  }, [loginAvailable]);

  const value = useMemo(() => ({ loginAvailable, status: state.status, member: state.member, refresh }), [loginAvailable, state, refresh]);
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember(): MemberContextValue {
  return useContext(MemberContext);
}

/** ログイン・ログアウトの API 呼び出し（デモ）。成功したら呼び出し側で refresh() と画面の移動を行う */
export async function demoLogin(provider: MemberSummary['provider'], remember: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/member/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, remember }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: data.message ?? 'ログインできませんでした。時間をおいて再度お試しください。' };
  } catch {
    return { ok: false, message: '通信に失敗しました。接続を確認して再度お試しください。' };
  }
}

export async function logout(): Promise<boolean> {
  try {
    const res = await fetch('/api/member/session', { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
