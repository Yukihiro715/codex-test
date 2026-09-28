import type { PublicJobSummary } from './types';
import { applicationRouteLabel, employmentTypeLabel } from './labels';
import { getOccupation, occupationLabel } from './occupations';
import { describeFixedOvertime, formatSalary } from './salary';
import { formatDateTimeJst } from './time';
import { getPrefectureByCode } from './prefectures';

export const COMPARE_LIMIT = 3;

export type CompareCellKind = 'value' | 'unknown' | 'na';

export interface CompareCell {
  text: string;
  kind: CompareCellKind;
}

export interface CompareRow {
  key: string;
  label: string;
  cells: CompareCell[];
  /** 列の間で表示が異なる（有利・不利の判定はしない） */
  differs: boolean;
  group: 'common' | 'occupation' | 'source';
}

const UNKNOWN_TEXT = '原文に記載なし';
const NA_TEXT = '対象外';

/** 共通行と重複する職種固有項目（共通行で表示する） */
const COMMON_FACT_LABELS = new Set(['勤務時間', '必要資格', '必要免許', '雇用形態']);

function value(text: string | null | undefined): CompareCell {
  if (text === null || text === undefined || text.trim() === '') return { text: UNKNOWN_TEXT, kind: 'unknown' };
  return { text, kind: 'value' };
}

function factToText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.join(' / ');
  return String(v);
}

export function locationText(job: Pick<PublicJobSummary, 'locations'>): string | null {
  if (job.locations.length === 0) return null;
  return job.locations
    .map((l) => {
      const pref = getPrefectureByCode(l.prefectureCode ?? '')?.name ?? '';
      const address = l.displayAddress || `${pref}${l.city ?? ''}`;
      const remote = l.remoteMode === 'remote' ? '（フルリモート）' : l.remoteMode === 'hybrid' ? '（一部在宅）' : '';
      return `${address}${remote}`;
    })
    .join(' / ');
}

function row(key: string, label: string, cells: CompareCell[], group: CompareRow['group']): CompareRow {
  const texts = new Set(cells.map((c) => c.text));
  return { key, label, cells, differs: cells.length > 1 && texts.size > 1, group };
}

/**
 * 比較表の行。同じ順序で項目を並べ、不明同士を有利/不利に判定しない。
 * 異職種の比較では共通項目を中心にし、その職種に存在しない項目は「対象外」。
 */
export function buildComparisonRows(jobs: readonly PublicJobSummary[]): CompareRow[] {
  const rows: CompareRow[] = [
    row('occupation', '職種', jobs.map((j) => value(occupationLabel(j.occupation))), 'common'),
    row('employer', '会社', jobs.map((j) => value(j.employerName)), 'common'),
    row('location', '勤務地', jobs.map((j) => value(locationText(j))), 'common'),
    row(
      'salary',
      '給与と単位',
      jobs.map((j) => {
        const text = formatSalary(j.salary);
        return { text, kind: j.salary.unit === 'UNKNOWN' || (j.salary.min === null && j.salary.max === null) ? 'unknown' : 'value' };
      }),
      'common',
    ),
    row(
      'overtime',
      '固定残業代',
      jobs.map((j) => {
        const text = describeFixedOvertime(j.salary);
        return { text, kind: j.salary.fixedOvertimeIncluded === 'unknown' ? 'unknown' : 'value' };
      }),
      'common',
    ),
    row('employment', '雇用形態', jobs.map((j) => value(j.employmentTypes.map(employmentTypeLabel).join('・') || null)), 'common'),
    row('hours', '勤務時間', jobs.map((j) => value(j.workingHours)), 'common'),
    row('qualification', '必要資格・免許', jobs.map((j) => value(j.requiredQualification)), 'common'),
  ];

  const occupations = [...new Set(jobs.map((j) => j.occupation))];
  for (const slug of occupations) {
    const occupation = getOccupation(slug);
    const labels = [...(occupation?.compareFields ?? [])];
    // 設定の比較項目以外に、求人に記載のある事実条件（例：車両・診療科）も加える
    for (const job of jobs) {
      if (job.occupation !== slug) continue;
      for (const label of Object.keys(job.facts)) if (!labels.includes(label)) labels.push(label);
    }
    for (const label of labels) {
      if (COMMON_FACT_LABELS.has(label)) continue;
      const prefix = occupations.length > 1 ? `${occupation?.label ?? slug}：` : '';
      rows.push(
        row(
          `fact:${slug}:${label}`,
          `${prefix}${label}`,
          jobs.map((j) => (j.occupation !== slug ? { text: NA_TEXT, kind: 'na' as const } : value(factToText(j.facts[label])))),
          'occupation',
        ),
      );
    }
  }

  rows.push(
    row('route', '応募経路', jobs.map((j) => value(applicationRouteLabel(j.applicationRoute))), 'source'),
    row('source', '掲載元', jobs.map((j) => value(j.sourceName)), 'source'),
    row('checked', '情報確認日時', jobs.map((j) => value(`${formatDateTimeJst(j.lastFetchedAt)}（日本時間）`)), 'source'),
  );
  return rows;
}

export function differingRows(rows: readonly CompareRow[]): CompareRow[] {
  return rows.filter((r) => r.differs);
}

/** 比較IDの正規化（重複除去・上限） */
export function normalizeCompareIds(ids: readonly string[]): { ids: string[]; truncated: boolean } {
  const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => /^[a-z0-9-]{1,80}$/.test(id)))];
  return { ids: unique.slice(0, COMPARE_LIMIT), truncated: unique.length > COMPARE_LIMIT };
}
