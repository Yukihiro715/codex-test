import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, parseSearchQuery } from '@worklens/domain';
import { FixtureJobRepository } from './fixture-repository';
import { loadFixtureData, toSourceListing, FixtureError, type DemoJobFixture } from './fixtures';
import type { RepositoryContext } from './repository';

const data = loadFixtureData();
const repo = new FixtureJobRepository(data);
const ctx: RepositoryContext = { now: new Date('2026-09-29T12:00:00Z'), sourceOverrides: {}, liveCrawlEnabled: false };
const q = (qs: string) => parseSearchQuery(new URLSearchParams(qs)).query;

describe('fixtureの読み込みと変換', () => {
  it('24件の元fixtureと追加の端境ケースをドメインモデルに変換する', () => {
    expect(data.listings).toHaveLength(36);
    expect(data.listings.every((l) => l.demo)).toBe(true);
    expect(data.listings.every((l) => new URL(l.canonicalUrl).hostname.endsWith('.example'))).toBe(true);
    expect(repo.demoRecordCount()).toBe(36);
  });

  it('実ソース候補は初期OFFで読み込む', () => {
    const candidates = data.sources.filter((s) => s.kind === 'candidate');
    expect(candidates.map((s) => s.id).sort()).toEqual(['ats_review_template', 'employer_public_template', 'engage_review', 'hellowork_public']);
    expect(candidates.every((s) => !s.publicEnabled && !s.fetchEnabled)).toBe(true);
  });

  it('架空ドメイン以外のURLや不正な給与は読み込みで失敗させる', () => {
    const base = {
      id: 'x-1',
      title: 't',
      employerName: 'e',
      occupation: 'driver',
      salary: { min: 1, max: 2, unit: 'MONTH', currency: 'JPY', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
      prefecture: '東京都',
      city: null,
      employmentType: '正社員',
      facts: {},
      sourceName: 's',
      sourceUrl: 'https://real-company.co.jp/jobs/1',
      lastFetchedAt: '2026-09-29T00:00:00Z',
      sourcePostedAt: null,
      applicationRoute: 'employer',
      displayMode: 'facts_link',
      authorizedDescription: null,
      state: 'published',
      demo: true,
    } satisfies DemoJobFixture;
    expect(() => toSourceListing(base)).toThrow(FixtureError);
    expect(() => toSourceListing({ ...base, sourceUrl: 'https://x.example/1', salary: { ...base.salary, min: 3 } })).toThrow(/逆転/);
  });
});

describe('検索と公開判定', () => {
  it('掲載終了・削除依頼・7日超の確認不能は検索に出さない', async () => {
    const result = await repo.search({ ...DEFAULT_QUERY }, ctx);
    expect(result.total).toBe(32);
    const ids = new Set((await repo.search({ ...DEFAULT_QUERY, page: 2 }, ctx)).items.map((j) => j.id).concat(result.items.map((j) => j.id)));
    expect(ids.has('demo-manufacturing-4')).toBe(false);
    expect(ids.has('demo-office-4')).toBe(false);
    expect(ids.has('demo-care-4')).toBe(false);
    expect(ids.has('demo-driver-1-alt')).toBe(false);
  });

  it('1ページ20件', async () => {
    const result = await repo.search({ ...DEFAULT_QUERY }, ctx);
    expect(result.items).toHaveLength(20);
    expect(result.pageCount).toBe(2);
  });

  it('オンコールなし：明記のある求人だけ（UI04）', async () => {
    const result = await repo.search(q('occupation=nurse&onCall=no'), ctx);
    expect(result.items.map((j) => j.id).sort()).toEqual(['demo-nurse-1', 'demo-nurse-4']);
    expect(result.unknownNotes).toEqual([{ group: 'facet:onCall', label: 'オンコール', count: 2 }]);
  });

  it('月給30万円以上（UI03）', async () => {
    const result = await repo.search(q('salaryUnit=MONTH&salaryMin=300000'), ctx);
    expect(result.items.every((j) => j.salary.unit === 'MONTH' && (j.salary.min ?? 0) >= 300000)).toBe(true);
    expect(result.total).toBeGreaterThan(5);
  });

  it('鮮度の注意表示（情報確認から72時間超・再確認できない求人）', async () => {
    const result = await repo.lookup(['demo-nurse-5'], ctx);
    expect(result[0]).toMatchObject({ status: 'public', job: { staleWarning: true, state: 'stale' } });
  });
});

describe('求人詳細と状態', () => {
  it('同一募集の他の掲載元を、給与を合成せずに返す', async () => {
    const result = await repo.getJob('demo-driver-1', ctx);
    if (result.status !== 'public') throw new Error('expected public');
    expect(result.detail.job.salary.min).toBe(310000);
    expect(result.detail.otherListings).toHaveLength(1);
    expect(result.detail.otherListings[0]).toMatchObject({ listingId: 'demo-driver-1-alt', applicationRoute: 'agency' });
    expect(result.detail.otherListings[0]?.salary.min).toBe(300000);
  });

  it('facts_link の求人は本文を返さない（DATA09）', async () => {
    const result = await repo.getJob('demo-driver-1', ctx);
    if (result.status !== 'public') throw new Error('expected public');
    expect(result.detail.job.displayMode).toBe('facts_link');
    expect(result.detail.job.authorizedDescription).toBeNull();
    const full = await repo.getJob('demo-driver-2', ctx);
    if (full.status !== 'public') throw new Error('expected public');
    expect(full.detail.job.authorizedDescription).toContain('架空');
  });

  it('掲載終了は最小限の表示、削除依頼は存在しないIDと同じ応答', async () => {
    expect(await repo.getJob('demo-manufacturing-4', ctx)).toEqual({
      status: 'expired',
      id: 'demo-manufacturing-4',
      title: '食品工場のライン作業（夜勤）',
      employerName: 'サンプル食品G株式会社（架空）',
    });
    expect(await repo.getJob('demo-office-4', ctx)).toEqual({ status: 'unavailable', id: 'demo-office-4' });
    expect(await repo.getJob('no-such-job', ctx)).toEqual({ status: 'unavailable', id: 'no-such-job' });
  });

  it('元公開日がない求人は初回検出日を公開日として偽らない（DATA10）', async () => {
    const result = await repo.getJob('demo-driver-3', ctx);
    if (result.status !== 'public') throw new Error('expected public');
    expect(result.detail.job.sourcePostedAt).toBeNull();
    expect(result.detail.job.firstSeenAt).toBe('2026-09-29T00:00:00Z');
  });
});

describe('ソース停止の伝播（OPS01）', () => {
  const paused: RepositoryContext = { ...ctx, sourceOverrides: { demo_employer_facts: { publicEnabled: false } } };

  it('検索・詳細・保存照会・送客から即座に外れる', async () => {
    const result = await repo.search({ ...DEFAULT_QUERY }, paused);
    const all = [...result.items, ...(await repo.search({ ...DEFAULT_QUERY, page: 2 }, paused)).items];
    expect(all.some((j) => j.sourceId === 'demo_employer_facts')).toBe(false);
    expect(await repo.getJob('demo-driver-3', paused)).toEqual({ status: 'unavailable', id: 'demo-driver-3' });
    expect(await repo.lookup(['demo-driver-3'], paused)).toEqual([{ status: 'unavailable', id: 'demo-driver-3' }]);
    expect(await repo.getOutboundDestination('demo-driver-3', paused)).toBeNull();
    expect(await repo.getOutboundDestination('demo-driver-3', ctx)).toMatchObject({ url: 'https://employer-driver-3.example/jobs/1' });
  });

  it('同一募集の別ソースが公開中なら、そのlistingを主表示にする', async () => {
    const result = await repo.getJob('demo-driver-1', paused);
    if (result.status !== 'public') throw new Error('expected public');
    expect(result.detail.job.primaryListingId).toBe('demo-driver-1-alt');
    expect(result.detail.job.sourceId).toBe('demo_agency');
    expect(result.detail.job.salary.min).toBe(300000);
  });

  it('審査記録のない実ソース候補は、管理操作でも有効化されない（REL02）', async () => {
    const tried: RepositoryContext = { ...ctx, sourceOverrides: { engage_review: { publicEnabled: true, fetchEnabled: true } } };
    const row = await repo.getSource('engage_review', tried);
    expect(row?.source.publicEnabled).toBe(false);
    expect(row?.source.fetchEnabled).toBe(false);
    expect(row?.publicBlockers.length).toBeGreaterThan(0);
    expect(row?.fetchBlockers.join()).toContain('ENABLE_LIVE_CRAWL');
  });
});

describe('PR枠（UI12）', () => {
  it('予算のある契約求人だけをPRに出し、条件に合わない場合は出さない', async () => {
    expect((await repo.search({ ...DEFAULT_QUERY }, ctx)).promotions.map((p) => p.job.id)).toEqual(['demo-engineer-2']);
    expect((await repo.search(q('occupation=engineer'), ctx)).promotions).toHaveLength(1);
    expect((await repo.search(q('occupation=driver'), ctx)).promotions).toHaveLength(0);
  });

  it('予算切れの求人（demo-nurse-2）はPR枠から外れ、自然検索にだけ出る', async () => {
    const result = await repo.search(q('occupation=nurse'), ctx);
    expect(result.promotions).toHaveLength(0);
    expect(result.items.map((j) => j.id)).toContain('demo-nurse-2');
  });

  it('2ページ目以降にはPRを出さない', async () => {
    expect((await repo.search({ ...DEFAULT_QUERY, page: 2 }, ctx)).promotions).toHaveLength(0);
  });
});
