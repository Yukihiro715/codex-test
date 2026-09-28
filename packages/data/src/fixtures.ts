import { z } from 'zod';
import {
  deriveFacets,
  findPrefectureByName,
  isOccupationSlug,
  isSafeExternalUrl,
  isValidIsoDate,
  normalizeEmploymentType,
  salaryIssues,
  type Campaign,
  type FacetMap,
  type JobCluster,
  type RemoteMode,
  type SourceListing,
  type SourceRecord,
} from '@worklens/domain';
import jobsDemo from '../../../fixtures/jobs.demo.json';
import jobsDemoEdge from '../../../fixtures/jobs.demo.edge.json';
import sourcesDemo from '../../../fixtures/sources.demo.json';
import campaignsDemo from '../../../fixtures/campaigns.demo.json';
import sourceRegistry from '../../../config/source_registry.example.json';

const isoDate = z.string().refine(isValidIsoDate, '日時の形式が正しくありません');

const salarySchema = z.object({
  min: z.number().int().positive().nullable(),
  max: z.number().int().positive().nullable(),
  unit: z.enum(['HOUR', 'DAY', 'MONTH', 'YEAR', 'UNKNOWN']),
  currency: z.literal('JPY'),
  basis: z.enum(['base', 'gross', 'example', 'unknown']),
  fixedOvertimeIncluded: z.enum(['yes', 'no', 'unknown']),
  fixedOvertimeHours: z.number().int().positive().nullable(),
  fixedOvertimeAmount: z.number().int().positive().nullable(),
  evidenceIds: z.array(z.string()),
});

/**
 * fixtures/jobs.demo*.json（画面デモ向けの簡略形）のスキーマ。
 * 本番用ドメインモデル（SourceListing）とは別の形なので、下の変換層を必ず通す。
 */
export const demoJobFixtureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().min(1).max(200),
  employerName: z.string().min(1).max(200),
  occupation: z.string().refine(isOccupationSlug, '未定義の職種です'),
  salary: salarySchema,
  prefecture: z.string().min(1),
  city: z.string().nullable(),
  employmentType: z.string().min(1),
  facts: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string()), z.null()])),
  sourceName: z.string().min(1),
  sourceUrl: z.string().refine(isSafeExternalUrl, 'http(s)のURLではありません'),
  lastFetchedAt: isoDate,
  sourcePostedAt: isoDate.nullable(),
  applicationRoute: z.enum(['employer', 'agency', 'hellowork', 'jobboard', 'unknown']),
  displayMode: z.enum(['none', 'link_only', 'facts_link', 'full_authorized']),
  authorizedDescription: z.string().nullable(),
  state: z.enum(['discovered', 'fetched', 'parsed', 'review_required', 'eligible', 'published', 'stale', 'expired', 'suppressed']),
  demo: z.literal(true),
  // 追加fixture（jobs.demo.edge.json）用の拡張項目
  sourceId: z.string().optional(),
  firstSeenAt: isoDate.optional(),
  validThrough: isoDate.nullable().optional(),
  clusterId: z.string().optional(),
});
export type DemoJobFixture = z.infer<typeof demoJobFixtureSchema>;

const sourceRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  version: z.number().int().positive(),
  lane: z.enum(['OPEN_REUSE', 'PUBLIC_FACT_INDEX', 'DISPUTED_SCOPE', 'EXCLUDED']),
  hosts: z.array(z.string()),
  allowedPaths: z.array(z.string()),
  reviewStatus: z.enum(['unreviewed', 'sample_only', 'approved', 'rejected']),
  reviewId: z.string().nullable(),
  reviewExpiresAt: isoDate.nullable(),
  fetchEnabled: z.boolean(),
  publicEnabled: z.boolean(),
  displayMode: z.enum(['none', 'link_only', 'facts_link', 'full_authorized']),
  storageMode: z.enum(['none', 'facts_only', 'ephemeral_raw', 'licensed_raw']),
  publicFields: z.array(z.string()),
  imageAllowed: z.boolean(),
  seoIndexAllowed: z.boolean(),
  jobPostingAllowed: z.boolean(),
  commercialPromotionAllowed: z.boolean(),
  maxRequestsPerHostPerDay: z.number().int().nonnegative(),
  maxConcurrencyPerHost: z.number().int().positive(),
  minRequestIntervalMs: z.number().int().nonnegative(),
  maxResponseBytes: z.number().int().positive(),
  rawRetentionHours: z.number().int().nonnegative(),
  staleHideAfterHours: z.number().int().positive(),
  termsUrl: z.string().nullable(),
  termsCheckedAt: z.string().nullable(),
  robotsStatus: z.enum(['unverified', 'allow', 'disallow', 'unreachable', 'not_applicable']),
  activationNote: z.string(),
});

const demoSourceSchema = sourceRecordSchema.extend({
  kind: z.literal('demo'),
  name: z.string().min(1),
  publicName: z.string().min(1),
});

const candidateSourceSchema = sourceRecordSchema.extend({ name: z.string().min(1) });

const campaignSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  status: z.enum(['active', 'paused', 'ended']),
  authorityVerified: z.boolean(),
  agreementVerified: z.boolean(),
  cpcJpy: z.number().int().nonnegative(),
  budgetRemainingJpy: z.number().int().nonnegative(),
  startsAt: isoDate,
  endsAt: isoDate,
  sandbox: z.literal(true),
});

export class FixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureError';
  }
}

/** 決定的な短いハッシュ（FNV-1a）。暗号用途ではなく変更検知用。 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** 旧fixture（sourceId未指定）の既定ソース：表示方式で振り分ける */
function defaultSourceId(fixture: DemoJobFixture): string {
  return fixture.displayMode === 'full_authorized' ? 'demo_employer_authorized' : 'demo_employer_facts';
}

function remoteModeFrom(facets: FacetMap): RemoteMode {
  const office = facets.office;
  if (!office) return 'unknown';
  if (office.includes('remote')) return 'remote';
  if (office.includes('hybrid')) return 'hybrid';
  if (office.includes('onsite')) return 'onsite';
  return 'unknown';
}

function textFact(value: DemoJobFixture['facts'][string] | undefined): string | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? value.join(' / ') : String(value);
}

/** 簡略fixture → SourceListing（ドメインモデル）への変換。架空ドメイン・給与の整合性も検査する。 */
export function toSourceListing(fixture: DemoJobFixture): SourceListing {
  const prefecture = findPrefectureByName(fixture.prefecture);
  if (!prefecture) throw new FixtureError(`${fixture.id}: 都道府県「${fixture.prefecture}」を解決できません`);
  const host = new URL(fixture.sourceUrl).hostname;
  if (!host.endsWith('.example')) {
    throw new FixtureError(`${fixture.id}: デモ求人のURLは架空ドメイン（.example）である必要があります: ${host}`);
  }
  const issues = salaryIssues({ ...fixture.salary });
  if (issues.length > 0) throw new FixtureError(`${fixture.id}: 給与データに問題があります（${issues.join('、')}）`);

  const employmentTypes = [normalizeEmploymentType(fixture.employmentType)];
  const facets = deriveFacets(fixture.occupation, { facts: fixture.facts, employmentTypes });
  const sourceId = fixture.sourceId ?? defaultSourceId(fixture);
  return {
    id: fixture.id,
    sourceId,
    sourceScopeId: `${sourceId}:${host}`,
    sourceJobId: fixture.id,
    canonicalUrl: fixture.sourceUrl,
    employerId: `emp-${fnv1a(fixture.employerName.normalize('NFKC'))}`,
    employerName: fixture.employerName,
    title: fixture.title,
    occupation: fixture.occupation,
    locations: [
      {
        country: 'JP',
        prefectureCode: prefecture.code,
        city: fixture.city,
        displayAddress: `${prefecture.name}${fixture.city ?? ''}`,
        remoteMode: remoteModeFrom(facets),
      },
    ],
    employmentTypes,
    salary: { ...fixture.salary },
    facts: { ...fixture.facts },
    facets,
    workingHours: textFact(fixture.facts['勤務時間']),
    requiredQualification: textFact(fixture.facts['必要資格'] ?? fixture.facts['必要免許']),
    evidenceIds: [],
    state: fixture.state,
    sourcePostedAt: fixture.sourcePostedAt,
    // 旧fixtureには初回検出日がないため、最終確認日時で代用する（DECISIONS_LOG参照）
    firstSeenAt: fixture.firstSeenAt ?? fixture.lastFetchedAt,
    lastFetchedAt: fixture.lastFetchedAt,
    lastChangedAt: fixture.lastFetchedAt,
    validThrough: fixture.validThrough ?? null,
    contentHash: fnv1a(JSON.stringify(fixture)),
    applicationRoute: fixture.applicationRoute,
    displayGrant: fixture.displayMode,
    authorizedDescription: fixture.authorizedDescription,
    clusterId: fixture.clusterId ?? fixture.id,
    demo: fixture.demo,
  };
}

export interface FixtureData {
  listings: SourceListing[];
  clusters: JobCluster[];
  sources: SourceRecord[];
  campaigns: Campaign[];
}

function parseAll<T>(schema: z.ZodType<T>, items: unknown[], label: string): T[] {
  return items.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      throw new FixtureError(`${label}[${index}] が不正です: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`);
    }
    return result.data;
  });
}

/** fixtureを読み込み、検証・変換する。問題があれば起動時に失敗させる。 */
export function loadFixtureData(): FixtureData {
  const fixtures = [
    ...parseAll(demoJobFixtureSchema, jobsDemo as unknown[], 'jobs.demo.json'),
    ...parseAll(demoJobFixtureSchema, jobsDemoEdge as unknown[], 'jobs.demo.edge.json'),
  ];
  const listings = fixtures.map(toSourceListing);

  const ids = new Set<string>();
  for (const listing of listings) {
    if (ids.has(listing.id)) throw new FixtureError(`求人IDが重複しています: ${listing.id}`);
    ids.add(listing.id);
  }

  const demoSources: SourceRecord[] = parseAll(demoSourceSchema, (sourcesDemo as { sources: unknown[] }).sources, 'sources.demo.json');
  const candidates: SourceRecord[] = parseAll(candidateSourceSchema, (sourceRegistry as { sources: unknown[] }).sources, 'source_registry.example.json').map(
    (s) => ({ ...s, kind: 'candidate' as const, publicName: s.name }),
  );
  const sources = [...demoSources, ...candidates];
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const candidate of candidates) {
    if (candidate.fetchEnabled || candidate.publicEnabled) {
      throw new FixtureError(`実ソース候補 ${candidate.id} が有効になっています。審査記録のない実ソースは初期OFFにしてください。`);
    }
  }
  for (const listing of listings) {
    if (!sourceIds.has(listing.sourceId)) throw new FixtureError(`${listing.id}: 未定義のソース ${listing.sourceId}`);
  }

  const clusterMap = new Map<string, string[]>();
  for (const listing of listings) {
    const list = clusterMap.get(listing.clusterId) ?? [];
    list.push(listing.id);
    clusterMap.set(listing.clusterId, list);
  }
  const clusters: JobCluster[] = [...clusterMap].map(([id, listingIds]) => {
    if (!ids.has(id)) throw new FixtureError(`clusterId ${id} に対応する主listingがありません`);
    const ordered = [id, ...listingIds.filter((l) => l !== id)];
    return { id, primaryListingId: id, listingIds: ordered };
  });

  const campaigns = parseAll(campaignSchema, (campaignsDemo as { campaigns: unknown[] }).campaigns, 'campaigns.demo.json');
  for (const campaign of campaigns) {
    if (!clusterMap.has(campaign.jobId)) throw new FixtureError(`${campaign.id}: 対象求人 ${campaign.jobId} がありません`);
  }

  return { listings, clusters, sources, campaigns };
}
