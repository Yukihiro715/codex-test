// Design contract, not a finished application. Add runtime validation in implementation.
export type RiskLane = 'OPEN_REUSE' | 'PUBLIC_FACT_INDEX' | 'DISPUTED_SCOPE' | 'EXCLUDED';
export type DisplayMode = 'none' | 'link_only' | 'facts_link' | 'full_authorized';
export type ListingState = 'discovered' | 'fetched' | 'parsed' | 'review_required' | 'eligible' | 'published' | 'stale' | 'expired' | 'suppressed';
export type SalaryUnit = 'HOUR' | 'DAY' | 'MONTH' | 'YEAR' | 'UNKNOWN';
export type TriState = 'yes' | 'no' | 'unknown';
export type ApplicationRoute = 'employer' | 'agency' | 'hellowork' | 'jobboard' | 'unknown';
export interface FieldEvidence {
  id: string; sourceListingId: string; field: string; fetchedAt: string;
  pageHash: string; method: 'jsonld' | 'rule' | 'llm' | 'human';
  locator: string | null; excerpt: string | null;
  reviewed: boolean; retentionUntil: string | null;
}
export interface SourcePolicy {
  id: string; version: number; lane: RiskLane;
  hosts: string[]; allowedPaths: string[];
  reviewStatus: 'unreviewed' | 'sample_only' | 'approved' | 'rejected';
  reviewId: string | null; reviewExpiresAt: string | null;
  fetchEnabled: boolean; publicEnabled: boolean; displayMode: DisplayMode;
  storageMode: 'none' | 'facts_only' | 'ephemeral_raw' | 'licensed_raw';
  publicFields: string[]; imageAllowed: boolean;
  seoIndexAllowed: boolean; jobPostingAllowed: boolean;
  commercialPromotionAllowed: boolean;
  maxRequestsPerHostPerDay: number; maxConcurrencyPerHost: number;
  minRequestIntervalMs: number; maxResponseBytes: number;
  rawRetentionHours: number; staleHideAfterHours: number;
}
export interface Salary {
  currency: 'JPY'; min: number | null; max: number | null;
  unit: SalaryUnit; basis: 'base' | 'gross' | 'example' | 'unknown';
  fixedOvertimeIncluded: TriState; fixedOvertimeHours: number | null;
  fixedOvertimeAmount: number | null; evidenceIds: string[];
}
export interface JobLocation {
  country: 'JP'; prefectureCode: string | null; city: string | null;
  displayAddress: string; remoteMode: 'onsite' | 'hybrid' | 'remote' | 'unknown';
}
export interface SourceListing {
  id: string; sourceScopeId: string; sourceJobId: string;
  canonicalUrl: string; employerId: string; title: string;
  occupation: string; locations: JobLocation[]; employmentTypes: string[];
  salary: Salary; facts: Record<string, string | number | string[] | null>;
  evidenceIds: string[]; state: ListingState;
  sourcePostedAt: string | null; firstSeenAt: string; lastFetchedAt: string;
  lastChangedAt: string; validThrough: string | null; contentHash: string;
  applicationRoute: ApplicationRoute; demo: boolean;
}
// The public API must use this explicit projection, never serialize SourceListing/raw HTML directly.
export interface PublicJob {
  id: string; primaryListingId: string; title: string; employerName: string;
  occupation: string; locations: JobLocation[]; employmentTypes: string[];
  salary: Salary; facts: Record<string, string | number | string[] | null>;
  displayMode: DisplayMode; sourceName: string; sourceUrl: string;
  lastFetchedAt: string; sourcePostedAt: string | null;
  applicationRoute: ApplicationRoute; state: 'published' | 'stale';
  authorizedDescription: string | null; demo: boolean;
}
export interface OutboundRequest {
  jobId: string; primaryListingId: string;
  impressionToken: string | null; idempotencyKey: string;
  placement: 'search' | 'detail' | 'compare';
}
export interface ClickDecision {
  eventId: string; billable: boolean; cpcJpy: number;
  reason: 'valid' | 'free' | 'duplicate' | 'no_contract' | 'budget_exhausted' | 'inactive' | 'bot' | 'test';
  destination: string;
}
export interface SourceAdapter {
  discover(scope: SourcePolicy): AsyncIterable<string>;
  parse(html: string, sourceUrl: string): Promise<Partial<SourceListing>[]>;
}
// Implementation must put fetch authorization, SSRF checks, robots and host throttling
// in a common fetch layer, outside individual adapters.