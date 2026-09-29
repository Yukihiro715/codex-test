import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { InfoPage } from '@/components/layout/info-page';
import { SITE, operatorAddress, operatorFullName } from '@/lib/site';

export const metadata: Metadata = { title: '運営会社', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return (
    <InfoPage title="運営会社" lead={`${SITE.name}（${SITE.domain}）の運営会社の情報です。`}>
      <section>
        <h2>会社情報</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]" data-testid="about-operator">
          <dt className="font-bold">会社名</dt>
          <dd>{operatorFullName()}</dd>
          <dt className="font-bold">所在地</dt>
          <dd>{operatorAddress()}</dd>
          {SITE.operator.phone ? (
            <>
              <dt className="font-bold">電話番号</dt>
              <dd>{SITE.operator.phone}</dd>
            </>
          ) : null}
          <dt className="font-bold">サービス名</dt>
          <dd>
            {SITE.name}（{SITE.domain}）
          </dd>
          <dt className="font-bold">お問い合わせ</dt>
          <dd>
            <Link href="/report">お問い合わせ・訂正・削除の申請フォーム</Link>
          </dd>
          {SITE.notification.number ? (
            <>
              <dt className="font-bold">募集情報等提供事業</dt>
              <dd>届出受理番号 {SITE.notification.number}</dd>
            </>
          ) : null}
          <dt className="font-bold">会社概要</dt>
          <dd>
            <a href={SITE.operator.companyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
              {SITE.operator.name}のサイト
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          </dd>
        </dl>
      </section>
      <section>
        <h2>このサービスについて</h2>
        <p>
          職種ごとに必要な条件をそろえて、公開されている求人を横断的に比較できる検索サービスです。求人の検索・比較と、元の掲載ページへのご案内を基本とし、職業紹介（あっせん）、応募の取り次ぎ、採用選考、条件交渉は行いません。
        </p>
      </section>
      <section>
        <h2>現在の状態</h2>
        <p>画面確認用のデモです。表示している求人・企業・金額はすべて架空で、実データの取得・応募受付・広告請求は行っていません。</p>
      </section>
    </InfoPage>
  );
}
