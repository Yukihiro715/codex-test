import { describe, expect, it } from 'vitest';
import { CRAWLER_UA_TOKEN, reviewExpiresAtInstant, reviewPolicyViolations, reviewRecordProblems, sourceReviewSchema, type SourceReview } from './source-review';
import { makeSource } from './test-helpers';

const NOW = new Date('2026-09-29T12:00:00Z');

/** 承認済みで整合の取れた審査記録（架空） */
function makeReview(overrides: Partial<SourceReview> = {}): SourceReview {
  return {
    schemaVersion: 1,
    id: 'SR-2026-0100',
    sourceId: 'employer_test',
    sourceVersion: 1,
    title: 'テスト採用サイト（架空）',
    lane: 'PUBLIC_FACT_INDEX',
    scope: { hosts: ['careers.example.com'], paths: ['/jobs'], employer: 'テスト株式会社（架空）', access: 'html_page', discovery: '求人一覧からのリンクだけ' },
    terms: { url: null, checkedAt: '2026-09-29T00:00:00Z', contentSha256: null, appliesToService: 'no', automatedAccess: 'silent', reuse: 'silent', conditions: [], notes: '' },
    robots: {
      url: 'https://careers.example.com/robots.txt',
      fetchedAt: '2026-09-29T00:00:00Z',
      httpStatus: 200,
      userAgentToken: CRAWLER_UA_TOKEN,
      matchedGroup: '*',
      result: 'allow',
      matchedRules: [],
      contentSha256: null,
    },
    basis: '一般公開の採用ページ',
    issues: [],
    fields: { acquire: ['title', 'employerName', 'salary', 'sourceUrl'], display: ['title', 'employerName', 'salary', 'sourceUrl'] },
    storage: { mode: 'facts_only', rawRetentionHours: 0 },
    displayMode: 'facts_link',
    image: { allowed: false, basis: null },
    outbound: { hosts: ['careers.example.com'], applicationRoute: 'employer' },
    seo: { indexAllowed: false, jobPostingAllowed: false },
    promotion: { allowed: false, basis: null },
    crawl: { maxRequestsPerDay: 100, maxConcurrency: 1, minIntervalMs: 10_000 },
    freshness: { recheckHours: 24, staleHideAfterHours: 168 },
    owner: '責任者A',
    reviewers: ['確認者B'],
    legal: { required: false, status: 'not_requested', summary: null },
    proposal: '',
    decision: 'approved',
    decidedAt: '2026-09-29T00:00:00Z',
    expiresAt: '2027-03-27',
    evidence: [],
    notes: '',
    ...overrides,
  };
}

/** 審査記録の範囲内のソース設定 */
function makeReviewedSource(overrides: Parameters<typeof makeSource>[0] = {}) {
  return makeSource({
    id: 'employer_test',
    kind: 'candidate',
    version: 1,
    lane: 'PUBLIC_FACT_INDEX',
    hosts: ['careers.example.com'],
    allowedPaths: ['/jobs/'],
    reviewStatus: 'approved',
    reviewId: 'SR-2026-0100',
    reviewExpiresAt: '2027-03-27',
    displayMode: 'facts_link',
    publicFields: ['title', 'salary'],
    storageMode: 'facts_only',
    rawRetentionHours: 0,
    maxRequestsPerHostPerDay: 50,
    maxConcurrencyPerHost: 1,
    minRequestIntervalMs: 15_000,
    staleHideAfterHours: 168,
    publicEnabled: true,
    fetchEnabled: true,
    ...overrides,
  });
}

describe('ソース審査記録の整合性', () => {
  it('整合の取れた承認済みの記録は通る', () => {
    expect(reviewRecordProblems(makeReview())).toEqual([]);
    expect(sourceReviewSchema.safeParse(makeReview()).success).toBe(true);
  });

  it('表示項目は取得項目の範囲内、画像・広告の許可には根拠が必要', () => {
    expect(reviewRecordProblems(makeReview({ fields: { acquire: ['title'], display: ['title', 'salary'] } })).join()).toContain('salary');
    expect(reviewRecordProblems(makeReview({ image: { allowed: true, basis: null } })).join()).toContain('image.basis');
    expect(reviewRecordProblems(makeReview({ promotion: { allowed: true, basis: null } })).join()).toContain('promotion.basis');
  });

  it('JobPosting・本文表示は許諾と表示方式がそろう場合だけ', () => {
    expect(reviewRecordProblems(makeReview({ seo: { indexAllowed: true, jobPostingAllowed: true } })).join()).toContain('JobPosting');
    expect(reviewRecordProblems(makeReview({ displayMode: 'full_authorized' })).join()).toContain('terms.reuse');
  });

  it('不明なrobots・自社UA以外での判定・未解決のblocker・確認者なしでは承認できない', () => {
    expect(reviewRecordProblems(makeReview({ robots: { ...makeReview().robots, result: 'unknown' } })).join()).toContain('robots');
    expect(reviewRecordProblems(makeReview({ robots: { ...makeReview().robots, userAgentToken: 'Googlebot' } })).join()).toContain(CRAWLER_UA_TOKEN);
    const blocker = { id: 'X-1', summary: '規約で禁止', severity: 'blocker' as const, status: 'open' as const, resolution: null };
    expect(reviewRecordProblems(makeReview({ issues: [blocker] })).join()).toContain('X-1');
    expect(reviewRecordProblems(makeReview({ reviewers: ['責任者A'] })).join()).toContain('確認者');
    expect(reviewRecordProblems(makeReview({ terms: { ...makeReview().terms, automatedAccess: 'prohibited' } })).join()).toContain('自動取得');
  });

  it('範囲確認レーンは法務確認が必要、除外レーンは承認できない', () => {
    expect(reviewRecordProblems(makeReview({ lane: 'DISPUTED_SCOPE', expiresAt: '2026-12-27' })).join()).toContain('法務確認');
    expect(reviewRecordProblems(makeReview({ lane: 'EXCLUDED' })).join()).toContain('除外レーン');
  });

  it('再審査期限はレーンごとの最長期間まで（B は180日）', () => {
    expect(reviewRecordProblems(makeReview({ expiresAt: '2027-03-28' }))).toEqual([]);
    expect(reviewRecordProblems(makeReview({ expiresAt: '2027-09-29' })).join()).toContain('最長180日');
    expect(reviewRecordProblems(makeReview({ expiresAt: null })).join()).toContain('expiresAt');
  });

  it('サンプル取得では公開表示を認めない。保留の記録は項目が空でも通る', () => {
    expect(reviewRecordProblems(makeReview({ decision: 'sample_only' })).join()).toContain('sample_only');
    const pending = makeReview({ decision: 'pending', decidedAt: null, expiresAt: null, reviewers: [], scope: { ...makeReview().scope, hosts: [], paths: [] } });
    expect(reviewRecordProblems(pending)).toEqual([]);
  });

  it('再審査期限はJSTの日付の終わりまで', () => {
    expect(reviewExpiresAtInstant('2027-03-27').toISOString()).toBe('2027-03-27T15:00:00.000Z');
  });
});

describe('ソース設定は審査記録の範囲内', () => {
  it('範囲内の設定は違反なし', () => {
    expect(reviewPolicyViolations(makeReviewedSource(), makeReview(), NOW)).toEqual([]);
  });

  it('表示方式・表示項目・ホスト・パス・取得上限・鮮度が審査を超えると違反', () => {
    const review = makeReview();
    expect(reviewPolicyViolations(makeReviewedSource({ displayMode: 'full_authorized' }), review, NOW).join()).toContain('表示方式');
    expect(reviewPolicyViolations(makeReviewedSource({ publicFields: ['title', 'photo'] }), review, NOW).join()).toContain('photo');
    expect(reviewPolicyViolations(makeReviewedSource({ hosts: ['careers.example.com', 'other.example.com'] }), review, NOW).join()).toContain('other.example.com');
    expect(reviewPolicyViolations(makeReviewedSource({ allowedPaths: ['/jobsearch'] }), review, NOW).join()).toContain('/jobsearch');
    expect(reviewPolicyViolations(makeReviewedSource({ maxRequestsPerHostPerDay: 500 }), review, NOW).join()).toContain('リクエスト上限');
    expect(reviewPolicyViolations(makeReviewedSource({ minRequestIntervalMs: 1000 }), review, NOW).join()).toContain('間隔');
    expect(reviewPolicyViolations(makeReviewedSource({ staleHideAfterHours: 336 }), review, NOW).join()).toContain('検索から外す');
    expect(reviewPolicyViolations(makeReviewedSource({ imageAllowed: true }), review, NOW).join()).toContain('画像');
  });

  it('設定の version が変わったら再審査が必要', () => {
    expect(reviewPolicyViolations(makeReviewedSource({ version: 2 }), makeReview(), NOW).join()).toContain('version 2');
  });

  it('保留中・期限切れの審査で有効になっていれば違反', () => {
    const pending = makeReview({ decision: 'pending', decidedAt: null, expiresAt: null });
    const source = makeReviewedSource({ reviewStatus: 'unreviewed', reviewExpiresAt: null });
    expect(reviewPolicyViolations(source, pending, NOW).join()).toContain('承認されていない');
    expect(reviewPolicyViolations(makeReviewedSource(), makeReview(), new Date('2027-03-27T15:00:00Z')).join()).toContain('再審査期限');
  });

  it('審査記録がないソースは、無効・未審査のままでなければ違反', () => {
    const unreviewed = makeReviewedSource({ reviewStatus: 'unreviewed', reviewId: null, reviewExpiresAt: null, publicEnabled: false, fetchEnabled: false });
    expect(reviewPolicyViolations(unreviewed, null, NOW)).toEqual([]);
    expect(reviewPolicyViolations(makeReviewedSource(), null, NOW).length).toBeGreaterThan(0);
  });
});
