import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { employmentTypeLabel, formatDateJst, locationText, occupationLabel, type PublicJobSummary } from '@worklens/domain';
import { Badge } from '@/components/ui/badge';
import { SalaryText } from './salary-text';
import { FactTags, cardFacts } from './fact-tags';
import { RouteBadge } from './route-badge';
import { SaveButton } from './save-button';
import { CompareToggle } from './compare-toggle';

export function StaleNotice({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-warn-bg px-1.5 py-0.5 font-bold text-warn">
      <TriangleAlert aria-hidden className="size-3.5" />
      {compact ? '確認から時間が経過' : '情報確認から時間が経っています。最新の状況は掲載元でご確認ください'}
    </span>
  );
}

export function PostedDate({ job }: { job: Pick<PublicJobSummary, 'sourcePostedAt' | 'firstSeenAt'> }) {
  return job.sourcePostedAt ? (
    <>
      掲載開始日：<time dateTime={job.sourcePostedAt}>{formatDateJst(job.sourcePostedAt)}</time>
    </>
  ) : (
    <>
      初回検出日：<time dateTime={job.firstSeenAt}>{formatDateJst(job.firstSeenAt)}</time>（元の掲載開始日の記載なし）
    </>
  );
}

/**
 * 求人カード。表示順：応募経路/PR → 職種タイトル → 企業名 → 給与 → 勤務地/雇用形態 → 職種別3条件 → 出典と情報確認日時 → 操作。
 * カード全体をクリックできるが、リンクの中にボタンを入れ子にしない（stretched link）。
 */
export function JobCard({
  job,
  priorityFacts = [],
  promoted = false,
  showPostedDate = false,
}: {
  job: PublicJobSummary;
  priorityFacts?: readonly string[];
  promoted?: boolean;
  showPostedDate?: boolean;
}) {
  const location = locationText(job) ?? '勤務地の記載なし';
  const employment = job.employmentTypes.map(employmentTypeLabel).join('・') || '雇用形態の記載なし';
  return (
    <article
      className="relative rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-[#a6bcdd] sm:p-6"
      data-testid={promoted ? 'promoted-card' : 'job-card'}
      data-job-id={job.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {promoted ? (
          <Badge tone="pr" aria-label="PR（広告）">
            PR
          </Badge>
        ) : null}
        <RouteBadge route={job.applicationRoute} />
        <Badge tone="info">{occupationLabel(job.occupation)}</Badge>
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-wrap-anywhere sm:text-xl">
            <Link
              href={`/jobs/${job.id}`}
              className="text-ink no-underline after:absolute after:inset-0 after:rounded-[var(--radius-card)] after:content-[''] hover:text-primary"
            >
              {job.title}
            </Link>
          </h3>
          <p className="mt-1 text-[13px] text-muted text-wrap-anywhere">{job.employerName}</p>
        </div>
        <SaveButton jobId={job.id} title={job.title} />
      </div>
      <SalaryText salary={job.salary} className="mt-3" />
      <p className="mt-1 text-[13px] text-muted text-wrap-anywhere">
        {location} ／ {employment}
      </p>
      <FactTags facts={cardFacts(job.occupation, job.facts, priorityFacts)} className="mt-3" />
      <div className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-3.5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-0.5 text-xs leading-relaxed text-muted">
          <p className="text-wrap-anywhere">
            掲載元：{job.sourceName}
            {job.otherListingCount > 0 ? `（ほか${job.otherListingCount}件の掲載元あり）` : ''}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              情報確認：<time dateTime={job.lastFetchedAt}>{formatDateJst(job.lastFetchedAt)}</time>
            </span>
            {job.staleWarning ? <StaleNotice compact /> : null}
          </p>
          {showPostedDate ? (
            <p>
              <PostedDate job={job} />
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 md:justify-end">
          <CompareToggle jobId={job.id} title={job.title} />
          <span aria-hidden className="px-1 text-[13px] font-bold text-primary">
            条件を詳しく見る →
          </span>
        </div>
      </div>
    </article>
  );
}
