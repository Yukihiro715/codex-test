/**
 * WORKLENS ドメイン型。
 * contracts/domain.ts（設計契約）を正本とし、実装に必要な項目を追加している。
 * 契約との互換性は contract-compat.ts で型検査する。
 */

export type RiskLane = 'OPEN_REUSE' | 'PUBLIC_FACT_INDEX' | 'DISPUTED_SCOPE' | 'EXCLUDED';
export type DisplayMode = 'none' | 'link_only' | 'facts_link' | 'full_authorized';
export type ListingState =
  | 'discovered'
  | 'fetched'
  | 'parsed'
  | 'review_required'
  | 'eligible'
  | 'published'
  | 'stale'
  | 'expired'
  | 'suppressed';
export type SalaryUnit = 'HOUR' | 'DAY' | 'MONTH' | 'YEAR' | 'UNKNOWN';
/** 給与フィルターで選べる単位（UNKNOWNは選択肢にしない） */
export type KnownSalaryUnit = Exclude<SalaryUnit, 'UNKNOWN'>;
export type TriState = 'yes' | 'no' | 'unknown';
export type ApplicationRoute = 'employer' | 'agency' | 'hellowork' | 'jobboard' | 'unknown';
export type SalaryBasis = 'base' | 'gross' | 'example' | 'unknown';
export type RemoteMode = 'onsite' | 'hybrid' | 'remote' | 'unknown';
export type EmploymentType = 'fulltime' | 'contract' | 'parttime' | 'dispatch' | 'freelance' | 'other';
export type ReviewStatus = 'unreviewed' | 'sample_only' | 'approved' | 'rejected';
export type StorageMode = 'none' | 'facts_only' | 'ephemeral_raw' | 'licensed_raw';
/** robotsの確認結果。不明（unverified/unreachable）を許可として扱わない。 */
export type RobotsStatus = 'unverified' | 'allow' | 'disallow' | 'unreachable' | 'not_applicable';

export interface Salary {
  currency: 'JPY';
  /** JPY整数。不明はnull（0にしない） */
  min: number | null;
  max: number | null;
  unit: SalaryUnit;
  basis: SalaryBasis;
  fixedOvertimeIncluded: TriState;
  fixedOvertimeHours: number | null;
  fixedOvertimeAmount: number | null;
  evidenceIds: string[];
}

export interface JobLocation {
  country: 'JP';
  prefectureCode: string | null;
  city: string | null;
  displayAddress: string;
  remoteMode: RemoteMode;
}

/** 表示用の事実条件（職種別の比較項目名 → 原文の記載）。null = 原文に記載なし */
export type FactValue = string | number | string[] | null;
export type FactMap = Record<string, FactValue>;

/** 絞り込み用に正規化したコード。null = 記載なし（不明）。不明はどの条件にも適合させない。 */
export type FacetValues = string[] | null;
export type FacetMap = Record<string, FacetValues>;

export interface SourcePolicy {
  id: string;
  version: number;
  lane: RiskLane;
  hosts: string[];
  allowedPaths: string[];
  reviewStatus: ReviewStatus;
  reviewId: string | null;
  reviewExpiresAt: string | null;
  fetchEnabled: boolean;
  publicEnabled: boolean;
  displayMode: DisplayMode;
  storageMode: StorageMode;
  publicFields: string[];
  imageAllowed: boolean;
  seoIndexAllowed: boolean;
  jobPostingAllowed: boolean;
  commercialPromotionAllowed: boolean;
  maxRequestsPerHostPerDay: number;
  maxConcurrencyPerHost: number;
  minRequestIntervalMs: number;
  maxResponseBytes: number;
  rawRetentionHours: number;
  staleHideAfterHours: number;
}

/** 管理画面向けのソース情報（ポリシー＋審査メタデータ） */
export interface SourceRecord extends SourcePolicy {
  /** 管理用の名称 */
  name: string;
  /** 求職者に表示する掲載元名 */
  publicName: string;
  /** demo = 架空fixture用 / candidate = 実ソース候補（未審査のままでは有効化不可） */
  kind: 'demo' | 'candidate';
  termsUrl: string | null;
  termsCheckedAt: string | null;
  robotsStatus: RobotsStatus;
  activationNote: string;
}

export interface SourceListing {
  id: string;
  sourceId: string;
  sourceScopeId: string;
  sourceJobId: string;
  canonicalUrl: string;
  employerId: string;
  employerName: string;
  title: string;
  occupation: string;
  locations: JobLocation[];
  employmentTypes: EmploymentType[];
  salary: Salary;
  facts: FactMap;
  facets: FacetMap;
  /** 共通比較項目：勤務時間（原文の記載）。null = 記載なし */
  workingHours: string | null;
  /** 共通比較項目：必要資格・免許（原文の記載）。null = 記載なし */
  requiredQualification: string | null;
  evidenceIds: string[];
  state: ListingState;
  sourcePostedAt: string | null;
  firstSeenAt: string;
  lastFetchedAt: string;
  lastChangedAt: string;
  validThrough: string | null;
  contentHash: string;
  applicationRoute: ApplicationRoute;
  /** このlistingに認められた表示方式（sourceのdisplayModeを上限として扱う） */
  displayGrant: DisplayMode;
  /** full_authorized の場合だけ公開できる本文。facts_link では公開projectionに含めない */
  authorizedDescription: string | null;
  /** 横断的な同一募集の束（JobCluster）ID */
  clusterId: string;
  demo: boolean;
}

export interface JobCluster {
  id: string;
  primaryListingId: string;
  listingIds: string[];
}

/**
 * 公開API・画面で使う明示的なprojection。SourceListingやraw HTMLをそのまま返さない。
 */
export interface PublicJob {
  id: string;
  primaryListingId: string;
  title: string;
  employerName: string;
  occupation: string;
  locations: JobLocation[];
  employmentTypes: EmploymentType[];
  salary: Salary;
  facts: FactMap;
  facets: FacetMap;
  workingHours: string | null;
  requiredQualification: string | null;
  displayMode: DisplayMode;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  lastFetchedAt: string;
  sourcePostedAt: string | null;
  firstSeenAt: string;
  validThrough: string | null;
  applicationRoute: ApplicationRoute;
  state: 'published' | 'stale';
  /** 最終確認から時間が経っている、または再確認できていない（注意表示） */
  staleWarning: boolean;
  authorizedDescription: string | null;
  /** 同じ募集の他の掲載元の数（主表示のlistingを除く） */
  otherListingCount: number;
  demo: boolean;
}

/** 検索一覧で使う要約（本文は含めない） */
export type PublicJobSummary = Omit<PublicJob, 'authorizedDescription'>;

/** 同一募集の他の掲載元。給与は各掲載元の記載をそのまま出し、よい条件を合成しない。 */
export interface OtherListing {
  listingId: string;
  sourceName: string;
  applicationRoute: ApplicationRoute;
  salary: Salary;
  lastFetchedAt: string;
  staleWarning: boolean;
}

export interface JobDetail {
  job: PublicJob;
  otherListings: OtherListing[];
}

/**
 * 求人の可視性。非公開と存在しないIDは同じ応答にして、削除依頼の有無を推測させない。
 */
export type JobAvailability =
  | { status: 'public'; detail: JobDetail }
  | { status: 'expired'; id: string; title: string; employerName: string }
  | { status: 'unavailable'; id: string };

/** 一覧・保存・比較向けの軽量な可視性 */
export type JobLookupItem =
  | { status: 'public'; job: PublicJobSummary }
  | { status: 'expired'; id: string; title: string; employerName: string }
  | { status: 'unavailable'; id: string };

export interface Campaign {
  id: string;
  jobId: string;
  status: 'active' | 'paused' | 'ended';
  authorityVerified: boolean;
  agreementVerified: boolean;
  /** 契約データ上のCPC。clientから受け取った金額は使わない */
  cpcJpy: number;
  budgetRemainingJpy: number;
  startsAt: string;
  endsAt: string;
  /** sandbox（デモ）契約。実請求はしない */
  sandbox: boolean;
}

export interface PromotedJob {
  campaignId: string;
  job: PublicJobSummary;
}

export type OutboundPlacement = 'search' | 'detail' | 'compare' | 'saved' | 'pr' | 'other_listing';

export interface ClickDecision {
  eventId: string;
  billable: boolean;
  cpcJpy: number;
  reason: 'valid' | 'free' | 'duplicate' | 'no_contract' | 'budget_exhausted' | 'inactive' | 'bot' | 'test';
  destination: string;
}
