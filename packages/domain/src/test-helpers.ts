import type { PublicJobSummary, SourceRecord } from './types';
import { deriveFacets } from './facets';

/** テスト用の公開求人（架空） */
export function makeJob(overrides: Partial<PublicJobSummary> & { id: string }): PublicJobSummary {
  const occupation = overrides.occupation ?? 'driver';
  const facts = overrides.facts ?? {};
  const employmentTypes = overrides.employmentTypes ?? ['fulltime'];
  return {
    primaryListingId: overrides.id,
    title: 'テスト求人',
    employerName: 'テスト株式会社（架空）',
    occupation,
    locations: [{ country: 'JP', prefectureCode: '13', city: '江東区', displayAddress: '東京都江東区', remoteMode: 'unknown' }],
    employmentTypes,
    salary: {
      currency: 'JPY',
      min: 300000,
      max: 350000,
      unit: 'MONTH',
      basis: 'gross',
      fixedOvertimeIncluded: 'unknown',
      fixedOvertimeHours: null,
      fixedOvertimeAmount: null,
      evidenceIds: [],
    },
    facts,
    facets: overrides.facets ?? deriveFacets(occupation, { facts, employmentTypes }),
    workingHours: null,
    requiredQualification: null,
    displayMode: 'facts_link',
    sourceId: 'demo_employer_facts',
    sourceName: 'デモ企業採用ページ',
    sourceUrl: `https://${overrides.id}.example/jobs/1`,
    lastFetchedAt: '2026-09-29T00:00:00Z',
    sourcePostedAt: null,
    firstSeenAt: '2026-09-29T00:00:00Z',
    validThrough: null,
    applicationRoute: 'employer',
    state: 'published',
    staleWarning: false,
    otherListingCount: 0,
    demo: true,
    ...overrides,
  };
}

export function makeSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'demo_employer_facts',
    version: 1,
    lane: 'PUBLIC_FACT_INDEX',
    hosts: [],
    allowedPaths: [],
    reviewStatus: 'approved',
    reviewId: 'DEMO-REVIEW-001',
    reviewExpiresAt: null,
    fetchEnabled: false,
    publicEnabled: true,
    displayMode: 'facts_link',
    storageMode: 'facts_only',
    publicFields: ['title', 'employerName', 'locations', 'salary', 'employmentTypes', 'facts', 'sourceName', 'sourceUrl', 'lastFetchedAt'],
    imageAllowed: false,
    seoIndexAllowed: false,
    jobPostingAllowed: false,
    commercialPromotionAllowed: false,
    maxRequestsPerHostPerDay: 100,
    maxConcurrencyPerHost: 1,
    minRequestIntervalMs: 10000,
    maxResponseBytes: 5242880,
    rawRetentionHours: 0,
    staleHideAfterHours: 168,
    name: 'デモ企業採用ページ（事実情報）',
    publicName: 'デモ企業採用ページ',
    kind: 'demo',
    termsUrl: null,
    termsCheckedAt: null,
    robotsStatus: 'not_applicable',
    activationNote: 'テスト用',
    ...overrides,
  };
}

export const TEST_NOW = new Date('2026-09-29T12:00:00Z');
