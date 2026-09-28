import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, parseSearchQuery, type SearchQuery } from './query';
import { searchJobs } from './search';
import { makeJob, TEST_NOW } from './test-helpers';

const q = (qs: string): SearchQuery => parseSearchQuery(new URLSearchParams(qs)).query;

const jobs = [
  makeJob({ id: 'd1', title: '地場配送ドライバー', facts: { 必要免許: '中型免許', 配送範囲: '地場', 手積み: 'なし', 帰宅頻度: '毎日' } }),
  makeJob({
    id: 'd2',
    title: 'ルート配送スタッフ',
    facts: { 必要免許: '普通免許', 配送範囲: '近距離', 手積み: null, 帰宅頻度: '毎日' },
    locations: [{ country: 'JP', prefectureCode: '14', city: '横浜市', displayAddress: '神奈川県横浜市', remoteMode: 'unknown' }],
    salary: { currency: 'JPY', min: 280000, max: 340000, unit: 'MONTH', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
    sourcePostedAt: '2026-09-25',
  }),
  makeJob({
    id: 'm1',
    occupation: 'manufacturing',
    title: '倉庫でのピッキング',
    facts: { シフト: '日勤' },
    salary: { currency: 'JPY', min: 1400, max: 1700, unit: 'HOUR', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
    lastFetchedAt: '2026-09-27T00:00:00Z',
  }),
  makeJob({
    id: 'e1',
    occupation: 'engineer',
    title: 'バックエンドエンジニア',
    salary: { currency: 'JPY', min: 6000000, max: 8500000, unit: 'YEAR', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
  }),
  makeJob({
    id: 's1',
    occupation: 'service',
    title: '販売スタッフ',
    salary: { currency: 'JPY', min: null, max: null, unit: 'MONTH', basis: 'unknown', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
  }),
  makeJob({ id: 'n1', occupation: 'nurse', title: '外来看護師', facts: { 施設形態: 'クリニック', 夜勤: 'なし', オンコール: 'なし' } }),
  makeJob({ id: 'n2', occupation: 'nurse', title: '訪問看護師', facts: { 施設形態: '訪問看護', 夜勤: 'なし', オンコール: '月5回' } }),
  makeJob({ id: 'n3', occupation: 'nurse', title: '病棟看護師', facts: { 施設形態: '病院', 夜勤: '月4回', オンコール: null } }),
];

const ctx = { now: TEST_NOW };

describe('検索（UI01〜UI06）', () => {
  it('キーワードと勤務地はAND条件（UI01）', () => {
    expect(searchJobs(jobs, q('q=配送'), ctx).items.map((j) => j.id).sort()).toEqual(['d1', 'd2']);
    expect(searchJobs(jobs, q('q=配送&loc=横浜'), ctx).items.map((j) => j.id)).toEqual(['d2']);
    expect(searchJobs(jobs, q('q=配送 地場'), ctx).items.map((j) => j.id)).toEqual(['d1']);
  });

  it('月給30万円以上：時給・年収・下限不明を混ぜない（UI03）', () => {
    const result = searchJobs(jobs, q('salaryUnit=MONTH&salaryMin=300000'), ctx);
    expect(result.items.every((j) => j.salary.unit === 'MONTH' && (j.salary.min ?? 0) >= 300000)).toBe(true);
    expect(result.items.map((j) => j.id)).not.toContain('d2');
    expect(result.items.map((j) => j.id)).not.toContain('s1');
    expect(result.unknownNotes).toEqual([{ group: 'salary', label: '給与の下限', count: 1 }]);
  });

  it('「下限の記載なしも含める」を選ぶと未記載を含め、確認済みより後ろに並べる', () => {
    const result = searchJobs(jobs, q('salaryUnit=MONTH&salaryMin=300000&salaryUnknown=include'), ctx);
    const ids = result.items.map((j) => j.id);
    expect(ids).toContain('s1');
    expect(ids.indexOf('s1')).toBe(ids.length - 1);
  });

  it('オンコールなし：明記がある求人だけ。不明は適合させず件数を通知（UI04）', () => {
    const result = searchJobs(jobs, q('occupation=nurse&onCall=no'), ctx);
    expect(result.items.map((j) => j.id)).toEqual(['n1']);
    expect(result.unknownNotes).toEqual([{ group: 'facet:onCall', label: 'オンコール', count: 1 }]);
  });

  it('0件のときは条件を自動で外さず、個別に緩める提案を返す（UI06）', () => {
    const query = q('occupation=nurse&onCall=no&loc=横浜');
    const result = searchJobs(jobs, query, ctx);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    const locRelax = result.relaxations.find((r) => r.group === 'loc');
    expect(locRelax).toMatchObject({ count: 1, label: '勤務地「横浜」を外す' });
    expect(locRelax?.query.loc).toBeNull();
    expect(locRelax?.query.facets).toEqual({ onCall: ['no'] });
  });

  it('給与順は同一単位の確認できた下限額を使い、未記載は末尾', () => {
    const result = searchJobs(jobs, q('salaryUnit=MONTH&salaryUnknown=include&sort=salary'), ctx);
    const ids = result.items.map((j) => j.id);
    expect(ids[ids.length - 1]).toBe('s1');
    expect(result.items[0]?.salary.min).toBeGreaterThanOrEqual(result.items[1]?.salary.min ?? 0);
  });

  it('新着順は元の公開日、なければ初回検出日を使う', () => {
    const result = searchJobs(jobs, q('occupation=driver&sort=newest'), ctx);
    expect(result.items.map((j) => j.id)).toEqual(['d1', 'd2']);
  });

  it('最終情報確認の期間は境界を含む', () => {
    const result = searchJobs(jobs, q('fresh=24h'), ctx);
    expect(result.items.map((j) => j.id)).not.toContain('m1');
    expect(searchJobs(jobs, q('fresh=72h'), ctx).items.map((j) => j.id)).toContain('m1');
  });

  it('絞り込み件数は同じグループ内を「いずれか」として数える', () => {
    const result = searchJobs(jobs, q('occupation=nurse&facility=clinic'), ctx);
    expect(result.facetCounts['facet:facility']).toEqual({ clinic: 1, visiting: 1, hospital: 1 });
    expect(result.facetCounts.occupation?.driver).toBe(2);
  });

  it('範囲外のページは最後のページに寄せて通知する', () => {
    const result = searchJobs(jobs, { ...DEFAULT_QUERY, page: 9 }, { ...ctx, pageSize: 5 });
    expect(result.page).toBe(2);
    expect(result.issues[0]?.param).toBe('page');
    expect(result.items).toHaveLength(3);
  });
});
