import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: 'ログインでお困りの方', robots: { index: false, follow: true } };

/** ログインのヘルプ（会員機能は準備中。M0 はデモ） */
export default function LoginHelpPage() {
  return (
    <InfoPage title="ログインでお困りの方" lead="会員機能（ログイン・マイページ）は準備中で、現在はデモとして動いています。" draft="準備中の機能（デモ）">
      <section>
        <h2>どの方法でログインすればよいですか</h2>
        <ul className="mt-2">
          <li>会員登録したときと同じ方法（Google・Yahoo! JAPAN ID・LINE・Apple・メールアドレス）でログインしてください。</li>
          <li>別の方法でログインすると、別の会員として登録されることがあります。マイページの「ログイン方法」から、あとで別の方法を追加できるようにする予定です。</li>
        </ul>
      </section>
      <section>
        <h2>ログインできないとき</h2>
        <ul className="mt-2">
          <li>ブラウザで Cookie を使わない設定にしているとログインできません。</li>
          <li>共用のパソコンでは「ログイン状態を保持する」をオフにして、使い終わったらログアウトしてください。</li>
          <li>メールアドレスでログインする場合は、メールで届いた6桁の確認コードを入力してください。コードの有効期限は短く設定しています。メールが届かないときは、迷惑メールのフォルダも確認してください。</li>
        </ul>
      </section>
      <section>
        <h2>Apple・LINE でメールアドレスを共有しなかった場合</h2>
        <ul className="mt-2">
          <li>Apple で「メールを非公開」を選んだ場合は、Apple が用意する転送用のアドレスあてにお知らせをお送りします。</li>
          <li>LINE でメールアドレスの提供を許可しなかった場合は、メールのお知らせは届きません。マイページでメールアドレスを登録できるようにする予定です。</li>
        </ul>
      </section>
      <section>
        <h2>退会したいとき</h2>
        <p className="mt-2">マイページの「退会する」から手続きできます。保存した検索条件・閲覧履歴・メール配信の設定などの会員情報を削除します。</p>
      </section>
      <section>
        <h2>それでも解決しないとき</h2>
        <p className="mt-2">
          <Link href="/report">お問い合わせフォーム</Link>で「サービスについてのお問い合わせ」を選んでお送りください。
        </p>
      </section>
    </InfoPage>
  );
}
