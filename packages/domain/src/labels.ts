import type { ApplicationRoute, EmploymentType, KnownSalaryUnit, SalaryBasis, SalaryUnit } from './types';
import { normalizeText } from './text';

export const EMPLOYMENT_TYPES: readonly { value: EmploymentType; label: string }[] = [
  { value: 'fulltime', label: '正社員' },
  { value: 'contract', label: '契約社員' },
  { value: 'parttime', label: 'パート・アルバイト' },
  { value: 'dispatch', label: '派遣社員' },
  { value: 'freelance', label: '業務委託' },
  { value: 'other', label: 'その他' },
];

export function employmentTypeLabel(value: EmploymentType): string {
  return EMPLOYMENT_TYPES.find((e) => e.value === value)?.label ?? 'その他';
}

/** 原文の雇用形態表記を正規化する。判定できない表記は other（不明を正社員等に寄せない）。 */
export function normalizeEmploymentType(raw: string): EmploymentType {
  const text = normalizeText(raw);
  if (/正社員|正職員/.test(text)) return 'fulltime';
  if (/契約社員|契約職員/.test(text)) return 'contract';
  if (/パート|アルバイト/.test(text)) return 'parttime';
  if (/派遣/.test(text)) return 'dispatch';
  if (/業務委託|フリーランス/.test(text)) return 'freelance';
  return 'other';
}

export const APPLICATION_ROUTES: readonly { value: Exclude<ApplicationRoute, 'unknown'>; label: string }[] = [
  { value: 'employer', label: '企業へ直接応募' },
  { value: 'agency', label: '紹介会社・人材会社経由' },
  { value: 'hellowork', label: 'ハローワーク経由' },
  { value: 'jobboard', label: '求人媒体経由' },
];

export function applicationRouteLabel(route: ApplicationRoute): string {
  return APPLICATION_ROUTES.find((r) => r.value === route)?.label ?? '応募経路の記載なし';
}

/** 外部遷移ボタンの文言。自社で応募を受けないため「応募する」とは書かない。 */
export function outboundCtaLabel(route: ApplicationRoute): string {
  return route === 'hellowork' ? 'ハローワークで応募方法を確認' : '元の求人ページで確認';
}

export const SALARY_UNITS: readonly { value: KnownSalaryUnit; label: string; step: number; placeholder: string }[] = [
  { value: 'HOUR', label: '時給', step: 10, placeholder: '例：1200' },
  { value: 'DAY', label: '日給', step: 100, placeholder: '例：10000' },
  { value: 'MONTH', label: '月給', step: 1000, placeholder: '例：300000' },
  { value: 'YEAR', label: '年収', step: 10000, placeholder: '例：5000000' },
];

export function salaryUnitLabel(unit: SalaryUnit): string {
  return SALARY_UNITS.find((u) => u.value === unit)?.label ?? '単位の記載なし';
}

export function salaryBasisLabel(basis: SalaryBasis): string {
  switch (basis) {
    case 'base':
      return '基本給';
    case 'gross':
      return '総支給（手当等を含む）';
    case 'example':
      return '給与例';
    default:
      return '内訳の記載なし';
  }
}

export const FRESHNESS_OPTIONS = [
  { value: '24h', hours: 24, label: '24時間以内に確認' },
  { value: '72h', hours: 72, label: '3日（72時間）以内に確認' },
  { value: '168h', hours: 168, label: '7日（168時間）以内に確認' },
] as const;

export type FreshnessValue = (typeof FRESHNESS_OPTIONS)[number]['value'];

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'おすすめ順' },
  { value: 'newest', label: '新着順' },
  { value: 'salary', label: '給与の下限が高い順' },
] as const;

/** 並び替えの説明（画面の補足に表示） */
export const SORT_DESCRIPTIONS: Record<(typeof SORT_OPTIONS)[number]['value'], string> = {
  relevance: '条件の適合・情報の正確さ・鮮度・関連度の順で並べます（広告費で変えません）。',
  newest: '元の掲載開始日の新しい順。掲載開始日の記載がない求人は初回検出日を使い、その旨を表示します。',
  salary: '選んだ給与単位で、確認できた下限額の高い順。下限の記載がない求人は末尾です。',
};

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];
