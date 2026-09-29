import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { InfoPage } from '@/components/layout/info-page';
import { LEGAL_DRAFT_LABEL, SITE, formatLegalDate, operatorAddress, operatorFullName } from '@/lib/site';

export const metadata: Metadata = { title: '求人マップにおける情報の取扱い', alternates: { canonical: '/privacy' } };

/**
 * 運営会社のプライバシーポリシーを補う、本サービス固有の情報の取扱い（利用目的・保存期間・外部送信）。
 * 保存期間は草案の値。本番の実装（ログ・申請の保存）と法務確認にあわせて確定する。
 */
const ITEMS: { info: string; how: string; purpose: string; retention: string }[] = [
  {
    info: '保存・比較した求人のID',
    how: 'お使いのブラウザ内（localStorage）に記録します。保存・比較の画面を表示するときに、表示に必要な求人のIDだけをサーバーに送ります。',
    purpose: '保存・比較の機能の提供',
    retention: 'ブラウザから削除されるまで。利用者ごとの保存一覧をサーバーに記録することはありません。',
  },
  {
    info: '検索条件（キーワード・勤務地・絞り込み条件）',
    how: '検索時にページのURLとしてサーバーに送られます。',
    purpose: '検索結果の表示',
    retention: 'アクセスログとして下記の期間。キーワードに氏名や連絡先を入力しないでください。',
  },
  {
    info: 'アクセスログ（IPアドレス、ブラウザの種類、閲覧したURL、参照元、日時）',
    how: 'サーバーと配信サービスが自動的に記録します。',
    purpose: '障害対応、不正アクセスや過度なアクセスの防止、サービス改善のための集計',
    retention: '最長90日（草案）',
  },
  {
    info: '掲載元へのご案内の記録（求人のID、掲載元、日時、PRかどうか）',
    how: '「元の求人ページへ」などの操作時に記録します（本番公開後）。',
    purpose: '掲載元へのご案内件数の集計、PR広告の請求と無効なクリックの判定（広告の契約がある場合）',
    retention: '集計後は個人を識別できない形で保存。請求の根拠となる記録は法令で定める期間（草案）',
  },
  {
    info: '訂正・削除の申請、お問い合わせの内容（種類、内容、対象のURL、申請者の立場。返信を希望する場合はメールアドレスとお名前）',
    how: '申請・お問い合わせフォームへの入力で取得します。',
    purpose: '申請への対応、対応結果の連絡、同じ内容の申請への対応、苦情の処理',
    retention: '対応の完了から1年間（草案）。その後削除します。',
  },
  {
    info: '連続送信の判定に使う値（接続元の情報をハッシュ化した値）',
    how: '申請・お問い合わせの送信時に生成します。',
    purpose: 'スパムや連続送信の防止',
    retention: '判定に必要な時間だけ（最長24時間）。IPアドレスそのものを申請の内容と一緒に保存しません。',
  },
];

export default function PrivacyPage() {
  const effective = SITE.legal.privacyNoteEffectiveDate;
  return (
    <InfoPage
      title="求人マップにおける情報の取扱い"
      lead={`${operatorFullName()}（以下「当社」）は、個人情報を当社のプライバシーポリシーに従って取り扱います。このページでは、${SITE.name}（以下「本サービス」）で取り扱う情報と利用目的などを補足します。`}
      draft={effective ? undefined : LEGAL_DRAFT_LABEL}
    >
      <section>
        <h2>運営会社のプライバシーポリシー</h2>
        <p className="mt-2">
          個人情報の取扱いの基本方針、安全管理、開示等のご請求の手続きは、
          <a href={SITE.operator.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" data-testid="corporate-privacy-link">
            株式会社プロセントのプライバシーポリシー
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">（新しいタブで開きます）</span>
          </a>
          に定めています。当社の名称・所在地・代表者は
          <a href={SITE.operator.companyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            会社概要
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">（新しいタブで開きます）</span>
          </a>
          をご覧ください。
        </p>
      </section>

      <section>
        <h2>本サービスで行わないこと</h2>
        <ul className="mt-2">
          <li>会員登録、履歴書・職務経歴書の受付、応募の取次ぎは行いません。</li>
          <li>閲覧・保存の履歴にもとづいて、利用者ごとに求人を推薦することはしません。</li>
          <li>取得した情報を、法令にもとづく場合などを除き、ご本人の同意なく第三者に提供しません。</li>
        </ul>
      </section>

      <section>
        <h2>取り扱う情報と利用目的</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="取り扱う情報と利用目的の表">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-page text-left">
              <tr>
                <th scope="col" className="w-1/4 border-b border-line p-3">
                  情報
                </th>
                <th scope="col" className="w-1/4 border-b border-line p-3">
                  取得のしかた
                </th>
                <th scope="col" className="w-1/4 border-b border-line p-3">
                  利用目的
                </th>
                <th scope="col" className="w-1/4 border-b border-line p-3">
                  保存期間
                </th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((item) => (
                <tr key={item.info} className="align-top">
                  <th scope="row" className="border-b border-line p-3 text-left font-bold">
                    {item.info}
                  </th>
                  <td className="border-b border-line p-3">{item.how}</td>
                  <td className="border-b border-line p-3">{item.purpose}</td>
                  <td className="border-b border-line p-3">{item.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">現在のデモ環境では、申請・お問い合わせの内容と掲載元へのご案内の記録を保存していません。</p>
      </section>

      <section>
        <h2>Cookieと外部への情報送信</h2>
        <ul className="mt-2">
          <li>一般の利用者のブラウザに、当社はCookieを設定しません（運営者が使う管理画面のログインを除きます）。</li>
          <li>
            本サービスのページには、利用者の端末から当社以外の第三者へ情報を送信させるタグ（アクセス解析、広告配信、SNSボタンなど）を組み込んでいません。導入する場合は、送信先、送信される情報、利用目的を、事前にこのページで公表します。
          </li>
          <li>検索キーワードなどの自由記述を、そのままの形でアクセス解析に送ることはしません。</li>
        </ul>
      </section>

      <section>
        <h2>業務の委託と保存場所</h2>
        <p className="mt-2">
          サーバー、データベース、メール送信などの運用を外部の事業者に委託することがあります。その場合は、当社のプライバシーポリシーに従って委託先を監督します。利用するサービスの提供事業者と保存場所の国名は、本番公開前にこのページで公表します。
        </p>
      </section>

      <section>
        <h2>求人情報に含まれる個人情報</h2>
        <p className="mt-2">
          求人情報に採用担当者の個人名や直通の連絡先などが含まれている場合、表示の許諾がない限り本サービスには表示しません。表示されている場合は、
          <Link href="/report">申請フォーム</Link>
          の「個人情報が掲載されている」からご連絡ください。
        </p>
      </section>

      <section>
        <h2>お問い合わせ・開示等のご請求</h2>
        <p className="mt-2">
          本サービスでの情報の取扱いについてのお問い合わせは、
          <Link href="/report">お問い合わせフォーム</Link>
          で「サービスについてのお問い合わせ」を選んでお送りください。保有個人データの開示・訂正・利用停止等のご請求は、当社のプライバシーポリシーに定める手続きにより受け付けます。
        </p>
      </section>

      <section className="border-t border-line pt-4 text-sm">
        <p>{effective ? `${formatLegalDate(effective)} 制定` : '制定日：本番公開時に記載します（現在は草案です）'}</p>
        <p className="mt-2">このページの内容を変更する場合は、変更後の内容をこのページに掲示します。</p>
        <p className="mt-2">
          {operatorFullName()}
          <br />
          {operatorAddress()}
        </p>
      </section>
    </InfoPage>
  );
}
