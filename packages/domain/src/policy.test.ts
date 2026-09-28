import { describe, expect, it } from 'vitest';
import type { JobCluster, SourceListing } from './types';
import { deriveFacets } from './facets';
import { effectiveSource, isSafeExternalUrl, listingVisibility, publicActivationBlockers, toPublicJob } from './policy';
import { makeSource, TEST_NOW } from './test-helpers';

function listing(overrides: Partial<SourceListing> = {}): SourceListing {
  const facts = { 必要免許: '中型免許', 配送範囲: '地場', 手積み: 'なし', 帰宅頻度: '毎日' };
  return {
    id: 'demo-driver-1',
    sourceId: 'demo_employer_facts',
    sourceScopeId: 'demo_employer_facts:employer-driver-1.example',
    sourceJobId: 'demo-driver-1',
    canonicalUrl: 'https://employer-driver-1.example/jobs/1',
    employerId: 'employer-a',
    employerName: 'サンプル物流A株式会社（架空）',
    title: '地場配送ドライバー',
    occupation: 'driver',
    locations: [{ country: 'JP', prefectureCode: '13', city: '江東区', displayAddress: '東京都江東区', remoteMode: 'unknown' }],
    employmentTypes: ['fulltime'],
    salary: { currency: 'JPY', min: 310000, max: 380000, unit: 'MONTH', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
    facts,
    facets: deriveFacets('driver', { facts, employmentTypes: ['fulltime'] }),
    workingHours: null,
    requiredQualification: '中型免許',
    evidenceIds: [],
    state: 'published',
    sourcePostedAt: null,
    firstSeenAt: '2026-09-29T00:00:00Z',
    lastFetchedAt: '2026-09-29T00:00:00Z',
    lastChangedAt: '2026-09-29T00:00:00Z',
    validThrough: null,
    contentHash: 'hash',
    applicationRoute: 'employer',
    displayGrant: 'full_authorized',
    authorizedDescription: 'これは架空の求人説明です。',
    clusterId: 'demo-driver-1',
    demo: true,
    ...overrides,
  };
}

const cluster: JobCluster = { id: 'demo-driver-1', primaryListingId: 'demo-driver-1', listingIds: ['demo-driver-1'] };
const env = { now: TEST_NOW, liveCrawlEnabled: false };

describe('ソースの有効化判定（REL02）', () => {
  it('審査・robots・規約の記録がない実ソース候補は公開を有効化できない', () => {
    const candidate = makeSource({ id: 'engage_review', kind: 'candidate', lane: 'DISPUTED_SCOPE', reviewStatus: 'unreviewed', reviewId: null, robotsStatus: 'unverified', publicEnabled: false, displayMode: 'none' });
    expect(publicActivationBlockers(candidate, env).length).toBeGreaterThanOrEqual(3);
    expect(effectiveSource(candidate, { publicEnabled: true, fetchEnabled: true }, env)).toMatchObject({ publicEnabled: false, fetchEnabled: false });
  });

  it('停止は常に反映し、ポリシーのversionを上げる', () => {
    const source = makeSource();
    const paused = effectiveSource(source, { publicEnabled: false }, env);
    expect(paused.publicEnabled).toBe(false);
    expect(paused.version).toBe(source.version + 1);
  });

  it('表示方式は審査済みの上限より広げない', () => {
    const source = makeSource({ displayMode: 'facts_link' });
    expect(effectiveSource(source, { displayMode: 'full_authorized' }, env).displayMode).toBe('facts_link');
    expect(effectiveSource(makeSource({ displayMode: 'full_authorized' }), { displayMode: 'facts_link' }, env).displayMode).toBe('facts_link');
  });
});

describe('求人の公開判定', () => {
  it('公開中の求人', () => {
    expect(listingVisibility(listing(), makeSource(), TEST_NOW)).toEqual({ kind: 'public', state: 'published', displayMode: 'facts_link', staleWarning: false });
  });

  it('削除依頼・ソース停止は内容を出さない', () => {
    expect(listingVisibility(listing({ state: 'suppressed' }), makeSource(), TEST_NOW)).toEqual({ kind: 'hidden', reason: 'suppressed' });
    expect(listingVisibility(listing(), makeSource({ publicEnabled: false }), TEST_NOW)).toEqual({ kind: 'hidden', reason: 'source_disabled' });
  });

  it('掲載終了・期限切れは expired', () => {
    expect(listingVisibility(listing({ state: 'expired' }), makeSource(), TEST_NOW).kind).toBe('expired');
    expect(listingVisibility(listing({ validThrough: '2026-09-28T23:59:59+09:00' }), makeSource(), TEST_NOW).kind).toBe('expired');
  });

  it('確認できない期間が上限を超えたら検索から外す（DATA08）。72時間超は注意表示', () => {
    expect(listingVisibility(listing({ state: 'stale', lastFetchedAt: '2026-09-20T00:00:00Z' }), makeSource(), TEST_NOW)).toEqual({ kind: 'hidden', reason: 'stale_expired' });
    const aging = listingVisibility(listing({ lastFetchedAt: '2026-09-25T00:00:00Z' }), makeSource(), TEST_NOW);
    expect(aging).toMatchObject({ kind: 'public', staleWarning: true });
  });

  it('危険なURLの求人は公開しない（SEC02）', () => {
    expect(listingVisibility(listing({ canonicalUrl: 'javascript:alert(1)' }), makeSource(), TEST_NOW)).toEqual({ kind: 'hidden', reason: 'invalid' });
    expect(isSafeExternalUrl('https://user:pass@example.com/')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeExternalUrl('https://employer-a.example/jobs/1')).toBe(true);
  });
});

describe('公開projection（DATA09）', () => {
  it('facts_link では本文を含めない', () => {
    const source = makeSource({ displayMode: 'facts_link' });
    const visibility = listingVisibility(listing(), source, TEST_NOW);
    if (visibility.kind !== 'public') throw new Error('expected public');
    const job = toPublicJob(cluster, listing(), source, visibility, 0);
    expect(job.authorizedDescription).toBeNull();
    expect(Object.keys(job)).not.toContain('contentHash');
    expect(Object.keys(job)).not.toContain('evidenceIds');
  });

  it('full_authorized では許諾された本文を含める', () => {
    const source = makeSource({ displayMode: 'full_authorized', lane: 'OPEN_REUSE' });
    const visibility = listingVisibility(listing(), source, TEST_NOW);
    if (visibility.kind !== 'public') throw new Error('expected public');
    expect(toPublicJob(cluster, listing(), source, visibility, 0).authorizedDescription).toBe('これは架空の求人説明です。');
  });

  it('公開を許可されていないフィールドは出さない', () => {
    const source = makeSource({ publicFields: ['title', 'employerName', 'sourceName', 'sourceUrl', 'lastFetchedAt'] });
    const visibility = listingVisibility(listing(), source, TEST_NOW);
    if (visibility.kind !== 'public') throw new Error('expected public');
    const job = toPublicJob(cluster, listing(), source, visibility, 0);
    expect(job.salary.min).toBeNull();
    expect(job.facts).toEqual({});
    expect(job.facets.manualLoading).toBeNull();
  });
});
