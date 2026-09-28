import type {
  ApplicationRoute,
  JobAvailability,
  JobLookupItem,
  PromotedJob,
  PublicJobSummary,
  QueryIssue,
  SearchOutcome,
  SearchQuery,
  SourceOverrides,
  SourceRecord,
} from '@worklens/domain';

/** 1リクエストの判定に使う状態。時刻とソース停止状態は呼び出し側から渡す（テスト可能にするため）。 */
export interface RepositoryContext {
  now: Date;
  /** 管理画面デモでの停止・有効化（有効化は審査条件を満たす場合だけ反映） */
  sourceOverrides: SourceOverrides;
  /** ENABLE_LIVE_CRAWL */
  liveCrawlEnabled: boolean;
}

export interface SearchResponse extends SearchOutcome {
  query: SearchQuery;
  /** 正規形のクエリ文字列（先頭の ? なし） */
  queryString: string;
  issues: QueryIssue[];
  /** PR枠（自然検索の並びとは独立。条件に合う求人だけ） */
  promotions: PromotedJob[];
  /** 掲載元の絞り込み候補（公開中のソース） */
  sources: { id: string; name: string }[];
}

export interface OccupationSummary {
  slug: string;
  label: string;
  description: string;
  specializedUi: boolean;
  visibleCount: number;
}

export interface HomeSummary {
  occupations: OccupationSummary[];
  recentJobs: PublicJobSummary[];
  totalVisible: number;
}

export interface OccupationHub {
  visibleCount: number;
  sampleJobs: PublicJobSummary[];
}

export interface OutboundDestination {
  jobId: string;
  listingId: string;
  url: string;
  applicationRoute: ApplicationRoute;
  title: string;
  sourceName: string;
}

export interface AdminSourceRow {
  /** 上書き適用後の有効なポリシー */
  source: SourceRecord;
  /** 審査で登録されたポリシー */
  base: SourceRecord;
  overridden: boolean;
  publicJobCount: number;
  staleWarningCount: number;
  hiddenStaleCount: number;
  expiredCount: number;
  suppressedCount: number;
  totalListings: number;
  publicBlockers: string[];
  fetchBlockers: string[];
}

/**
 * 求人データの取得口。M0はfixture実装、M1でPostgreSQL＋検索エンジン実装に差し替える。
 * 返す値はすべて公開projection（SourceListingや原文をそのまま返さない）。
 */
export interface JobRepository {
  search(query: SearchQuery, ctx: RepositoryContext): Promise<SearchResponse>;
  getJob(id: string, ctx: RepositoryContext): Promise<JobAvailability>;
  lookup(ids: readonly string[], ctx: RepositoryContext): Promise<JobLookupItem[]>;
  getOutboundDestination(listingId: string, ctx: RepositoryContext): Promise<OutboundDestination | null>;
  home(ctx: RepositoryContext): Promise<HomeSummary>;
  occupationHub(slug: string, ctx: RepositoryContext): Promise<OccupationHub>;
  listSources(ctx: RepositoryContext): Promise<AdminSourceRow[]>;
  getSource(id: string, ctx: RepositoryContext): Promise<AdminSourceRow | null>;
  /** 既知のソースID（URL検証用） */
  sourceIds(): ReadonlySet<string>;
  sourceName(id: string): string;
  /** 読み込んだ demo=true レコード数（REL01の検査用） */
  demoRecordCount(): number;
}
