import { z } from 'zod';
import occupationsConfig from '../../../config/occupations.json';

const occupationSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().min(1),
  specializedUi: z.boolean(),
  compareFields: z.array(z.string().min(1)).min(1),
});

const configSchema = z.object({
  version: z.number(),
  note: z.string().optional(),
  occupations: z.array(occupationSchema).min(1),
});

export type Occupation = z.infer<typeof occupationSchema>;

/** config/occupations.json を実行時検証して読み込む（職種の追加は設定で行う） */
export const OCCUPATIONS: readonly Occupation[] = configSchema.parse(occupationsConfig).occupations;

const bySlug = new Map(OCCUPATIONS.map((o) => [o.slug, o]));

export function getOccupation(slug: string): Occupation | undefined {
  return bySlug.get(slug);
}

export function occupationLabel(slug: string): string {
  return bySlug.get(slug)?.label ?? '職種未分類';
}

export function isOccupationSlug(value: string): boolean {
  return bySlug.has(value);
}

/**
 * 職種ハブの見出しや比較ポイントの補足（静的な説明文）。
 * AIで長文を生成せず、比較で見る観点だけを短く示す。
 */
export const OCCUPATION_GUIDES: Record<string, { hubTitle: string; points: string[] }> = {
  driver: {
    hubTitle: 'ドライバーの仕事を、働き方から探す。',
    points: [
      '必要な免許の種類（普通・準中型・中型・大型）と、取得支援の有無',
      '地場・中距離・長距離の区分と、毎日帰宅できるか',
      '手積み・手降ろしの有無（記載がない場合は応募先で確認）',
    ],
  },
  manufacturing: {
    hubTitle: '製造・軽作業の仕事を、シフトと環境から探す。',
    points: [
      '日勤のみか、交替制・夜勤があるか',
      '寮の有無と費用の記載',
      '作業内容と重量物の扱い、直接雇用か派遣か',
    ],
  },
  nurse: {
    hubTitle: '看護師の仕事を、施設と夜勤から探す。',
    points: [
      '施設の種類（病院・クリニック・訪問看護など）',
      '夜勤の回数とオンコールの有無（日勤のみでもオンコールがある場合があります）',
      '必要資格（准看護師が応募できるか）',
    ],
  },
  engineer: {
    hubTitle: 'IT・エンジニアの仕事を、技術と働き方から探す。',
    points: [
      '使う技術スタック',
      'フルリモートか一部出社か、出社頻度',
      '自社開発・受託開発・社内ITなどの業務形態と担当工程、雇用か業務委託か',
    ],
  },
  care: {
    hubTitle: '介護・福祉の仕事を、資格と施設から探す。',
    points: ['施設の種類', '必要資格', '夜勤の有無と勤務時間'],
  },
  office: {
    hubTitle: '事務の仕事を、業務内容と勤務時間から探す。',
    points: ['担当する業務', '経験の要否', '勤務時間と雇用形態'],
  },
  sales: {
    hubTitle: '営業の仕事を、顧客と商材から探す。',
    points: ['顧客（新規・既存、法人・個人）', '扱う商材', '勤務時間と雇用形態'],
  },
  service: {
    hubTitle: '飲食・販売の仕事を、店舗とシフトから探す。',
    points: ['店舗の種類', '担当する業務', 'シフトと雇用形態'],
  },
};
