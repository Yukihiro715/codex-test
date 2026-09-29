/**
 * サービス名・運営会社などのサイト情報（表示の正本はここだけ）。
 * 会社名・所在地は株式会社プロセントの会社概要ページ（https://prosent.co.jp/company）の表記に合わせる。
 * 問い合わせ・苦情・開示等の請求は申請・お問い合わせフォームを主な窓口にする。電話番号は運営会社の情報として掲示する。
 */
export const SITE = {
  name: '求人マップ',
  tagline: '働き方の違いまで、比べて探す。',
  description: '職種ごとに必要な条件をそろえて、公開求人を横断比較。気になる仕事は、元の掲載ページで詳しく確認できます。',
  domain: 'kyujinmap.jp',
  url: 'https://kyujinmap.jp',
  operator: {
    name: '株式会社プロセント',
    nameEn: 'Prosent,Inc.',
    postalCode: '104-0054',
    address: '東京都中央区勝どき1-3-1-43F',
    corporateUrl: 'https://prosent.co.jp/',
    companyUrl: 'https://prosent.co.jp/company',
    privacyPolicyUrl: 'https://prosent.co.jp/privacy-policy/',
    /**
     * 電話番号（2026-09-29 運営者が掲示を決定）。フッターと運営会社のページに表示する。
     * ハローワークの求人の転載には、サイト内への掲示が必要（サイトポリシー・職業安定法の指針 第4の5）。
     */
    phone: '03-6732-9992' as string | null,
  },
  /**
   * 募集情報等提供事業（特定募集情報等提供）の届出。受理番号（形式：51-募-XXXXXX）が届いたら number に設定すると、
   * 運営会社のページに表示する（表示は法令上の義務ではない）。2026-09-29時点：出願中（番号なし）。
   */
  notification: {
    number: null as string | null,
  },
  /**
   * 利用規約・情報の取扱いの施行日（YYYY-MM-DD、JST）。法務確認と公開日が決まるまでは null とし、
   * 画面に「草案・法務確認前」を表示する。
   */
  legal: {
    termsEffectiveDate: null as string | null,
    privacyNoteEffectiveDate: null as string | null,
  },
} as const;

/** 法務確認前のページに表示するバッジの文言 */
export const LEGAL_DRAFT_LABEL = '草案・法務確認前（本番公開前に確定）';

/** YYYY-MM-DD を「2026年10月1日」の形にする（施行日の表示用） */
export function formatLegalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function operatorFullName(): string {
  return `${SITE.operator.name}（${SITE.operator.nameEn}）`;
}

export function operatorAddress(): string {
  return `〒${SITE.operator.postalCode} ${SITE.operator.address}`;
}

/** ページタイトルの接尾辞（デモでは「（デモ）」を付けて本番と区別する） */
export function titleSuffix(demo: boolean): string {
  return `｜${SITE.name}${demo ? '（デモ）' : ''}`;
}
