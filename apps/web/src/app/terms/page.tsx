import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: '利用規約（草案）' };

export default function TermsPage() {
  return (
    <InfoPage title="利用規約（草案）" lead="本番公開前に、実際の機能と運営体制にあわせて確定します。">
      <section>
        <h2>サービスの内容</h2>
        <ul>
          <li>公開求人の条件を検索・比較し、元の掲載ページをご案内するサービスです。当サービスでは応募の受付・取り次ぎ・選考を行いません。</li>
          <li>「情報確認」の日時は当サービスが情報を確認した日時であり、採用企業が募集の継続を保証するものではありません。募集状況・応募条件は必ず掲載元でご確認ください。</li>
        </ul>
      </section>
      <section>
        <h2>広告の表示</h2>
        <ul>
          <li>広告は「PR」と明記し、検索条件に合う求人だけを表示します。検索結果の並び順を広告費で見えない形に変えません。</li>
          <li>現在は広告の有料掲載・請求を行っていません。</li>
        </ul>
      </section>
      <section>
        <h2>禁止事項・免責</h2>
        <p>草案のため省略しています（本番公開前に確定）。</p>
      </section>
    </InfoPage>
  );
}
