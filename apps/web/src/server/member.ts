import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MemberSummary } from '@/lib/member';
import { MEMBER_COOKIE, verifyMemberToken } from './member-auth';
import { getMemberSecret, isMemberDemoLoginEnabled } from './env';

/** デモ会員の表示名（実在の人物・アカウントを表さない） */
const DEMO_DISPLAY_NAME = 'デモ会員';

/** ログイン中の会員。ログインしていない・デモのログインが使えない環境では null */
export async function readMemberSession(): Promise<MemberSummary | null> {
  if (!isMemberDemoLoginEnabled()) return null;
  const jar = await cookies();
  const token = verifyMemberToken(jar.get(MEMBER_COOKIE)?.value, getMemberSecret());
  return token ? { provider: token.provider, displayName: DEMO_DISPLAY_NAME, demo: true } : null;
}

/** 会員向けページのサーバー側の確認。ログインしていなければログイン画面へ（戻り先つき） */
export async function requireMemberPage(nextPath: string): Promise<MemberSummary> {
  const member = await readMemberSession();
  if (!member) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return member;
}

export function demoMember(provider: MemberSummary['provider']): MemberSummary {
  return { provider, displayName: DEMO_DISPLAY_NAME, demo: true };
}
