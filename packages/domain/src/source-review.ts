import { z } from 'zod';
import type { ReviewStatus, RiskLane, SourceRecord, StorageMode } from './types';
import { displayModeAtMost } from './policy';

/**
 * ソース審査記録（SourceReview）。docs/02_DATA_ACQUISITION.md §5 の必須項目を1件の記録にまとめる。
 * 提携契約ではなく、公開前の内部判断の記録。記録があるだけでは何も有効にならず、
 * ソース設定（SourceRecord）は常に審査記録の範囲内でなければならない（reviewPolicyViolations）。
 * 運用は docs/08_SOURCE_REVIEWS.md。
 */

/** 収集時に名乗る User-Agent のトークン。robots.txt はこのトークン（なければ *）のグループで判定する */
export const CRAWLER_UA_TOKEN = 'KyujinMapBot';
/** 収集時の User-Agent。連絡先として収集方針ページを示す（他社botを名乗らない） */
export const CRAWLER_USER_AGENT = `${CRAWLER_UA_TOKEN}/0.1 (+https://kyujinmap.jp/sources)`;

/** レーンごとの審査の最長有効期間（日）。期限が来たら再審査する。除外レーンは承認しない */
export const REVIEW_MAX_VALID_DAYS: Record<RiskLane, number> = {
  OPEN_REUSE: 365,
  PUBLIC_FACT_INDEX: 180,
  DISPUTED_SCOPE: 90,
  EXCLUDED: 0,
};

/** 仕様上の自社上限（docs/02 §4.3）。審査でこれより緩い値は認めない */
export const CRAWL_LIMIT_CEILING = {
  maxRequestsPerDay: 100,
  maxConcurrency: 1,
  minIntervalMs: 10_000,
} as const;

export const REVIEW_DECISIONS = ['pending', 'sample_only', 'approved', 'rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** 審査の結論 → ソース設定の reviewStatus */
export const DECISION_TO_STATUS: Record<ReviewDecision, ReviewStatus> = {
  pending: 'unreviewed',
  sample_only: 'sample_only',
  approved: 'approved',
  rejected: 'rejected',
};

const STORAGE_ORDER: Record<StorageMode, number> = {
  none: 0,
  facts_only: 1,
  ephemeral_raw: 2,
  licensed_raw: 3,
};

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'sha256（16進64文字）で記録してください');
const hostname = z.string().regex(/^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, 'ホスト名（小文字・スキームなし）で記録してください');
const text = z.string().trim();

const permission = z.enum(['allowed', 'conditional', 'prohibited', 'silent', 'unclear']);

const sourceReviewObjectSchema = z.object({
  schemaVersion: z.literal(1),
  /** 審査記録ID。ソース設定の reviewId から参照する */
  id: z.string().regex(/^SR-\d{4}-\d{4}$/, 'SR-年-連番（例：SR-2026-0001）'),
  sourceId: z.string().regex(/^[a-z0-9_]+$/),
  /** 審査したソース設定の version。設定を変えたら再審査する */
  sourceVersion: z.number().int().positive(),
  title: text.min(1),
  lane: z.enum(['OPEN_REUSE', 'PUBLIC_FACT_INDEX', 'DISPUTED_SCOPE', 'EXCLUDED']),
  /** 取得範囲：実ホスト・パス・企業・取得方法・求人URLの見つけ方 */
  scope: z.object({
    hosts: z.array(hostname),
    paths: z.array(z.string().startsWith('/')),
    employer: text.nullable(),
    access: z.enum(['html_page', 'official_api', 'licensed_feed']),
    discovery: text,
  }),
  /** 利用規約：URL・確認日時・本文のハッシュ・適用・自動取得・再利用の扱い */
  terms: z.object({
    url: z.url().nullable(),
    checkedAt: isoDateTime.nullable(),
    contentSha256: sha256.nullable(),
    appliesToService: z.enum(['yes', 'no', 'unclear']),
    automatedAccess: permission,
    reuse: permission,
    conditions: z.array(text),
    notes: text,
  }),
  /** robots.txt：取得結果と、自社UAトークンでの判定 */
  robots: z.object({
    url: z.url().nullable(),
    fetchedAt: isoDateTime.nullable(),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    userAgentToken: text,
    matchedGroup: text.nullable(),
    result: z.enum(['allow', 'disallow', 'unknown', 'not_applicable']),
    matchedRules: z.array(text),
    contentSha256: sha256.nullable(),
  }),
  /** 利用根拠（なぜこの範囲で取得・表示してよいと判断したか） */
  basis: text,
  /** 問題点。open の blocker が残っていれば承認しない */
  issues: z.array(
    z.object({
      id: text.min(1),
      summary: text.min(1),
      severity: z.enum(['blocker', 'major', 'minor']),
      status: z.enum(['open', 'resolved', 'accepted']),
      resolution: text.nullable(),
    }),
  ),
  /** 取得してよい項目と、公開表示してよい項目（表示 ⊆ 取得） */
  fields: z.object({ acquire: z.array(text), display: z.array(text) }),
  /** 原文保持方針 */
  storage: z.object({
    mode: z.enum(['none', 'facts_only', 'ephemeral_raw', 'licensed_raw']),
    rawRetentionHours: z.number().int().min(0).max(72),
  }),
  /** 認める表示方式の上限 */
  displayMode: z.enum(['none', 'link_only', 'facts_link', 'full_authorized']),
  image: z.object({ allowed: z.boolean(), basis: text.nullable() }),
  /** 外部送客先（応募導線のホスト） */
  outbound: z.object({
    hosts: z.array(hostname),
    applicationRoute: z.enum(['employer', 'agency', 'hellowork', 'jobboard', 'unknown']),
  }),
  seo: z.object({ indexAllowed: z.boolean(), jobPostingAllowed: z.boolean() }),
  /** 広告（PR枠）での利用の可否 */
  promotion: z.object({ allowed: z.boolean(), basis: text.nullable() }),
  crawl: z.object({
    maxRequestsPerDay: z.number().int().min(1).max(CRAWL_LIMIT_CEILING.maxRequestsPerDay),
    maxConcurrency: z.number().int().min(1).max(CRAWL_LIMIT_CEILING.maxConcurrency),
    minIntervalMs: z.number().int().min(CRAWL_LIMIT_CEILING.minIntervalMs),
  }),
  /** 鮮度：再確認の周期と、確認できないときに検索から外すまでの時間（情報源の条件が厳しければそちらに合わせる） */
  freshness: z.object({
    recheckHours: z.number().int().min(1).max(72),
    staleHideAfterHours: z.number().int().min(1).max(168),
  }),
  /** 審査の責任者（役割名で記録してよい）と、責任者以外の確認者 */
  owner: text.min(1),
  reviewers: z.array(text.min(1)),
  legal: z.object({
    required: z.boolean(),
    status: z.enum(['not_requested', 'requested', 'done']),
    summary: text.nullable(),
  }),
  /** 起案者の推奨（結論ではない）。結論は owner が decision に記録する */
  proposal: text,
  decision: z.enum(REVIEW_DECISIONS),
  decidedAt: isoDateTime.nullable(),
  /** 再審査期限（JSTの日付。この日の終わりまで有効） */
  expiresAt: isoDate.nullable(),
  /** 確認時点の証跡（画面・本文の保存先とハッシュ）。公開しない社内記録 */
  evidence: z.array(
    z.object({
      label: text.min(1),
      url: z.url(),
      capturedAt: isoDateTime,
      sha256: sha256.nullable(),
    }),
  ),
  notes: text,
});

export type SourceReview = z.infer<typeof sourceReviewObjectSchema>;

/** 審査記録のスキーマ（型の検査に加え、reviewRecordProblems の整合性検査を行う） */
export const sourceReviewSchema = sourceReviewObjectSchema.superRefine((review, ctx) => {
  for (const message of reviewRecordProblems(review)) ctx.addIssue({ code: 'custom', message });
});

/** 再審査期限の終わり（JSTの日付の終わり＝翌日0時JST） */
export function reviewExpiresAtInstant(expiresAt: string): Date {
  return new Date(new Date(`${expiresAt}T00:00:00+09:00`).getTime() + 86_400_000);
}

/** 記録そのものの整合性（スキーマの型検査に加える判定）。空配列なら問題なし */
export function reviewRecordProblems(review: SourceReview): string[] {
  const problems: string[] = [];
  const acquire = new Set(review.fields.acquire);
  const extra = review.fields.display.filter((f) => !acquire.has(f));
  if (extra.length > 0) problems.push(`表示項目は取得項目の範囲内にしてください: ${extra.join(', ')}`);
  if (review.image.allowed && !review.image.basis) problems.push('画像を許可する場合は根拠（image.basis）が必要です');
  if (review.promotion.allowed && !review.promotion.basis) problems.push('広告利用を許可する場合は根拠（promotion.basis）が必要です');
  if (review.seo.jobPostingAllowed && (review.displayMode !== 'full_authorized' || !review.seo.indexAllowed)) {
    problems.push('JobPostingは本文表示の許諾（full_authorized）とindex許可がある場合だけ許可できます');
  }
  const reuseOk = review.terms.reuse === 'allowed' || review.terms.reuse === 'conditional';
  if (review.displayMode === 'full_authorized' && !reuseOk) problems.push('本文表示（full_authorized）には再利用の許諾（terms.reuse）が必要です');
  if (review.storage.mode === 'licensed_raw' && !reuseOk) problems.push('原文の保存（licensed_raw）には再利用の許諾が必要です');
  if (review.storage.mode !== 'ephemeral_raw' && review.storage.mode !== 'licensed_raw' && review.storage.rawRetentionHours > 0) {
    problems.push('原文を保存しない方式では rawRetentionHours を 0 にしてください');
  }
  if (review.lane === 'EXCLUDED' && review.decision !== 'rejected') problems.push('除外レーンは rejected 以外にできません');
  if (review.freshness.staleHideAfterHours < review.freshness.recheckHours) problems.push('検索から外すまでの時間は、再確認の周期より長くしてください');

  if (review.decision === 'approved' || review.decision === 'sample_only') {
    if (!review.decidedAt) problems.push('承認・サンプル取得には判断日時（decidedAt）が必要です');
    if (!review.expiresAt) problems.push('承認・サンプル取得には再審査期限（expiresAt）が必要です');
    if (review.decidedAt && review.expiresAt) {
      const days = (reviewExpiresAtInstant(review.expiresAt).getTime() - new Date(review.decidedAt).getTime()) / 86_400_000;
      if (days > REVIEW_MAX_VALID_DAYS[review.lane] + 1) {
        problems.push(`再審査期限が長すぎます（${review.lane} は最長${REVIEW_MAX_VALID_DAYS[review.lane]}日）`);
      }
    }
    if (review.scope.hosts.length === 0 || review.scope.paths.length === 0) problems.push('承認には実ホストとパスが必要です');
    if (!review.terms.checkedAt) problems.push('利用規約の確認日時（規約がないことの確認を含む）が必要です');
    if (review.terms.automatedAccess === 'prohibited') problems.push('自動取得を禁止しているソースは承認できません');
    const robotsOk = review.robots.result === 'allow' || (review.robots.result === 'not_applicable' && review.scope.access !== 'html_page');
    if (!robotsOk) problems.push('robotsの判定が「許可」ではありません（不明は許可として扱いません）');
    if (review.robots.result === 'allow' && review.robots.userAgentToken !== CRAWLER_UA_TOKEN) {
      problems.push(`robotsは自社のUAトークン（${CRAWLER_UA_TOKEN}）で判定してください`);
    }
    if (review.robots.result === 'allow' && !review.robots.fetchedAt) problems.push('robots.txt の取得日時が必要です');
    const openBlockers = review.issues.filter((i) => i.severity === 'blocker' && i.status === 'open');
    if (openBlockers.length > 0) problems.push(`未解決の blocker があります: ${openBlockers.map((i) => i.id).join(', ')}`);
    if (!review.reviewers.some((r) => r !== review.owner)) problems.push('責任者以外の確認者（reviewers）が1人以上必要です');
    if (review.lane === 'DISPUTED_SCOPE' && review.legal.status !== 'done') problems.push('範囲確認レーンは法務確認（legal.status=done）が必要です');
    if (review.legal.required && review.legal.status !== 'done') problems.push('法務確認が必要と判断した審査は、確認の完了が必要です');
  }
  if (review.decision === 'sample_only' && (review.displayMode !== 'none' || review.seo.indexAllowed || review.promotion.allowed)) {
    problems.push('サンプル取得（sample_only）では公開表示・index・広告利用を許可できません');
  }
  if (review.decision === 'approved' && review.displayMode === 'none') problems.push('承認するには表示方式を1つ以上認めてください');
  if (review.decision === 'rejected' && review.issues.length === 0 && !review.notes) problems.push('却下の理由（issues か notes）を記録してください');
  return problems;
}

function pathCovered(path: string, allowed: string[]): boolean {
  return allowed.some((prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
}

/**
 * ソース設定が審査記録の範囲を超えていないか。空配列なら範囲内。
 * 有効化（fetch/public）は、期限内の承認済み記録があり、設定がその範囲内の場合だけ認める。
 */
export function reviewPolicyViolations(source: SourceRecord, review: SourceReview | null, now: Date): string[] {
  const violations: string[] = [];
  if (!review) {
    if (source.reviewId) violations.push(`審査記録 ${source.reviewId} が見つかりません`);
    if (source.fetchEnabled || source.publicEnabled) violations.push('審査記録がないソースが有効になっています');
    if (source.reviewStatus !== 'unreviewed') violations.push('審査記録がないのに reviewStatus が unreviewed ではありません');
    return violations;
  }
  if (review.sourceId !== source.id) violations.push(`審査記録の対象（${review.sourceId}）がソース（${source.id}）と違います`);
  if (source.reviewId !== null && source.reviewId !== review.id) violations.push(`reviewId（${source.reviewId}）が審査記録 ${review.id} と違います`);
  if (review.sourceVersion !== source.version) violations.push(`設定の version ${source.version} は未審査です（審査は version ${review.sourceVersion}）`);
  if (source.reviewStatus !== DECISION_TO_STATUS[review.decision]) {
    violations.push(`reviewStatus（${source.reviewStatus}）が審査の結論（${review.decision}）と一致しません`);
  }
  if (source.reviewExpiresAt !== review.expiresAt) violations.push('reviewExpiresAt が審査記録の再審査期限と一致しません');
  if (source.lane !== review.lane) violations.push(`レーン（${source.lane}）が審査記録（${review.lane}）と違います`);

  const hosts = new Set(review.scope.hosts);
  const extraHosts = source.hosts.filter((h) => !hosts.has(h));
  if (extraHosts.length > 0) violations.push(`審査していないホスト: ${extraHosts.join(', ')}`);
  const extraPaths = source.allowedPaths.filter((p) => !pathCovered(p, review.scope.paths));
  if (extraPaths.length > 0) violations.push(`審査していないパス: ${extraPaths.join(', ')}`);

  if (!displayModeAtMost(source.displayMode, review.displayMode)) violations.push(`表示方式 ${source.displayMode} は審査の上限（${review.displayMode}）を超えています`);
  const display = new Set(review.fields.display);
  const extraFields = source.publicFields.filter((f) => !display.has(f));
  if (extraFields.length > 0 && source.displayMode !== 'none') violations.push(`審査で認めていない表示項目: ${extraFields.join(', ')}`);
  if (source.imageAllowed && !review.image.allowed) violations.push('審査で画像を認めていません');
  if (source.seoIndexAllowed && !review.seo.indexAllowed) violations.push('審査でindexを認めていません');
  if (source.jobPostingAllowed && !review.seo.jobPostingAllowed) violations.push('審査でJobPostingを認めていません');
  if (source.commercialPromotionAllowed && !review.promotion.allowed) violations.push('審査で広告利用を認めていません');
  if (STORAGE_ORDER[source.storageMode] > STORAGE_ORDER[review.storage.mode]) {
    violations.push(`保存方式 ${source.storageMode} は審査の範囲（${review.storage.mode}）を超えています`);
  }
  if (source.rawRetentionHours > review.storage.rawRetentionHours) violations.push('原文の保持時間が審査の範囲を超えています');
  if (source.maxRequestsPerHostPerDay > review.crawl.maxRequestsPerDay) violations.push('1日のリクエスト上限が審査の範囲を超えています');
  if (source.maxConcurrencyPerHost > review.crawl.maxConcurrency) violations.push('並列数が審査の範囲を超えています');
  if (source.minRequestIntervalMs < review.crawl.minIntervalMs) violations.push('リクエスト間隔が審査の範囲より短くなっています');
  if (source.staleHideAfterHours > review.freshness.staleHideAfterHours) violations.push('確認できない求人を検索から外すまでの時間が、審査の範囲より長くなっています');

  const expired = review.expiresAt !== null && reviewExpiresAtInstant(review.expiresAt).getTime() <= now.getTime();
  if (source.publicEnabled) {
    if (review.decision !== 'approved') violations.push('承認されていないソースが公開されています');
    if (expired) violations.push('再審査期限を過ぎたソースが公開されています');
  }
  if (source.fetchEnabled) {
    if (review.decision !== 'approved' && review.decision !== 'sample_only') violations.push('承認・サンプル取得の判断がないソースで収集が有効です');
    if (expired) violations.push('再審査期限を過ぎたソースで収集が有効です');
  }
  return violations;
}
