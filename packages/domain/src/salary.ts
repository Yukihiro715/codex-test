import type { KnownSalaryUnit, Salary } from './types';
import { salaryUnitLabel } from './labels';

/** 給与が公開の給与フィルター・給与順に使えるか（単位が明記され、下限が確認でき、値が逆転していない） */
export function isSalaryFilterable(salary: Salary): boolean {
  if (salary.unit === 'UNKNOWN') return false;
  if (salary.min === null) return false;
  if (!Number.isInteger(salary.min) || salary.min <= 0) return false;
  if (salary.max !== null && (!Number.isInteger(salary.max) || salary.max < salary.min)) return false;
  return true;
}

/**
 * 給与データの検査。抽出（M1）で review_required に回す条件と同じ判定を使う。
 * - 単位なしで金額がある / 下限>上限 / 非整数・0以下 / 固定残業代の矛盾
 */
export function salaryIssues(salary: Salary): string[] {
  const issues: string[] = [];
  const hasAmount = salary.min !== null || salary.max !== null;
  if (salary.unit === 'UNKNOWN' && hasAmount) issues.push('給与の単位が記載されていません');
  for (const [name, value] of [
    ['下限', salary.min],
    ['上限', salary.max],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) issues.push(`給与の${name}が正の整数ではありません`);
  }
  if (salary.min !== null && salary.max !== null && salary.min > salary.max) {
    issues.push('給与の下限と上限が逆転しています');
  }
  if (salary.fixedOvertimeIncluded !== 'yes' && (salary.fixedOvertimeHours !== null || salary.fixedOvertimeAmount !== null)) {
    issues.push('固定残業代の有無と内訳が一致しません');
  }
  return issues;
}

/**
 * 月給30万円以上などの条件に合うか。
 * 単位が一致し、確認できた下限額が条件以上の求人だけを適合とする（上限だけの記載や単位違いは含めない）。
 */
export function matchesSalaryCondition(salary: Salary, unit: KnownSalaryUnit, minAmount: number | null): boolean {
  if (salary.unit !== unit) return false;
  if (!isSalaryFilterable(salary)) return false;
  if (minAmount === null) return true;
  return (salary.min ?? 0) >= minAmount;
}

/** 給与条件の指定時に「下限の記載なし」として扱う求人（単位不明、または同じ単位で下限なし） */
export function isSalaryLowerBoundUnknown(salary: Salary, unit: KnownSalaryUnit): boolean {
  if (salary.unit === 'UNKNOWN') return salary.min === null;
  return salary.unit === unit && salary.min === null;
}

function formatAmount(amount: number, unit: KnownSalaryUnit): string {
  if ((unit === 'MONTH' || unit === 'YEAR') && amount >= 10000 && amount % 1000 === 0) {
    const man = amount / 10000;
    return `${man.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万`;
  }
  return amount.toLocaleString('ja-JP');
}

export interface SalaryDisplay {
  /** 例：月給 */
  unitLabel: string;
  /** 例：31万〜38万円 */
  amountText: string;
  /** 記載なし等で金額を示せない場合 true */
  unknown: boolean;
  /** 補足（例：下限の記載なし） */
  note: string | null;
}

/** 給与の表示。原文にない金額を作らず、記載がないものは「記載なし」と表示する。 */
export function describeSalary(salary: Salary): SalaryDisplay {
  if (salary.unit === 'UNKNOWN') {
    if (salary.min === null && salary.max === null) {
      return { unitLabel: '給与', amountText: '原文に記載なし', unknown: true, note: null };
    }
    const parts = [salary.min, salary.max].map((v) => (v === null ? '' : `${v.toLocaleString('ja-JP')}円`));
    return {
      unitLabel: '給与',
      amountText: `${parts[0]}〜${parts[1]}`,
      unknown: true,
      note: '単位の記載がないため、給与条件の絞り込みには使いません',
    };
  }
  const unitLabel = salaryUnitLabel(salary.unit);
  const { min, max } = salary;
  if (min === null && max === null) {
    return { unitLabel, amountText: '金額の記載なし', unknown: true, note: null };
  }
  if (min !== null && max !== null) {
    return { unitLabel, amountText: `${formatAmount(min, salary.unit)}〜${formatAmount(max, salary.unit)}円`, unknown: false, note: null };
  }
  if (min !== null) {
    return { unitLabel, amountText: `${formatAmount(min, salary.unit)}円〜`, unknown: false, note: null };
  }
  return {
    unitLabel,
    amountText: `〜${formatAmount(max as number, salary.unit)}円`,
    unknown: false,
    note: '下限の記載なし',
  };
}

export function formatSalary(salary: Salary): string {
  const d = describeSalary(salary);
  return `${d.unitLabel} ${d.amountText}${d.note ? `（${d.note}）` : ''}`;
}

/** 固定残業代の表示（有無・時間・金額を分けて示し、不明は不明と書く） */
export function describeFixedOvertime(salary: Salary): string {
  switch (salary.fixedOvertimeIncluded) {
    case 'yes': {
      const details = [
        salary.fixedOvertimeHours !== null ? `${salary.fixedOvertimeHours}時間分` : '時間の記載なし',
        salary.fixedOvertimeAmount !== null ? `${salary.fixedOvertimeAmount.toLocaleString('ja-JP')}円` : '金額の記載なし',
      ];
      return `含む（${details.join('・')}）`;
    }
    case 'no':
      return '含まない（明記あり）';
    default:
      return '記載なし';
  }
}

/** 給与の下限額を指定単位の入力値として検証する（JPY整数、単位ごとの上限あり） */
export const SALARY_INPUT_LIMITS: Record<KnownSalaryUnit, { min: number; max: number }> = {
  HOUR: { min: 1, max: 100_000 },
  DAY: { min: 1, max: 1_000_000 },
  MONTH: { min: 1, max: 10_000_000 },
  YEAR: { min: 1, max: 100_000_000 },
};
