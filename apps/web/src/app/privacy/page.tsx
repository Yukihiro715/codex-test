import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: 'プライバシー（草案）' };

export default function PrivacyPage() {
  return (
    <InfoPage title="プライバシーについて（草案）" lead="会員登録・履歴書の収集・求人の個人向け推薦は行っていません。">
      <section>
        <h2>保存と比較</h2>
        <p>保存・比較した求人のIDは、お使いのブラウザ（localStorage）にだけ保存します。サーバーには送信・保存せず、他の端末には引き継がれません。</p>
      </section>
      <section>
        <h2>アクセス解析</h2>
        <p>現在、外部のアクセス解析ツールは使用していません。導入する場合は、送信する情報と保存期間を事前にこのページで明示します。検索キーワードなどの自由記述は、そのままの形では解析に送りません。</p>
      </section>
      <section>
        <h2>訂正・削除の申請</h2>
        <p>返信を希望された場合に限り、メールアドレスとお名前（任意）をお預かりし、申請への対応の目的だけに使います。デモ環境では申請内容を保存・送信しません。</p>
      </section>
      <section>
        <h2>不正対策</h2>
        <p>申請の連続送信を防ぐため、接続元の情報をハッシュ化した値を短時間だけ利用します。IPアドレスそのものを長期保存しません。</p>
      </section>
    </InfoPage>
  );
}
