import { describe, expect, it } from 'vitest';
import { ADMIN_SESSION_TTL_SECONDS, createAdminToken, resolveAdminSecret, verifyAdminToken } from './admin-auth';

const secret = 'test-secret-0123456789';

describe('管理セッション（SEC04）', () => {
  it('署名したトークンだけを受け付ける', () => {
    const now = Date.UTC(2026, 8, 29, 12);
    const token = createAdminToken(secret, now);
    expect(verifyAdminToken(token, secret, now)).toBe(true);
    expect(verifyAdminToken(token, 'another-secret-xxxxxx', now)).toBe(false);
    expect(verifyAdminToken(`${token}x`, secret, now)).toBe(false);
    expect(verifyAdminToken('v1.9999999999.forged', secret, now)).toBe(false);
    expect(verifyAdminToken(undefined, secret, now)).toBe(false);
  });

  it('有効期限を過ぎたトークンは無効', () => {
    const issued = Date.UTC(2026, 8, 29, 0);
    const token = createAdminToken(secret, issued);
    expect(verifyAdminToken(token, secret, issued + (ADMIN_SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('本番で署名キーが未設定なら管理画面を使えない', () => {
    expect(resolveAdminSecret({ APP_ENV: 'production' })).toBeNull();
    expect(verifyAdminToken(createAdminToken(secret), resolveAdminSecret({ APP_ENV: 'production' }))).toBe(false);
    expect(resolveAdminSecret({ APP_ENV: 'local' })).not.toBeNull();
    expect(resolveAdminSecret({ APP_ENV: 'production', ADMIN_SESSION_SECRET: secret })).toBe(secret);
  });
});
