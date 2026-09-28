import { describe, expect, it } from 'vitest';
import { deriveFacets, facetsForOccupation, FACET_OWNER } from './facets';

describe('職種専用条件の正規化（不明は null、推測しない）', () => {
  it('ドライバー：免許・配送範囲・手積み・帰宅頻度', () => {
    const facets = deriveFacets('driver', {
      facts: { 必要免許: '中型免許', 配送範囲: '地場', 手積み: 'なし', 帰宅頻度: '毎日' },
      employmentTypes: ['fulltime'],
    });
    expect(facets).toMatchObject({ license: ['medium'], range: ['local'], manualLoading: ['no'], home: ['daily'], vehicle: null });
  });

  it('準中型は中型と区別する', () => {
    expect(deriveFacets('driver', { facts: { 必要免許: '準中型免許以上' }, employmentTypes: [] }).license).toEqual(['semi_medium']);
    expect(deriveFacets('driver', { facts: { 必要免許: '普通免許（AT限定可）' }, employmentTypes: [] }).license).toEqual(['ordinary']);
  });

  it('手積みの記載なし（null）は no にしない', () => {
    expect(deriveFacets('driver', { facts: { 手積み: null }, employmentTypes: [] }).manualLoading).toBeNull();
  });

  it('「なし」と「あり」を両方含む条件付きの記載は不明にする', () => {
    expect(deriveFacets('driver', { facts: { 手積み: 'なし（繁忙期は一部あり）' }, employmentTypes: [] }).manualLoading).toBeNull();
  });

  it('看護師：日勤のみでオンコールの記載なし → 夜勤=no, オンコール=不明（extraction_cases: unknown-oncall）', () => {
    const facets = deriveFacets('nurse', { facts: { 夜勤: 'なし', オンコール: null }, employmentTypes: ['fulltime'] });
    expect(facets.night).toEqual(['no']);
    expect(facets.onCall).toBeNull();
  });

  it('看護師：オンコール「月5回」は yes、「なし」は no', () => {
    expect(deriveFacets('nurse', { facts: { オンコール: '月5回' }, employmentTypes: [] }).onCall).toEqual(['yes']);
    expect(deriveFacets('nurse', { facts: { オンコール: 'なし' }, employmentTypes: [] }).onCall).toEqual(['no']);
  });

  it('准看護師は明記がある場合だけ応募可にする（OR/ANDを推測しない）', () => {
    expect(deriveFacets('nurse', { facts: { 必要資格: '看護師または准看護師' }, employmentTypes: [] }).lpn).toEqual(['ok']);
    expect(deriveFacets('nurse', { facts: { 必要資格: '看護師・普通免許' }, employmentTypes: [] }).lpn).toBeNull();
    expect(deriveFacets('nurse', { facts: { 必要資格: '正看護師' }, employmentTypes: [] }).lpn).toEqual(['no']);
  });

  it('診療科：整形外科を外科と混同しない', () => {
    expect(deriveFacets('nurse', { facts: { 診療科: '内科・整形外科' }, employmentTypes: [] }).dept).toEqual(['internal', 'orthopedics']);
  });

  it('エンジニア：技術・出社頻度（完全在宅と一部在宅を区別）・業務形態・工程・契約', () => {
    const facets = deriveFacets('engineer', {
      facts: { 技術: 'ＡＷＳ / Kubernetes / Terraform / Go', 出社頻度: 'フルリモート・国内', 業務形態: '受託開発', 担当工程: '設計・実装' },
      employmentTypes: ['freelance'],
    });
    expect(facets.tech).toEqual(['go', 'aws', 'kubernetes', 'terraform']);
    expect(facets.office).toEqual(['remote']);
    expect(facets.workStyle).toEqual(['contract_dev']);
    expect(facets.phase).toEqual(['design', 'implementation']);
    expect(facets.contract).toEqual(['freelance']);
    expect(deriveFacets('engineer', { facts: { 出社頻度: '週2日' }, employmentTypes: [] }).office).toEqual(['hybrid']);
    expect(deriveFacets('engineer', { facts: { 技術: 'JavaScript' }, employmentTypes: [] }).tech).toEqual(['javascript']);
  });

  it('製造：交替制・寮・作業内容・直接雇用/派遣', () => {
    const facets = deriveFacets('manufacturing', {
      facts: { シフト: '2交替', 寮: 'あり・月2万円', 作業内容: '検品・梱包', 重量物: null },
      employmentTypes: ['dispatch'],
    });
    expect(facets).toMatchObject({ shift: ['rotating'], dorm: ['yes'], task: ['inspection', 'packing'], heavy: null, hire: ['dispatch'] });
  });

  it('共通条件のみの職種には専用条件がない', () => {
    expect(facetsForOccupation('care')).toHaveLength(0);
    expect(deriveFacets('office', { facts: { 業務: '受発注' }, employmentTypes: [] })).toEqual({});
  });

  it('専用条件のURLキーは職種間で重複しない', () => {
    const keys = [...FACET_OWNER.keys()];
    expect(new Set(keys).size).toBe(keys.length);
    expect(FACET_OWNER.get('manualLoading')).toBe('driver');
    expect(FACET_OWNER.get('onCall')).toBe('nurse');
  });
});
