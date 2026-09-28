import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 管理画面デモの簡易セッション（M0）。署名付きCookieをサーバー側で検証する。
 * 画面のボタンを隠すだけに頼らず、proxy・ページ・APIのすべてで検証する（SEC04）。
 * M1で正式な認証・RBAC・監査ログに置き換える。
 */
export const ADMIN_COOKIE = 'wl_admin';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

/** 開発・デモ用の既定の署名キー。本番（APP_ENV=production）では使わない */
const DEV_ADMIN_SECRET = 'worklens-demo-admin-secret-not-for-production';

/** 署名キー。本番で ADMIN_SESSION_SECRET が未設定なら null（管理画面を使えない） */
export function resolveAdminSecret(env: { ADMIN_SESSION_SECRET?: string; APP_ENV?: string }): string | null {
  if (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 16) return env.ADMIN_SESSION_SECRET;
  return env.APP_ENV === 'production' ? null : DEV_ADMIN_SECRET;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAdminToken(secret: string, nowMs: number = Date.now()): string {
  const payload = `v1.${Math.floor(nowMs / 1000)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminToken(token: string | undefined, secret: string | null, nowMs: number = Date.now()): boolean {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isInteger(issuedAt)) return false;
  const age = Math.floor(nowMs / 1000) - issuedAt;
  if (age < 0 || age > ADMIN_SESSION_TTL_SECONDS) return false;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2] ?? '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
