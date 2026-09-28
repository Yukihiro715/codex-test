import type { EmploymentType, PublicJob, SourceRecord } from './types';

export interface SeoEnv {
  /** デモ・ステージングは常に noindex */
  demo: boolean;
  /** ENABLE_JOBPOSTING */
  enableJobPosting: boolean;
  now: Date;
}

export interface RobotsDecision {
  index: boolean;
  follow: boolean;
}

/**
 * 求人詳細のrobots。facts_link は初期 noindex（SEO01）。
 * full_authorized でも、ソースで検索エンジン掲載が認められた場合だけ index。
 */
export function jobDetailRobots(job: Pick<PublicJob, 'displayMode' | 'state' | 'staleWarning'>, source: Pick<SourceRecord, 'seoIndexAllowed'>, env: Pick<SeoEnv, 'demo'>): RobotsDecision {
  if (env.demo) return { index: false, follow: false };
  if (job.displayMode !== 'full_authorized') return { index: false, follow: true };
  if (!source.seoIndexAllowed) return { index: false, follow: true };
  if (job.state !== 'published' || job.staleWarning) return { index: false, follow: true };
  return { index: true, follow: true };
}

const EMPLOYMENT_TO_SCHEMA: Record<EmploymentType, string | null> = {
  fulltime: 'FULL_TIME',
  contract: 'TEMPORARY',
  parttime: 'PART_TIME',
  dispatch: 'TEMPORARY',
  freelance: 'CONTRACTOR',
  other: null,
};

/**
 * JobPosting構造化データ（SEO02）。次をすべて満たす1求人の詳細ページだけに出す。
 * - ENABLE_JOBPOSTING=true、デモではない
 * - full_authorized かつ ソースの jobPostingAllowed
 * - 公開中（staleでない）、期限切れでない、必須項目（説明・掲載日・勤務地・企業名）が揃っている
 * baseSalary は雇用主向けの指定条件を確認するまで出力しない（第三者集約の初期出力から除外）。
 */
export function buildJobPostingJsonLd(job: PublicJob, source: Pick<SourceRecord, 'jobPostingAllowed'>, env: SeoEnv): Record<string, unknown> | null {
  if (env.demo || job.demo || !env.enableJobPosting) return null;
  if (job.displayMode !== 'full_authorized' || !source.jobPostingAllowed) return null;
  if (job.state !== 'published' || job.staleWarning) return null;
  if (!job.authorizedDescription || !job.sourcePostedAt) return null;
  if (job.validThrough && new Date(job.validThrough).getTime() < env.now.getTime()) return null;
  const location = job.locations[0];
  if (!location || !location.prefectureCode) return null;
  const employmentType = [...new Set(job.employmentTypes.map((e) => EMPLOYMENT_TO_SCHEMA[e]).filter((v): v is string => v !== null))];
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.authorizedDescription,
    datePosted: job.sourcePostedAt,
    ...(job.validThrough ? { validThrough: job.validThrough } : {}),
    ...(employmentType.length > 0 ? { employmentType } : {}),
    hiringOrganization: { '@type': 'Organization', name: job.employerName },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'JP',
        addressRegion: location.displayAddress,
        ...(location.city ? { addressLocality: location.city } : {}),
      },
    },
    directApply: false,
  };
}

/** 職種ハブ等の一覧ページをindexしてよいか（SEO04：空・薄いページはindexしない） */
export function isHubIndexable(visibleJobCount: number, env: Pick<SeoEnv, 'demo'>, minimumInventory = 10): boolean {
  if (env.demo) return false;
  return visibleJobCount >= minimumInventory;
}

/** JSON-LDを<script>に埋め込むための安全なシリアライズ */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
