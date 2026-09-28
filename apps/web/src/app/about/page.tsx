import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: '運営者情報' };

export default function AboutPage() {
  return (
    <InfoPage title="運営者情報" lead="WORKLENS は開発仮称です。正式名称・商標・ドメインは未確認です。">
      <section>
        <h2>運営者</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">運営法人名</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">所在地</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">電話番号</dt>
          <dd>未設定（本番公開前に設定）</dd>
          <dt className="font-bold">お問い合わせ</dt>
          <dd>未設定（掲載内容については <Link href="/report">訂正・削除の申請フォーム</Link>）</dd>
        </dl>
        <p className="mt-2 text-sm text-muted">運営者情報が未設定のまま本番公開しません。架空の会社名・電話番号は表示しません。</p>
      </section>
      <section>
        <h2>このサービスについて</h2>
        <p>
          職種ごとに必要な条件をそろえて、公開されている求人を横断的に比較できる検索サービスです。求人広告の検索・比較と、元の掲載ページへのご案内を基本とし、人材紹介担当者による推薦、応募の取り次ぎ、採用選考、条件交渉は行いません。
        </p>
      </section>
      <section>
        <h2>現在の状態</h2>
        <p>画面確認用のデモです。表示している求人・企業・金額はすべて架空で、実データの取得・応募受付・広告請求は行っていません。</p>
      </section>
    </InfoPage>
  );
}
