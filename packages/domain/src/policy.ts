import { z } from 'zod';
import type { DisplayMode, JobCluster, OtherListing, PublicJob, SourceListing, SourceRecord } from './types';
import { hoursBetween, STALE_WARNING_AFTER_HOURS } from './time';

const DISPLAY_ORDER: Record<DisplayMode, number> = { none: 0, link_only: 1, facts_link: 2, full_authorized: 3 };

/** 2つの表示方式のうち弱い方（権限は常に狭い側に合わせる） */
export function minDisplayMode(a: DisplayMode, b: DisplayMode): DisplayMode {
  return DISPLAY_ORDER[a] <= DISPLAY_ORDER[b] ? a : b;
}

export function displayModeAtMost(mode: DisplayMode, cap: DisplayMode): boolean {
  return DISPLAY_ORDER[mode] <= DISPLAY_ORDER[cap];
}

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  none: '非表示',
  link_only: 'リンクのみ',
  facts_link: '条件概要＋元ページリンク',
  full_authorized: '許諾範囲の本文表示',
};

export interface ActivationEnv {
  now: Date;
  /** ENABLE_LIVE_CRAWL。falseの間は実ソースのライブ収集を有効化できない */
  liveCrawlEnabled: boolean;
}

/**
 * 公開表示を有効化できない理由（REL02）。空配列なら有効化できる。
 * 審査記録・robots確認・規約確認がないソースは、管理画面から操作しても有効化しない。
 */
export function publicActivationBlockers(source: SourceRecord, env: ActivationEnv): string[] {
  const reasons: string[] = [];
  if (source.lane === 'EXCLUDED') reasons.push('除外レーンのソースは有効化できません');
  if (source.reviewStatus !== 'approved') reasons.push('ソース審査が承認されていません（reviewStatus≠approved）');
  if (!source.reviewId) reasons.push('審査記録ID（reviewId）がありません');
  if (source.reviewExpiresAt && new Date(source.reviewExpiresAt).getTime() < env.now.getTime()) {
    reasons.push('審査の有効期限が切れています');
  }
  if (source.robotsStatus !== 'allow' && source.robotsStatus !== 'not_applicable') {
    reasons.push('robotsの確認結果が「許可」ではありません（不明は許可として扱いません）');
  }
  if (source.kind === 'candidate' && !source.termsCheckedAt) reasons.push('利用規約の確認記録がありません');
  if (source.displayMode === 'none') reasons.push('審査で認められた表示方式がありません（displayMode=none）');
  return reasons;
}

/** 収集（fetch）を有効化できない理由。M0では実ソースのライブ収集は常に不可。 */
export function fetchActivationBlockers(source: SourceRecord, env: ActivationEnv): string[] {
  const reasons = publicActivationBlockers(source, env).filter((r) => !r.includes('表示方式'));
  if (source.kind === 'candidate' && !env.liveCrawlEnabled) {
    reasons.push('ENABLE_LIVE_CRAWL=false のため、実ソースのライブ収集は有効化できません');
  }
  return reasons;
}

/** 管理画面デモで保持する上書き。停止は常に可能、有効化は審査条件を満たす場合だけ反映する。 */
export const sourceOverrideSchema = z.object({
  publicEnabled: z.boolean().optional(),
  fetchEnabled: z.boolean().optional(),
  displayMode: z.enum(['none', 'link_only', 'facts_link', 'full_authorized']).optional(),
});
export type SourceOverride = z.infer<typeof sourceOverrideSchema>;
export const sourceOverridesSchema = z.record(z.string().regex(/^[a-z0-9_-]{1,64}$/), sourceOverrideSchema);
export type SourceOverrides = z.infer<typeof sourceOverridesSchema>;

/**
 * 審査済みポリシーに上書きを適用した「有効なポリシー」を返す。
 * - 停止（false）はいつでも反映
 * - 有効化（true）は publicActivationBlockers / fetchActivationBlockers が空の場合だけ
 * - 表示方式は審査済みの上限より広げない
 */
export function effectiveSource(base: SourceRecord, override: SourceOverride | undefined, env: ActivationEnv): SourceRecord {
  if (!override) return base;
  const next: SourceRecord = { ...base };
  if (override.publicEnabled === false) next.publicEnabled = false;
  if (override.publicEnabled === true && publicActivationBlockers(base, env).length === 0) next.publicEnabled = true;
  if (override.fetchEnabled === false) next.fetchEnabled = false;
  if (override.fetchEnabled === true && fetchActivationBlockers(base, env).length === 0) next.fetchEnabled = true;
  if (override.displayMode && displayModeAtMost(override.displayMode, base.displayMode)) {
    next.displayMode = override.displayMode;
  }
  if (next.publicEnabled !== base.publicEnabled || next.displayMode !== base.displayMode || next.fetchEnabled !== base.fetchEnabled) {
    next.version = base.version + 1;
  }
  return next;
}

/** 外部遷移先として使えるURLか（http/https・認証情報なし）。javascript: などは拒否する。 */
export function isSafeExternalUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  return url.hostname.length > 0;
}

export type HiddenReason = 'suppressed' | 'source_disabled' | 'display_none' | 'not_published' | 'stale_expired' | 'invalid';

export type ListingVisibility =
  | { kind: 'public'; state: 'published' | 'stale'; displayMode: DisplayMode; staleWarning: boolean }
  | { kind: 'expired' }
  | { kind: 'hidden'; reason: HiddenReason };

/**
 * 1件のlistingを公開できるかを判定する。ソースがactiveでも個別求人の公開は独立に判定する。
 * 削除依頼・ソース停止・表示権限なし・7日超の確認不能は、内容を一切出さない。
 */
export function listingVisibility(listing: SourceListing, source: SourceRecord | undefined, now: Date): ListingVisibility {
  if (listing.state === 'suppressed') return { kind: 'hidden', reason: 'suppressed' };
  if (!source || !source.publicEnabled) return { kind: 'hidden', reason: 'source_disabled' };
  const displayMode = minDisplayMode(source.displayMode, listing.displayGrant);
  // link_only は主力在庫として検索・比較に出さない（M0では非表示扱い）
  if (displayMode === 'none' || displayMode === 'link_only') return { kind: 'hidden', reason: 'display_none' };
  if (!listing.title.trim() || !listing.employerName.trim() || !isSafeExternalUrl(listing.canonicalUrl)) {
    return { kind: 'hidden', reason: 'invalid' };
  }
  if (listing.state === 'expired') return { kind: 'expired' };
  if (listing.validThrough && new Date(listing.validThrough).getTime() < now.getTime()) return { kind: 'expired' };
  if (listing.state !== 'published' && listing.state !== 'stale') return { kind: 'hidden', reason: 'not_published' };
  const age = hoursBetween(listing.lastFetchedAt, now);
  if (age > source.staleHideAfterHours) return { kind: 'hidden', reason: 'stale_expired' };
  return {
    kind: 'public',
    state: listing.state,
    displayMode,
    staleWarning: listing.state === 'stale' || age > STALE_WARNING_AFTER_HOURS,
  };
}

function allowed(source: SourceRecord, field: string): boolean {
  return source.publicFields.includes(field);
}

/** 公開を許可されていない給与は「記載なし」と同じ形にする（値を推測・保持しない） */
export function unknownSalary(): PublicJob['salary'] {
  return {
    currency: 'JPY',
    min: null,
    max: null,
    unit: 'UNKNOWN',
    basis: 'unknown',
    fixedOvertimeIncluded: 'unknown',
    fixedOvertimeHours: null,
    fixedOvertimeAmount: null,
    evidenceIds: [],
  };
}

/**
 * 公開projection。許可されたフィールドだけを明示的に写し、本文は full_authorized の場合だけ含める。
 * （SourceListingや原文HTMLをそのままシリアライズしない）
 */
export function toPublicJob(
  cluster: JobCluster,
  listing: SourceListing,
  source: SourceRecord,
  visibility: Extract<ListingVisibility, { kind: 'public' }>,
  otherListingCount: number,
): PublicJob {
  const showFacts = allowed(source, 'facts');
  return {
    id: cluster.id,
    primaryListingId: listing.id,
    title: listing.title,
    employerName: listing.employerName,
    occupation: listing.occupation,
    locations: allowed(source, 'locations') ? listing.locations.map((l) => ({ ...l })) : [],
    employmentTypes: allowed(source, 'employmentTypes') ? [...listing.employmentTypes] : [],
    salary: allowed(source, 'salary') ? { ...listing.salary, evidenceIds: [...listing.salary.evidenceIds] } : unknownSalary(),
    facts: showFacts ? { ...listing.facts } : {},
    facets: showFacts ? { ...listing.facets } : Object.fromEntries(Object.keys(listing.facets).map((k) => [k, null])),
    workingHours: showFacts ? listing.workingHours : null,
    requiredQualification: showFacts ? listing.requiredQualification : null,
    displayMode: visibility.displayMode,
    sourceId: source.id,
    sourceName: source.publicName,
    sourceUrl: listing.canonicalUrl,
    lastFetchedAt: listing.lastFetchedAt,
    sourcePostedAt: listing.sourcePostedAt,
    firstSeenAt: listing.firstSeenAt,
    validThrough: listing.validThrough,
    applicationRoute: listing.applicationRoute,
    state: visibility.state,
    staleWarning: visibility.staleWarning,
    authorizedDescription: visibility.displayMode === 'full_authorized' ? listing.authorizedDescription : null,
    otherListingCount,
    demo: listing.demo,
  };
}

export function toOtherListing(
  listing: SourceListing,
  source: SourceRecord,
  visibility: Extract<ListingVisibility, { kind: 'public' }>,
): OtherListing {
  return {
    listingId: listing.id,
    sourceName: source.publicName,
    applicationRoute: listing.applicationRoute,
    salary: allowed(source, 'salary') ? { ...listing.salary, evidenceIds: [] } : unknownSalary(),
    lastFetchedAt: listing.lastFetchedAt,
    staleWarning: visibility.staleWarning,
  };
}
