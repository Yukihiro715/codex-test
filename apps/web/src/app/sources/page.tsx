import type { Metadata } from 'next';
import Link from 'next/link';
import { CRAWLER_UA_TOKEN, CRAWLER_USER_AGENT, STALE_WARNING_AFTER_HOURS } from '@worklens/domain';
import { InfoPage } from '@/components/layout/info-page';
import { LEGAL_DRAFT_LABEL } from '@/lib/site';

export const metadata: Metadata = { title: '収集方針', alternates: { canonical: '/sources' } };

/** 確認できない求人を検索から外すまでの標準の時間（情報源ごとの設定の上限。これより短い情報源もある） */
const STANDARD_HIDE_AFTER_DAYS = 7;

/**
 * 収集方針。募集情報等提供事業（収集型）として、収集・更新の頻度、情報の時点、表示順の主な要素、
 * 苦情の窓口などを明らかにする（職業安定法5条の4・43条の6と業務運営要領にもとづく）。
 */
export default function SourcesPolicyPage() {
  return (
    <InfoPage title="収集方針" lead="求人情報の集め方・表示のしかた・停止の考え方です。" draft={LEGAL_DRAFT_LABEL}>
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
        <h2>収集・更新の頻度と情報の時点</h2>
        <ul>
          <li>掲載中の求人は、情報源ごとに定めた周期（原則24〜72時間ごと）で掲載元を確認し直します。</li>
          <li>求人ごとに、当サービスが掲載元の情報を確認した日時を「情報確認」として表示します。確認から{STALE_WARNING_AFTER_HOURS}時間を過ぎた求人には、その旨を表示します。</li>
          <li>
            掲載元で確認できなくなった求人は、募集終了と断定せずに確認を続け、原則{STANDARD_HIDE_AFTER_DAYS}日以内に検索結果から外します（取消の反映を早く求められる情報源は、より短い時間で外します）。掲載元で終了・削除が確認できた求人はすぐに外します。
          </li>
        </ul>
      </section>
      <section>
        <h2>表示の順番</h2>
        <ul>
          <li>おすすめ順：検索条件に合う項目の数、比較に必要な条件の記載の充実度、情報確認の新しさ、キーワードとの一致の順に並べます。</li>
          <li>新着順：掲載元に記載された掲載開始日の新しい順です。掲載開始日がない場合は、当サービスが初めて確認した日を使います。</li>
          <li>給与順：選んだ給与の単位（月給・時給など）で確認できた給与の下限が高い順です。単位の違う給与は混ぜて比べません。</li>
          <li>広告（PR）は「PR」と表示し、検索結果とは別の枠に表示します。広告費の支払いは、PR枠以外の並び順に影響しません。閲覧履歴など、利用者個人の情報は並び順に使いません。</li>
        </ul>
      </section>
      <section>
        <h2>集め方と停止</h2>
        <ul>
          <li>情報源ごとに、利用条件・取得範囲・表示方法を個別に確認して記録し、確認できたものだけを有効にします。robots.txt の許可や構造化データの存在を、再掲載の許諾とはみなしません。</li>
          <li>アクセス制限の回避、他社のクローラーへのなりすまし、ログインが必要なページの取得は行いません。拒否・制限を受けた場合は取得を停止します。</li>
          <li>
            本番公開後の収集では、User-Agent に <code className="text-wrap-anywhere">{CRAWLER_USER_AGENT}</code> を名乗ります。サイトの運営者は、robots.txt に <code>User-agent: {CRAWLER_UA_TOKEN}</code> と <code>Disallow: /</code> を記載することで取得を止められます。
          </li>
          <li>情報源の停止や削除のご依頼は、検索結果・求人ページ・元ページへのご案内まで反映します。</li>
        </ul>
      </section>
      <section>
        <h2>訂正・削除と苦情の窓口</h2>
        <p>
          掲載内容の誤りや掲載停止のご希望、苦情は <Link href="/report">訂正・削除の申請・お問い合わせフォーム</Link> で受け付けます。内容を確認し、必要な対応を行います。採用企業・掲載元から訂正や掲載の停止を求められた場合は、確認のうえ速やかに反映します。
        </p>
      </section>
      <section>
        <h2>個人情報の管理</h2>
        <p>
          本サービスで取り扱う情報と利用目的、保存期間は <Link href="/privacy">求人マップにおける情報の取扱い</Link> をご覧ください。
        </p>
      </section>
      <p className="text-sm text-muted">この方針は草案です。実データの公開前に、情報源ごとの確認記録とあわせて確定します。</p>
    </InfoPage>
  );
}
