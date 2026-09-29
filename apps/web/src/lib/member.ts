/**
 * 会員機能（ログイン・マイページ）の共通定義。サーバーとブラウザの両方で使う。
 * M0 は外部サービスに接続しないデモ。本実装（M1）では認証ライブラリと各社の公式ボタン素材に置き換える（docs/09_ACCOUNTS.md）。
 */
export const MEMBER_PROVIDERS = [
  { id: 'google', name: 'Google', action: 'Googleで続ける' },
  { id: 'yahoo_japan', name: 'Yahoo! JAPAN ID', action: 'Yahoo! JAPAN IDで続ける' },
  { id: 'line', name: 'LINE', action: 'LINEで続ける' },
  { id: 'apple', name: 'Apple', action: 'Appleで続ける' },
  { id: 'email', name: 'メールアドレス', action: 'メールアドレスで続ける' },
] as const;

export type MemberProviderId = (typeof MEMBER_PROVIDERS)[number]['id'];

const PROVIDER_IDS = new Set<string>(MEMBER_PROVIDERS.map((p) => p.id));

export function isMemberProvider(value: unknown): value is MemberProviderId {
  return typeof value === 'string' && PROVIDER_IDS.has(value);
}

export function memberProviderName(id: MemberProviderId): string {
  return MEMBER_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

/** ログイン中の会員（画面表示に必要な最小限の情報だけ） */
export interface MemberSummary {
  provider: MemberProviderId;
  displayName: string;
  /** デモの会員（外部サービスに接続していない） */
  demo: boolean;
}

/**
 * ログイン後に戻る先。サイト内の相対パスだけを許可し、API・外部遷移・管理画面・ログイン画面自体は既定の戻り先にする
 * （オープンリダイレクトの防止）。
 */
export function safeReturnPath(value: string | null | undefined, fallback = '/mypage'): string {
  if (!value || value.length > 500) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some((c) => c.charCodeAt(0) < 0x20)) return fallback;
  if (/^\/(api|out|admin|login)(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}
