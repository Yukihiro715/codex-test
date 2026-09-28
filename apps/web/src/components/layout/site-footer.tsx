import Link from 'next/link';

const links = [
  { href: '/report', label: '掲載情報の訂正・削除' },
  { href: '/sources', label: '収集方針' },
  { href: '/terms', label: '利用規約（草案）' },
  { href: '/privacy', label: 'プライバシー（草案）' },
  { href: '/about', label: '運営者情報' },
  { href: '/employers', label: '採用ご担当者へ' },
  { href: '/admin/sources', label: '管理画面デモ' },
];

/**
 * フッター。運営法人名・所在地・電話番号・問い合わせは本番公開前に必須。
 * 未設定のまま架空の値を表示しない。
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="page-container py-8 text-sm text-muted">
        <p className="text-base font-bold text-ink">
          WORKLENS <span className="text-xs font-normal text-muted">開発仮称・商標未確認</span>
        </p>
        <nav aria-label="フッター" className="mt-3">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-primary hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">運営法人名</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">所在地</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">電話番号</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">お問い合わせ</dt>
          <dd>
            <Link href="/report" className="text-muted underline">
              訂正・削除の申請フォーム
            </Link>
            （一般のお問い合わせ窓口は本番公開前に設定）
          </dd>
        </dl>
        <p className="mt-4 text-xs">公開情報をもとに条件を整理しています。募集状況・応募条件は掲載元でご確認ください。</p>
      </div>
    </footer>
  );
}
