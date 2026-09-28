import { describe, expect, it } from 'vitest';
import type { Campaign, PublicJob } from './types';
import { buildComparisonRows, differingRows, normalizeCompareIds } from './compare';
import { buildJobPostingJsonLd, isHubIndexable, jobDetailRobots, serializeJsonLd } from './seo';
import { campaignIneligibility } from './campaigns';
import { assertFixtureSafety, FixtureSafetyError } from './guards';
import { reportInputSchema } from './report';
import { findPrefectureByName, PREFECTURES } from './prefectures';
import { formatDateJst, formatDateTimeJst } from './time';
import { makeJob, makeSource, TEST_NOW } from './test-helpers';

describe('比較表', () => {
  it('異職種では職種固有項目を「対象外」、不明同士は差分にしない', () => {
    const driver = makeJob({ id: 'd1', facts: { 必要免許: '中型免許', 配送範囲: '地場', 手積み: null, 帰宅頻度: '毎日' } });
    const nurse = makeJob({ id: 'n1', occupation: 'nurse', facts: { 施設形態: 'クリニック', 必要資格: '看護師', 夜勤: 'なし', オンコール: 'なし' } });
    const rows = buildComparisonRows([driver, nurse]);
    const range = rows.find((r) => r.key === 'fact:driver:配送範囲');
    expect(range?.cells.map((c) => c.text)).toEqual(['地場', '対象外']);
    const overtime = rows.find((r) => r.key === 'overtime');
    expect(overtime?.differs).toBe(false);
    expect(overtime?.cells.every((c) => c.kind === 'unknown')).toBe(true);
    expect(differingRows(rows).map((r) => r.key)).not.toContain('overtime');
  });

  it('比較IDは重複を除き3件まで', () => {
    expect(normalizeCompareIds(['a', 'b', 'a', 'c', 'd'])).toEqual({ ids: ['a', 'b', 'c'], truncated: true });
    expect(normalizeCompareIds(['<script>', 'ok-1'])).toEqual({ ids: ['ok-1'], truncated: false });
  });
});

describe('SEO（SEO01・SEO02・SEO04）', () => {
  const fullJob = {
    ...makeJob({ id: 'x1', displayMode: 'full_authorized', sourcePostedAt: '2026-09-20', demo: false }),
    authorizedDescription: '掲載許諾のある本文',
  } satisfies PublicJob;
  const env = { demo: false, enableJobPosting: true, now: TEST_NOW };

  it('facts_link の求人は noindex で JobPosting を出さない', () => {
    const factsJob = { ...fullJob, displayMode: 'facts_link' as const, authorizedDescription: null };
    expect(jobDetailRobots(factsJob, makeSource({ seoIndexAllowed: true }), env).index).toBe(false);
    expect(buildJobPostingJsonLd(factsJob, makeSource({ jobPostingAllowed: true }), env)).toBeNull();
  });

  it('許可・必須項目・フラグが揃う完全詳細だけ JobPosting を出す', () => {
    const source = makeSource({ jobPostingAllowed: true });
    const jsonLd = buildJobPostingJsonLd(fullJob, source, env);
    expect(jsonLd).toMatchObject({ '@type': 'JobPosting', title: 'テスト求人', datePosted: '2026-09-20', directApply: false });
    expect(jsonLd).not.toHaveProperty('baseSalary');
    expect(buildJobPostingJsonLd(fullJob, source, { ...env, enableJobPosting: false })).toBeNull();
    expect(buildJobPostingJsonLd(fullJob, makeSource({ jobPostingAllowed: false }), env)).toBeNull();
    expect(buildJobPostingJsonLd({ ...fullJob, validThrough: '2026-09-01T00:00:00Z' }, source, env)).toBeNull();
    expect(buildJobPostingJsonLd({ ...fullJob, demo: true }, source, env)).toBeNull();
  });

  it('デモでは常に noindex、空・薄いハブは index しない', () => {
    expect(jobDetailRobots(fullJob, makeSource({ seoIndexAllowed: true }), { demo: true }).index).toBe(false);
    expect(isHubIndexable(0, { demo: false })).toBe(false);
    expect(isHubIndexable(50, { demo: true })).toBe(false);
    expect(isHubIndexable(50, { demo: false })).toBe(true);
  });

  it('JSON-LDの埋め込みで </script> を壊さない', () => {
    expect(serializeJsonLd({ t: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

describe('PR枠の条件（UI12）', () => {
  const campaign: Campaign = {
    id: 'c1',
    jobId: 'x',
    status: 'active',
    authorityVerified: true,
    agreementVerified: true,
    cpcJpy: 100,
    budgetRemainingJpy: 1000,
    startsAt: '2026-09-01T00:00:00Z',
    endsAt: '2026-12-31T00:00:00Z',
    sandbox: true,
  };
  const source = { commercialPromotionAllowed: true };

  it('予算・契約・権限・期間・広告化許可が揃う場合だけ', () => {
    expect(campaignIneligibility(campaign, source, TEST_NOW)).toBeNull();
    expect(campaignIneligibility({ ...campaign, budgetRemainingJpy: 99 }, source, TEST_NOW)).toBe('budget_exhausted');
    expect(campaignIneligibility({ ...campaign, agreementVerified: false }, source, TEST_NOW)).toBe('agreement_unverified');
    expect(campaignIneligibility({ ...campaign, authorityVerified: false }, source, TEST_NOW)).toBe('authority_unverified');
    expect(campaignIneligibility({ ...campaign, endsAt: '2026-09-02T00:00:00Z' }, source, TEST_NOW)).toBe('out_of_period');
    expect(campaignIneligibility(campaign, { commercialPromotionAllowed: false }, TEST_NOW)).toBe('promotion_not_allowed');
  });
});

describe('fixture混入防止（REL01）', () => {
  it('APP_ENV=production では demo モード・demoレコードで停止する', () => {
    expect(() => assertFixtureSafety({ appEnv: 'production', dataMode: 'demo', demoRecordCount: 0 })).toThrow(FixtureSafetyError);
    expect(() => assertFixtureSafety({ appEnv: 'production', dataMode: 'live', demoRecordCount: 3 })).toThrow(FixtureSafetyError);
    expect(() => assertFixtureSafety({ appEnv: 'production', dataMode: 'live', demoRecordCount: 0 })).not.toThrow();
    expect(() => assertFixtureSafety({ appEnv: 'local', dataMode: 'demo', demoRecordCount: 30 })).not.toThrow();
  });
});

describe('訂正・削除申請の入力', () => {
  const base = { jobId: 'demo-driver-1', type: 'incorrect', details: '給与が違います', wantsReply: false };

  it('返信を希望しない場合は連絡先なしで受け付ける', () => {
    expect(reportInputSchema.safeParse(base).success).toBe(true);
  });

  it('返信を希望する場合はメールアドレスが必要', () => {
    const result = reportInputSchema.safeParse({ ...base, wantsReply: true, email: 'invalid' });
    expect(result.success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, wantsReply: true, email: 'user@example.com' }).success).toBe(true);
  });

  it('危険なURL・長すぎる本文は拒否する', () => {
    expect(reportInputSchema.safeParse({ ...base, jobId: null, targetUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, details: 'あ'.repeat(2001) }).success).toBe(false);
  });
});

describe('都道府県・日時', () => {
  it('47都道府県とJISコード', () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(findPrefectureByName('東京')?.code).toBe('13');
    expect(findPrefectureByName('京都')?.code).toBe('26');
    expect(findPrefectureByName('北海道')?.code).toBe('01');
  });

  it('UTCで保存した時刻を日本時間で表示する', () => {
    expect(formatDateJst('2026-09-28T16:00:00Z')).toBe('2026/09/29');
    expect(formatDateTimeJst('2026-09-29T00:00:00Z')).toBe('2026/09/29 09:00');
  });
});
