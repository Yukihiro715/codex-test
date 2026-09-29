import { describe, expect, it } from 'vitest';
import { MEMBER_REMEMBER_SECONDS, MEMBER_SESSION_SECONDS, createMemberToken, resolveMemberSecret, verifyMemberToken } from './member-auth';
import { safeReturnPath } from '@/lib/member';

const secret = 'member-test-secret-0123';
const now = Date.UTC(2026, 8, 29, 12);

describe('会員セッション（デモ）', () => {
  it('署名したトークンだけを受け付け、ログイン方法と保持の有無を読み取る', () => {
    const token = createMemberToken(secret, { provider: 'line', remember: true }, now);
    expect(verifyMemberToken(token, secret, now)).toEqual({ provider: 'line', remember: true, issuedAt: Math.floor(now / 1000) });
    expect(verifyMemberToken(token, 'another-secret-xxxxxxx', now)).toBeNull();
    expect(verifyMemberToken(token.replace('.line.', '.apple.'), secret, now)).toBeNull();
    expect(verifyMemberToken(token.replace('.1.', '.0.'), secret, now)).toBeNull();
    expect(verifyMemberToken(`${token}x`, secret, now)).toBeNull();
    expect(verifyMemberToken('m1.github.1.1790000000.forged', secret, now)).toBeNull();
    expect(verifyMemberToken(undefined, secret, now)).toBeNull();
  });

  it('保持しない場合は24時間、保持する場合は30日で無効', () => {
    const session = createMemberToken(secret, { provider: 'google', remember: false }, now);
    expect(verifyMemberToken(session, secret, now + (MEMBER_SESSION_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifyMemberToken(session, secret, now + (MEMBER_SESSION_SECONDS + 1) * 1000)).toBeNull();
    const remembered = createMemberToken(secret, { provider: 'google', remember: true }, now);
    expect(verifyMemberToken(remembered, secret, now + (MEMBER_REMEMBER_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifyMemberToken(remembered, secret, now + (MEMBER_REMEMBER_SECONDS + 1) * 1000)).toBeNull();
  });

  it('本番で署名キーが未設定ならセッションを受け付けない', () => {
    expect(resolveMemberSecret({ APP_ENV: 'production' })).toBeNull();
    expect(verifyMemberToken(createMemberToken(secret, { provider: 'google', remember: true }, now), resolveMemberSecret({ APP_ENV: 'production' }), now)).toBeNull();
    expect(resolveMemberSecret({ APP_ENV: 'local' })).not.toBeNull();
    expect(resolveMemberSecret({ APP_ENV: 'production', MEMBER_SESSION_SECRET: secret })).toBe(secret);
  });
});

describe('ログイン後の戻り先', () => {
  it('サイト内の相対パスだけを許可する（オープンリダイレクトの防止）', () => {
    expect(safeReturnPath('/jobs?occupation=nurse&onCall=no')).toBe('/jobs?occupation=nurse&onCall=no');
    expect(safeReturnPath('/saved')).toBe('/saved');
    expect(safeReturnPath(null)).toBe('/mypage');
    expect(safeReturnPath('https://evil.example/')).toBe('/mypage');
    expect(safeReturnPath('//evil.example/')).toBe('/mypage');
    expect(safeReturnPath('/\\evil.example')).toBe('/mypage');
    expect(safeReturnPath('/jobs\nSet-Cookie: x')).toBe('/mypage');
    expect(safeReturnPath('javascript:alert(1)')).toBe('/mypage');
  });

  it('API・外部遷移・管理画面・ログイン画面には戻さない', () => {
    expect(safeReturnPath('/api/member/session')).toBe('/mypage');
    expect(safeReturnPath('/out/demo-driver-1')).toBe('/mypage');
    expect(safeReturnPath('/admin/sources')).toBe('/mypage');
    expect(safeReturnPath('/login?next=/mypage')).toBe('/mypage');
    expect(safeReturnPath('/loginhelp')).toBe('/loginhelp');
  });
});
