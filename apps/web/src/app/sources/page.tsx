import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: '収集方針' };

export default function SourcesPolicyPage() {
  return (
    <InfoPage title="収集方針" lead="求人情報の集め方・表示のしかた・停止の考え方です。">
      <section>
        <h2>表示する情報</h2>
        <ul>
          <li>公開されている求人から、比較に必要な事実条件（職種名、企業名、勤務地、給与の単位と範囲、雇用形態、明記された必要資格・勤務形態など）を整理して表示します。</li>
          <li>掲載元の名称・元のページへのリンク・当サービスが情報を確認した日時を表示します。</li>
          <li>原稿の全文、写真、ロゴ、担当者の個人名・直通連絡先は、表示の許諾がない限り表示しません。</li>
          <li>記載のない条件を推測で補いません。給与・資格・待遇は原文にある範囲だけを表示し、記載がないものは「記載なし」とします。</li>
        </ul>
      </section>
      <section>
        <h2>集め方と停止</h2>
        <ul>
          <li>情報源ごとに、利用条件・取得範囲・表示方法を個別に確認して記録し、確認できたものだけを有効にします。robots.txt の許可や構造化データの存在を、再掲載の許諾とはみなしません。</li>
          <li>アクセス制限の回避、他社のクローラーへのなりすまし、ログインが必要なページの取得は行いません。拒否・制限を受けた場合は取得を停止します。</li>
          <li>情報源の停止や削除のご依頼は、検索結果・求人ページ・元ページへのご案内まで反映します。</li>
        </ul>
      </section>
      <section>
        <h2>訂正・削除</h2>
        <p>
          掲載内容の誤りや掲載停止のご希望は <Link href="/report">訂正・削除の申請フォーム</Link> から受け付けます。内容を確認し、必要な対応を行います。
        </p>
      </section>
      <p className="text-sm text-muted">この方針は草案です。実データの公開前に、情報源ごとの確認記録とあわせて確定します。</p>
    </InfoPage>
  );
}
