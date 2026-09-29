import { isMemberProvider, type MemberProviderId } from '@/lib/member';
import { hmacSign, signatureMatches } from './signing';

/**
 * 会員ログインのデモ用セッション（M0）。署名付きCookieをサーバー側で検証する。
 * 外部サービスには接続しない。M1で認証ライブラリ（OAuth/OIDC・メールリンク）とDBのセッションに置き換える。
 */
export const MEMBER_COOKIE = 'km_member';
/** 「ログイン状態を保持する」を選んだ場合の有効期間（30日） */
export const MEMBER_REMEMBER_SECONDS = 30 * 24 * 60 * 60;
/** 保持しない場合はブラウザを閉じるまで（Cookieに期限を付けない）。トークン自体は24時間で無効 */
export const MEMBER_SESSION_SECONDS = 24 * 60 * 60;

/** 開発・デモ用の既定の署名キー。本番（APP_ENV=production）では使わない */
const DEV_MEMBER_SECRET = 'worklens-demo-member-secret-not-for-production';

export function resolveMemberSecret(env: { MEMBER_SESSION_SECRET?: string; APP_ENV?: string }): string | null {
  if (env.MEMBER_SESSION_SECRET && env.MEMBER_SESSION_SECRET.length >= 16) return env.MEMBER_SESSION_SECRET;
  return env.APP_ENV === 'production' ? null : DEV_MEMBER_SECRET;
}

export interface MemberToken {
  provider: MemberProviderId;
  remember: boolean;
  issuedAt: number;
}

export function createMemberToken(secret: string, input: { provider: MemberProviderId; remember: boolean }, nowMs: number = Date.now()): string {
  const payload = `m1.${input.provider}.${input.remember ? 1 : 0}.${Math.floor(nowMs / 1000)}`;
  return `${payload}.${hmacSign(payload, secret)}`;
}

export function verifyMemberToken(token: string | undefined, secret: string | null, nowMs: number = Date.now()): MemberToken | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'm1') return null;
  const [version, provider, rememberFlag, issued, signature] = parts as [string, string, string, string, string];
  if (!isMemberProvider(provider) || (rememberFlag !== '0' && rememberFlag !== '1')) return null;
  const issuedAt = Number(issued);
  if (!Number.isInteger(issuedAt)) return null;
  const remember = rememberFlag === '1';
  const age = Math.floor(nowMs / 1000) - issuedAt;
  if (age < 0 || age > (remember ? MEMBER_REMEMBER_SECONDS : MEMBER_SESSION_SECONDS)) return null;
  if (!signatureMatches(`${version}.${provider}.${rememberFlag}.${issued}`, signature, secret)) return null;
  return { provider, remember, issuedAt };
}
