export const LANE_LABELS: Record<string, string> = {
  OPEN_REUSE: 'A 転載条件あり',
  PUBLIC_FACT_INDEX: 'B 公開事実インデックス',
  DISPUTED_SCOPE: 'C 範囲確認中',
  EXCLUDED: 'D 除外',
};

export const ROBOTS_LABELS: Record<string, string> = {
  unverified: '未確認（許可扱いしない）',
  allow: '許可',
  disallow: '拒否',
  unreachable: '取得不可（許可扱いしない）',
  not_applicable: '対象外（架空fixture）',
};
