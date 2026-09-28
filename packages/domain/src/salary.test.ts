import { describe, expect, it } from 'vitest';
import type { Salary } from './types';
import { describeFixedOvertime, describeSalary, formatSalary, isSalaryFilterable, matchesSalaryCondition, salaryIssues } from './salary';

const salary = (overrides: Partial<Salary>): Salary => ({
  currency: 'JPY',
  min: 300000,
  max: 380000,
  unit: 'MONTH',
  basis: 'gross',
  fixedOvertimeIncluded: 'unknown',
  fixedOvertimeHours: null,
  fixedOvertimeAmount: null,
  evidenceIds: [],
  ...overrides,
});

describe('給与の条件判定（UI03）', () => {
  it('月給30万円以上：単位が同じで下限が確認できる求人だけ', () => {
    expect(matchesSalaryCondition(salary({ min: 310000 }), 'MONTH', 300000)).toBe(true);
    expect(matchesSalaryCondition(salary({ min: 300000 }), 'MONTH', 300000)).toBe(true);
    expect(matchesSalaryCondition(salary({ min: 280000, max: 340000 }), 'MONTH', 300000)).toBe(false);
  });

  it('時給・年収の求人を月給条件に混ぜない', () => {
    expect(matchesSalaryCondition(salary({ unit: 'HOUR', min: 1400, max: 1700 }), 'MONTH', 1000)).toBe(false);
    expect(matchesSalaryCondition(salary({ unit: 'YEAR', min: 5500000, max: 7500000 }), 'MONTH', 300000)).toBe(false);
  });

  it('下限の記載がない求人は適合にしない（上限だけの記載を含む）', () => {
    expect(matchesSalaryCondition(salary({ min: null, max: 350000 }), 'MONTH', 300000)).toBe(false);
    expect(matchesSalaryCondition(salary({ min: null, max: null }), 'MONTH', null)).toBe(false);
  });
});

describe('給与データの検査（DATA02）', () => {
  it('単位なし・値の逆転は公開の給与フィルターに入れない', () => {
    const noUnit = salary({ unit: 'UNKNOWN' });
    const reversed = salary({ min: 400000, max: 300000 });
    expect(isSalaryFilterable(noUnit)).toBe(false);
    expect(isSalaryFilterable(reversed)).toBe(false);
    expect(salaryIssues(noUnit)).toContain('給与の単位が記載されていません');
    expect(salaryIssues(reversed)).toContain('給与の下限と上限が逆転しています');
  });

  it('非整数・0以下は不正', () => {
    expect(salaryIssues(salary({ min: 0 }))).toContain('給与の下限が正の整数ではありません');
    expect(salaryIssues(salary({ max: 1234.5 }))).toContain('給与の上限が正の整数ではありません');
  });

  it('正しい給与は問題なし', () => {
    expect(salaryIssues(salary({}))).toEqual([]);
  });
});

describe('給与の表示（原文にない金額を作らない）', () => {
  it('月給・年収は万円、時給・日給は円で表示', () => {
    expect(formatSalary(salary({ min: 310000, max: 380000 }))).toBe('月給 31万〜38万円');
    expect(formatSalary(salary({ unit: 'YEAR', min: 5500000, max: 7500000 }))).toBe('年収 550万〜750万円');
    expect(formatSalary(salary({ unit: 'HOUR', min: 1400, max: 1700 }))).toBe('時給 1,400〜1,700円');
    expect(formatSalary(salary({ min: 285000, max: null }))).toBe('月給 28.5万円〜');
  });

  it('記載なし・下限なしを明示する', () => {
    expect(describeSalary(salary({ unit: 'UNKNOWN', min: null, max: null }))).toMatchObject({ amountText: '原文に記載なし', unknown: true });
    expect(formatSalary(salary({ min: null, max: null }))).toBe('月給 金額の記載なし');
    expect(formatSalary(salary({ min: null, max: 350000 }))).toBe('月給 〜35万円（下限の記載なし）');
  });

  it('固定残業代は有無・時間・金額を分けて表示し、不明は記載なし', () => {
    expect(describeFixedOvertime(salary({ fixedOvertimeIncluded: 'yes', fixedOvertimeHours: 30, fixedOvertimeAmount: 65000 }))).toBe('含む（30時間分・65,000円）');
    expect(describeFixedOvertime(salary({ fixedOvertimeIncluded: 'no' }))).toBe('含まない（明記あり）');
    expect(describeFixedOvertime(salary({}))).toBe('記載なし');
  });
});
