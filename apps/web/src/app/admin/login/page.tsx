import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { isAdminDemoLoginEnabled } from '@/server/env';

export const metadata: Metadata = { title: '管理画面デモ ログイン', robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/admin/sources';
  const enabled = isAdminDemoLoginEnabled();
  return (
    <div className="page-container py-10">
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <p className="flex items-center gap-2 text-sm font-bold text-muted">
          <Lock aria-hidden className="size-4" />
          管理画面デモ
        </p>
        <h1 className="mt-2 text-2xl font-bold">ログイン</h1>
        {enabled ? (
          <>
            <p className="mt-3 text-sm text-muted">
              M0の管理画面は動作確認用のデモです。正式な認証・権限管理・監査ログはM1で実装します。デモの操作はこのブラウザにだけ反映されます。
            </p>
            <form action="/api/admin/session" method="post" className="mt-5">
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-primary px-5 font-bold text-white hover:bg-primary-hover">
                デモ管理者としてログイン
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">この環境ではデモ管理者ログインを使えません（本番環境・live モードでは無効）。</p>
        )}
      </div>
    </div>
  );
}
