import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { SITE, operatorAddress, operatorFullName } from '@/lib/site';
import { isDemoMode } from '@/server/env';

const internalLinks = [
  { href: '/report', label: '掲載情報の訂正・削除・お問い合わせ' },
  { href: '/sources', label: '収集方針' },
  { href: '/terms', label: '利用規約' },
  { href: '/privacy', label: '求人マップにおける情報の取扱い' },
  { href: '/about', label: '運営会社' },
  { href: '/employers', label: '採用ご担当者へ' },
];

/**
 * フッター。運営会社名・所在地・問い合わせ窓口・訂正/削除・利用規約・プライバシー・収集方針を常に表示する。
 * 電話番号は SITE.operator.phone を設定した場合に表示する（問い合わせの主な窓口は申請・お問い合わせフォーム）。
 */
export function SiteFooter() {
  const demo = isDemoMode();
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="page-container py-8 text-sm text-muted">
        <p className="text-base font-bold text-ink">{SITE.name}</p>
        <nav aria-label="フッター" className="mt-3">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {internalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-primary hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={SITE.operator.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-muted underline-offset-4 hover:text-primary hover:underline"
              >
                プライバシーポリシー
                <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">（新しいタブで運営会社のサイトを開きます）</span>
              </a>
            </li>
            {demo ? (
              <li>
                <Link href="/admin/sources" className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-primary hover:underline">
                  管理画面デモ
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[auto_1fr]" data-testid="footer-operator">
          <dt className="font-bold">運営会社</dt>
          <dd>{operatorFullName()}</dd>
          <dt className="font-bold">所在地</dt>
          <dd>{operatorAddress()}</dd>
          {SITE.operator.phone ? (
            <>
              <dt className="font-bold">電話番号</dt>
              <dd>{SITE.operator.phone}</dd>
            </>
          ) : null}
          <dt className="font-bold">お問い合わせ</dt>
          <dd>
            <Link href="/report" className="text-muted underline">
              お問い合わせ・訂正・削除の申請フォーム
            </Link>
          </dd>
        </dl>
        <p className="mt-4 text-xs">公開情報をもとに条件を整理しています。募集状況・応募条件は掲載元でご確認ください。</p>
        <p className="mt-2 text-xs">© {SITE.operator.nameEn}</p>
      </div>
    </footer>
  );
}
