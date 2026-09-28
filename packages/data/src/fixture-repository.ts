import {
  OCCUPATIONS,
  PAGE_SIZE,
  campaignIneligibility,
  effectiveSource,
  fetchActivationBlockers,
  listingVisibility,
  publicActivationBlockers,
  searchJobs,
  serializeQuery,
  toOtherListing,
  toPublicJob,
  type JobAvailability,
  type JobCluster,
  type JobLookupItem,
  type ListingVisibility,
  type PromotedJob,
  type PublicJob,
  type PublicJobSummary,
  type SearchQuery,
  type SourceListing,
  type SourceRecord,
} from '@worklens/domain';
import type { FixtureData } from './fixtures';
import type {
  AdminSourceRow,
  HomeSummary,
  JobRepository,
  OccupationHub,
  OutboundDestination,
  RepositoryContext,
  SearchResponse,
} from './repository';

type PublicVisibility = Extract<ListingVisibility, { kind: 'public' }>;

interface Snapshot {
  sources: Map<string, SourceRecord>;
  /** クラスタID → 公開projection（主表示のlistingは公開可能なもののうち優先順位が最も高いもの） */
  jobs: Map<string, PublicJob>;
  visibility: Map<string, ListingVisibility>;
}

function summary(job: PublicJob): PublicJobSummary {
  const { authorizedDescription: _omit, ...rest } = job;
  return rest;
}

export const MAX_LOOKUP_IDS = 50;

/**
 * fixtureのインメモリ実装。リクエストごとに有効なソースポリシーを適用し、
 * 公開可能なlistingだけからprojectionを作る（停止したソースの求人は検索・詳細・比較・送客のどこにも出さない）。
 */
export class FixtureJobRepository implements JobRepository {
  private readonly listingsById: Map<string, SourceListing>;
  private readonly clustersById: Map<string, JobCluster>;
  private readonly baseSources: Map<string, SourceRecord>;

  constructor(private readonly data: FixtureData) {
    this.listingsById = new Map(data.listings.map((l) => [l.id, l]));
    this.clustersById = new Map(data.clusters.map((c) => [c.id, c]));
    this.baseSources = new Map(data.sources.map((s) => [s.id, s]));
  }

  private effectiveSources(ctx: RepositoryContext): Map<string, SourceRecord> {
    const env = { now: ctx.now, liveCrawlEnabled: ctx.liveCrawlEnabled };
    return new Map([...this.baseSources].map(([id, source]) => [id, effectiveSource(source, ctx.sourceOverrides[id], env)]));
  }

  private snapshot(ctx: RepositoryContext): Snapshot {
    const sources = this.effectiveSources(ctx);
    const visibility = new Map<string, ListingVisibility>();
    for (const listing of this.data.listings) {
      visibility.set(listing.id, listingVisibility(listing, sources.get(listing.sourceId), ctx.now));
    }
    const jobs = new Map<string, PublicJob>();
    for (const cluster of this.data.clusters) {
      const visible = cluster.listingIds.filter((id) => visibility.get(id)?.kind === 'public');
      const primaryId = visible[0];
      if (!primaryId) continue;
      const listing = this.listingsById.get(primaryId);
      const source = listing ? sources.get(listing.sourceId) : undefined;
      if (!listing || !source) continue;
      jobs.set(cluster.id, toPublicJob(cluster, listing, source, visibility.get(primaryId) as PublicVisibility, visible.length - 1));
    }
    return { sources, jobs, visibility };
  }

  async search(query: SearchQuery, ctx: RepositoryContext): Promise<SearchResponse> {
    const snap = this.snapshot(ctx);
    const all = [...snap.jobs.values()].map(summary);
    const outcome = searchJobs(all, query, { now: ctx.now, pageSize: PAGE_SIZE, sourceName: (id) => this.sourceName(id) });
    const effectiveQuery = { ...query, page: outcome.page };

    const promotions: PromotedJob[] = [];
    if (outcome.page === 1) {
      for (const campaign of this.data.campaigns) {
        const job = snap.jobs.get(campaign.jobId);
        if (!job) continue;
        if (campaignIneligibility(campaign, snap.sources.get(job.sourceId), ctx.now) !== null) continue;
        // 広告でも検索条件に合わない求人は出さない
        if (searchJobs([summary(job)], { ...query, page: 1 }, { now: ctx.now }).total !== 1) continue;
        promotions.push({ campaignId: campaign.id, job: summary(job) });
        break;
      }
    }

    const sourceCounts = new Map<string, number>();
    for (const job of snap.jobs.values()) sourceCounts.set(job.sourceId, (sourceCounts.get(job.sourceId) ?? 0) + 1);
    const sources = [...snap.sources.values()]
      .filter((s) => s.publicEnabled && (sourceCounts.get(s.id) ?? 0) > 0)
      .map((s) => ({ id: s.id, name: s.publicName }));

    return {
      ...outcome,
      query: effectiveQuery,
      queryString: serializeQuery(effectiveQuery),
      promotions,
      sources,
    };
  }

  private availability(id: string, snap: Snapshot): JobAvailability {
    const cluster = this.clustersById.get(id);
    if (!cluster) return { status: 'unavailable', id };
    const job = snap.jobs.get(id);
    if (job) {
      const otherListings = cluster.listingIds
        .filter((listingId) => listingId !== job.primaryListingId)
        .flatMap((listingId) => {
          const listing = this.listingsById.get(listingId);
          const visibility = snap.visibility.get(listingId);
          const source = listing ? snap.sources.get(listing.sourceId) : undefined;
          if (!listing || !source || visibility?.kind !== 'public') return [];
          return [toOtherListing(listing, source, visibility)];
        });
      return { status: 'public', detail: { job, otherListings } };
    }
    const expired = cluster.listingIds.map((l) => this.listingsById.get(l)).find((l) => l && snap.visibility.get(l.id)?.kind === 'expired');
    if (expired) return { status: 'expired', id, title: expired.title, employerName: expired.employerName };
    return { status: 'unavailable', id };
  }

  async getJob(id: string, ctx: RepositoryContext): Promise<JobAvailability> {
    return this.availability(id, this.snapshot(ctx));
  }

  async lookup(ids: readonly string[], ctx: RepositoryContext): Promise<JobLookupItem[]> {
    const snap = this.snapshot(ctx);
    return [...new Set(ids)].slice(0, MAX_LOOKUP_IDS).map((id): JobLookupItem => {
      const result = this.availability(id, snap);
      if (result.status === 'public') return { status: 'public', job: summary(result.detail.job) };
      return result;
    });
  }

  async getOutboundDestination(listingId: string, ctx: RepositoryContext): Promise<OutboundDestination | null> {
    const listing = this.listingsById.get(listingId);
    if (!listing) return null;
    const snap = this.snapshot(ctx);
    if (snap.visibility.get(listingId)?.kind !== 'public') return null;
    const source = snap.sources.get(listing.sourceId);
    if (!source) return null;
    return {
      jobId: listing.clusterId,
      listingId: listing.id,
      url: listing.canonicalUrl,
      applicationRoute: listing.applicationRoute,
      title: listing.title,
      sourceName: source.publicName,
    };
  }

  async home(ctx: RepositoryContext): Promise<HomeSummary> {
    const snap = this.snapshot(ctx);
    const jobs = [...snap.jobs.values()];
    const occupations = OCCUPATIONS.map((o) => ({
      slug: o.slug,
      label: o.label,
      description: o.description,
      specializedUi: o.specializedUi,
      visibleCount: jobs.filter((j) => j.occupation === o.slug).length,
    }));
    const recentJobs = jobs
      .filter((j) => !j.staleWarning)
      .sort((a, b) => b.lastFetchedAt.localeCompare(a.lastFetchedAt) || a.id.localeCompare(b.id))
      .slice(0, 4)
      .map(summary);
    return { occupations, recentJobs, totalVisible: jobs.length };
  }

  async occupationHub(slug: string, ctx: RepositoryContext): Promise<OccupationHub> {
    const snap = this.snapshot(ctx);
    const jobs = [...snap.jobs.values()].filter((j) => j.occupation === slug);
    const sampleJobs = jobs
      .filter((j) => !j.staleWarning)
      .sort((a, b) => b.lastFetchedAt.localeCompare(a.lastFetchedAt) || a.id.localeCompare(b.id))
      .slice(0, 3)
      .map(summary);
    return { visibleCount: jobs.length, sampleJobs };
  }

  private adminRow(base: SourceRecord, snap: Snapshot, ctx: RepositoryContext): AdminSourceRow {
    const source = snap.sources.get(base.id) ?? base;
    const listings = this.data.listings.filter((l) => l.sourceId === base.id);
    const count = (predicate: (v: ListingVisibility | undefined, l: SourceListing) => boolean) =>
      listings.filter((l) => predicate(snap.visibility.get(l.id), l)).length;
    const env = { now: ctx.now, liveCrawlEnabled: ctx.liveCrawlEnabled };
    return {
      source,
      base,
      overridden: ctx.sourceOverrides[base.id] !== undefined,
      publicJobCount: count((v) => v?.kind === 'public'),
      staleWarningCount: count((v) => v?.kind === 'public' && v.staleWarning),
      hiddenStaleCount: count((v) => v?.kind === 'hidden' && v.reason === 'stale_expired'),
      expiredCount: count((_, l) => l.state === 'expired'),
      suppressedCount: count((_, l) => l.state === 'suppressed'),
      totalListings: listings.length,
      publicBlockers: publicActivationBlockers(base, env),
      fetchBlockers: fetchActivationBlockers(base, env),
    };
  }

  async listSources(ctx: RepositoryContext): Promise<AdminSourceRow[]> {
    const snap = this.snapshot(ctx);
    return this.data.sources.map((s) => this.adminRow(s, snap, ctx));
  }

  async getSource(id: string, ctx: RepositoryContext): Promise<AdminSourceRow | null> {
    const base = this.baseSources.get(id);
    if (!base) return null;
    return this.adminRow(base, this.snapshot(ctx), ctx);
  }

  sourceIds(): ReadonlySet<string> {
    return new Set(this.baseSources.keys());
  }

  sourceName(id: string): string {
    return this.baseSources.get(id)?.publicName ?? id;
  }

  demoRecordCount(): number {
    return this.data.listings.filter((l) => l.demo).length;
  }
}
