/** 都道府県（JIS X 0401 コード） */
export interface Prefecture {
  code: string;
  name: string;
  /** 「都・道・府・県」を除いた短い名前（北海道はそのまま） */
  shortName: string;
}

const NAMES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;

export const PREFECTURES: readonly Prefecture[] = NAMES.map((name, index) => ({
  code: String(index + 1).padStart(2, '0'),
  name,
  shortName: name === '北海道' ? name : name.replace(/[都府県]$/, ''),
}));

const byCode = new Map(PREFECTURES.map((p) => [p.code, p]));

export function getPrefectureByCode(code: string): Prefecture | undefined {
  return byCode.get(code);
}

/** 正式名・短縮名（例：東京、大阪）と完全一致する都道府県を返す */
export function findPrefectureByName(input: string): Prefecture | undefined {
  const text = input.normalize('NFKC').trim();
  if (!text) return undefined;
  return PREFECTURES.find((p) => p.name === text || p.shortName === text);
}
