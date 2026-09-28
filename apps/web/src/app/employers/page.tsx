import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: '採用ご担当者の方へ' };

export default function EmployersPage() {
  return (
    <InfoPage title="採用ご担当者の方へ" lead="掲載内容の訂正・停止のご依頼と、今後の広告掲載についてのご案内です。">
      <section>
        <h2>掲載内容の訂正・停止</h2>
        <p>
          貴社の求人の掲載内容に誤りがある場合や、掲載の停止をご希望の場合は、<Link href="/report">訂正・削除の申請フォーム</Link>からご連絡ください。求人単位・企業単位でのご依頼を受け付けます。
        </p>
      </section>
      <section>
        <h2>広告（PR）掲載について</h2>
        <ul>
          <li>現在、有料の広告掲載は受け付けていません（準備中）。</li>
          <li>開始する場合は、掲載権限の確認・契約内容・クリック単価・予算上限・停止方法・無効クリックの扱いを、契約前にご説明します。</li>
          <li>一般の求人掲載や、元ページへの無料のご案内に費用はかかりません。契約のない企業に請求することはありません。</li>
        </ul>
      </section>
    </InfoPage>
  );
}
