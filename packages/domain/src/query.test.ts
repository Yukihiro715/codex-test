import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  activeConditions,
  parseSearchQuery,
  removeGroup,
  serializeQuery,
  toggleFacetValue,
  withOccupation,
  withPatch,
} from './query';

describe('URLクエリの型検証（UI05の前提）', () => {
  it('仕様の例URLを読み取り、正規形で書き戻せる', () => {
    const { query, issues } = parseSearchQuery(
      new URLSearchParams('occupation=driver&pref=13&salaryUnit=MONTH&salaryMin=300000&manualLoading=no&sort=relevance&page=1'),
    );
    expect(issues).toEqual([]);
    expect(query).toMatchObject({ occupation: 'driver', pref: '13', salaryUnit: 'MONTH', salaryMin: 300000, facets: { manualLoading: ['no'] }, sort: 'relevance', page: 1 });
    expect(serializeQuery(query)).toBe('pref=13&occupation=driver&manualLoading=no&salaryUnit=MONTH&salaryMin=300000');
  });

  it('シリアライズ → パースで同じ条件に戻る（往復）', () => {
    const original = parseSearchQuery(
      new URLSearchParams('q=配送 ドライバー&loc=横浜&occupation=driver&license=medium,large&emp=fulltime&route=employer,agency&fresh=72h&sort=newest&page=2'),
    ).query;
    const again = parseSearchQuery(new URLSearchParams(serializeQuery(original))).query;
    expect(again).toEqual(original);
  });

  it('存在しない値は無視して通知する（黙って条件を変えない）', () => {
    const { query, issues } = parseSearchQuery(new URLSearchParams('occupation=pilot&salaryUnit=WEEK&pref=99&emp=boss&page=-1&fresh=1y'));
    expect(query).toEqual({ ...DEFAULT_QUERY });
    expect(issues.map((i) => i.param).sort()).toEqual(['emp', 'fresh', 'occupation', 'page', 'pref', 'salaryUnit']);
  });

  it('給与の下限は単位の指定が必要', () => {
    const { query, issues } = parseSearchQuery(new URLSearchParams('salaryMin=300000'));
    expect(query.salaryMin).toBeNull();
    expect(issues[0]?.param).toBe('salaryMin');
  });

  it('給与順は単位の指定が必要（ない場合はおすすめ順）', () => {
    const { query, issues } = parseSearchQuery(new URLSearchParams('sort=salary'));
    expect(query.sort).toBe('relevance');
    expect(issues[0]?.message).toContain('給与順');
  });

  it('他の職種の専用条件は無視して通知する', () => {
    const { query, issues } = parseSearchQuery(new URLSearchParams('occupation=nurse&manualLoading=no'));
    expect(query.facets).toEqual({});
    expect(issues[0]?.message).toContain('ドライバー');
  });

  it('勤務地の入力が都道府県名なら都道府県コードに正規化する', () => {
    expect(parseSearchQuery(new URLSearchParams('loc=東京')).query).toMatchObject({ pref: '13', loc: null });
    expect(parseSearchQuery(new URLSearchParams('loc=大阪府')).query).toMatchObject({ pref: '27', loc: null });
    expect(parseSearchQuery(new URLSearchParams('loc=横浜')).query).toMatchObject({ pref: null, loc: '横浜' });
  });

  it('既知のソースIDだけを受け付ける', () => {
    const { query, issues } = parseSearchQuery(new URLSearchParams('source=demo_agency,unknown_src'), { sourceIds: new Set(['demo_agency']) });
    expect(query.source).toEqual(['demo_agency']);
    expect(issues).toHaveLength(1);
  });

  it('キーワードの制御文字を除去し長さを制限する', () => {
    const { query } = parseSearchQuery({ q: `ab\u0000c${'x'.repeat(200)}` });
    expect(query.q?.startsWith('abc')).toBe(true);
    expect(query.q?.length).toBe(100);
  });
});

describe('条件の変更', () => {
  it('職種を変えると専用条件だけ解除し、共通条件は保持する（UI02）', () => {
    const base = parseSearchQuery(new URLSearchParams('occupation=driver&manualLoading=no&home=daily&pref=13&emp=fulltime&salaryUnit=MONTH&salaryMin=300000&page=3')).query;
    const { query, cleared } = withOccupation(base, 'nurse');
    expect(query.occupation).toBe('nurse');
    expect(query.facets).toEqual({});
    expect(query).toMatchObject({ pref: '13', emp: ['fulltime'], salaryUnit: 'MONTH', salaryMin: 300000, page: 1 });
    expect(cleared).toEqual(['手積み：手積みなし（明記あり）', '帰宅頻度：毎日帰宅（明記あり）']);
  });

  it('条件を変えると1ページ目に戻る', () => {
    const base = { ...DEFAULT_QUERY, page: 4 };
    expect(withPatch(base, { fresh: '24h' }).page).toBe(1);
    expect(withPatch(base, { page: 2 }).page).toBe(2);
  });

  it('給与の単位を外すと下限・未記載の扱い・給与順も外れる', () => {
    const base = { ...DEFAULT_QUERY, salaryUnit: 'MONTH' as const, salaryMin: 300000, salaryUnknown: true, sort: 'salary' as const };
    expect(withPatch(base, { salaryUnit: null })).toMatchObject({ salaryMin: null, salaryUnknown: false, sort: 'relevance' });
  });

  it('条件chipsを1つずつ外せる', () => {
    const base = toggleFacetValue({ ...DEFAULT_QUERY, occupation: 'nurse' }, 'onCall', 'no');
    const chips = activeConditions(base);
    expect(chips.map((c) => c.label)).toEqual(['職種：看護師', 'オンコール：オンコールなし（明記あり）']);
    expect(chips[1]?.without.facets).toEqual({});
    expect(removeGroup(base, 'occupation').facets).toEqual({});
  });
});
