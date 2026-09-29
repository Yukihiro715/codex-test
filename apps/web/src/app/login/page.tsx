import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginPanel } from '@/components/member/login-panel';
import { safeReturnPath } from '@/lib/member';
import { isMemberLoginAvailable } from '@/server/env';
import { readMemberSession } from '@/server/member';

export const metadata: Metadata = { title: 'ログイン・会員登録', robots: { index: false, follow: false } };

/** ログイン・会員登録（M0はデモ）。戻り先はサイト内の相対パスだけを受け付ける */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = safeReturnPath(typeof sp.next === 'string' ? sp.next : null);
  const available = isMemberLoginAvailable();
  const member = available ? await readMemberSession() : null;

  return (
    <div className="page-container pb-12 pt-6 lg:pt-10">
      <div className="mx-auto max-w-[560px] rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10">
        <h1 className="text-[26px] font-extrabold leading-snug sm:text-[28px]">ログイン・無料会員登録</h1>
        <p className="mt-2 text-[15px] text-muted">登録済みの方はログイン、はじめての方はそのまま無料で会員登録に進みます。</p>
        {available ? (
          <LoginPanel next={next} member={member} />
        ) : (
          <div className="mt-6 rounded-xl bg-page p-5" data-testid="login-unavailable">
            <p className="font-bold">会員機能は準備中です。</p>
            <p className="mt-2 text-sm text-muted">
              求人の保存は、ログインしなくてもこのブラウザで使えます。<Link href="/saved">保存した求人を見る</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
