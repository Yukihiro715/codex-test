import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flag, Info } from 'lucide-react';
import {
  DISPLAY_MODE_LABELS,
  applicationRouteLabel,
  buildJobPostingJsonLd,
  describeFixedOvertime,
  employmentTypeLabel,
  formatDateTimeJst,
  formatSalary,
  getOccupation,
  jobDetailRobots,
  locationText,
  occupationLabel,
  salaryBasisLabel,
  serializeJsonLd,
  type OtherListing,
  type PublicJob,
} from '@worklens/domain';
import { Badge } from '@/components/ui/badge';
import { RouteBadge } from '@/components/jobs/route-badge';
import { SalaryText } from '@/components/jobs/salary-text';
import { SaveButton } from '@/components/jobs/save-button';
import { CompareToggle } from '@/components/jobs/compare-toggle';
import { OutboundLink } from '@/components/jobs/outbound-link';
import { PostedDate, StaleNotice } from '@/components/jobs/job-card';
import { TrackView } from '@/components/jobs/track-view';
import { RecordHistory } from '@/components/member/record-history';
import { getJobForRequest } from '@/server/jobs';
import { getConfig, isDemoMode } from '@/server/env';
import { operatorFullName } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/jobs/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { result, source } = await getJobForRequest(id);
  if (result.status !== 'public') {
    return { title: result.status === 'expired' ? '掲載が終了した求人' : '表示できない求人', robots: { index: false, follow: false } };
  }
  const { job } = result.detail;
  const robots = jobDetailRobots(job, source ?? { seoIndexAllowed: false }, { demo: isDemoMode() });
  return {
    title: `${job.title}（${job.employerName}）`,
    alternates: { canonical: `/jobs/${job.id}` },
    description: `${occupationLabel(job.occupation)}・${formatSalary(job.salary)}・${locationText(job) ?? ''}。比較用の条件概要です。募集状況は掲載元でご確認ください。`,
    robots,
  };
}

export default async function JobDetailPage({ params }: PageProps<'/jobs/[id]'>) {
  const { id } = await params;
  const { result, source, now } = await getJobForRequest(id);
  if (result.status === 'unavailable') notFound();
  if (result.status === 'expired') return <EndedJob title={result.title} employerName={result.employerName} />;

  const { job, otherListings } = result.detail;
  const config = getConfig();
  const jsonLd = source ? buildJobPostingJsonLd(job, source, { demo: isDemoMode(), enableJobPosting: config.ENABLE_JOBPOSTING, now }) : null;
  const facts = factRows(job);
  const full = job.displayMode === 'full_authorized';

  return (
    <div className="page-container pb-28 pt-4 lg:pb-10 lg:pt-6">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /> : null}
      <TrackView event="job_viewed" props={{ occupation: job.occupation, displayMode: job.displayMode, route: job.applicationRoute }} />
      <RecordHistory jobId={job.id} />
      <nav aria-label="パンくずリスト" className="mb-4 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="text-muted">
              ホーム
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/jobs" className="text-muted">
              求人検索
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/jobs?occupation=${job.occupation}`} className="text-muted">
              {occupationLabel(job.occupation)}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="max-w-full text-wrap-anywhere">
            {job.title}
          </li>
        </ol>
      </nav>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        <article className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7" data-testid="job-detail">
          <div className="flex flex-wrap items-center gap-1.5">
            <RouteBadge route={job.applicationRoute} />
            <Badge tone="info">{occupationLabel(job.occupation)}</Badge>
            <Badge tone={full ? 'accent' : 'neutral'} data-testid="display-mode">
              {full ? '掲載許諾のある詳細' : '比較用の条件概要'}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-snug text-wrap-anywhere lg:text-[32px]">{job.title}</h1>
          <p className="mt-1 text-sm text-muted text-wrap-anywhere">{job.employerName}</p>
          {job.staleWarning ? (
            <p className="mt-3 text-xs">
              <StaleNotice />
            </p>
          ) : null}

          <section aria-labelledby="salary-heading" className="mt-6">
            <h2 id="salary-heading" className="text-lg font-bold">
              給与
            </h2>
            <SalaryText salary={job.salary} className="mt-1" />
            <dl className="mt-3 grid overflow-hidden rounded-xl border border-line text-sm sm:grid-cols-2">
              <FactCell label="給与の内訳" value={salaryBasisLabel(job.salary.basis)} unknown={job.salary.basis === 'unknown'} />
              <FactCell label="固定残業代" value={describeFixedOvertime(job.salary)} unknown={job.salary.fixedOvertimeIncluded === 'unknown'} />
              <FactCell label="手当の扱い" value={null} />
              <FactCell label="年収への換算" value="行いません（単位の違う給与を同じ基準で並べないため）" />
            </dl>
          </section>

          <section aria-labelledby="work-heading" className="mt-6">
            <h2 id="work-heading" className="text-lg font-bold">
              勤務地・勤務形態
            </h2>
            <dl className="mt-2 grid overflow-hidden rounded-xl border border-line text-sm sm:grid-cols-2">
              <FactCell label="勤務地" value={locationText(job)} />
              <FactCell label="雇用形態" value={job.employmentTypes.map(employmentTypeLabel).join('・') || null} />
              <FactCell label="勤務時間" value={job.workingHours} />
              <FactCell label="必要資格・免許" value={job.requiredQualification} />
            </dl>
          </section>

          <section aria-labelledby="facts-heading" className="mt-6">
            <h2 id="facts-heading" className="text-lg font-bold">
              {full ? '職種別の条件' : '比較用の条件概要'}
            </h2>
            <p className="mt-1 text-xs text-muted">求人に明記された条件だけを表示します。記載がない項目は「原文に記載なし」とし、推測で補いません。</p>
            <dl className="mt-2 grid overflow-hidden rounded-xl border border-line text-sm sm:grid-cols-2" data-testid="fact-table">
              {facts.map((f) => (
                <FactCell key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
          </section>

          {full && job.authorizedDescription ? (
            <section aria-labelledby="description-heading" className="mt-6" data-testid="authorized-description">
              <h2 id="description-heading" className="text-lg font-bold">
                仕事内容（掲載元の許諾範囲で表示）
              </h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-wrap-anywhere">{job.authorizedDescription}</p>
            </section>
          ) : (
            <p className="mt-6 rounded-xl bg-page p-4 text-sm text-muted">
              この表示方式（{DISPLAY_MODE_LABELS[job.displayMode]}）では、原稿の全文や画像を転載せず、比較に必要な条件と元ページへの案内だけを表示します。仕事内容の詳細は掲載元でご確認ください。
            </p>
          )}

          <section aria-labelledby="source-heading" className="mt-6">
            <h2 id="source-heading" className="text-lg font-bold">
              出典と情報確認
            </h2>
            <dl className="mt-2 grid overflow-hidden rounded-xl border border-line text-sm sm:grid-cols-2">
              <FactCell label="掲載元" value={job.sourceName} />
              <FactCell label="応募経路" value={applicationRouteLabel(job.applicationRoute)} />
              <FactCell label="情報確認日時" value={`${formatDateTimeJst(job.lastFetchedAt)}（日本時間）`} />
              <div className="border-b border-line p-3 sm:odd:border-r">
                <dt className="text-xs text-muted">掲載開始日</dt>
                <dd className="mt-0.5 font-bold">
                  <PostedDate job={job} />
                </dd>
              </div>
            </dl>
            {job.applicationRoute === 'hellowork' ? (
              <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm font-bold" data-testid="page-operator">
                このページの運営事業者：{operatorFullName()}
              </p>
            ) : null}
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#dce5ce] bg-note-bg p-3 text-sm text-note-ink">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              公開情報をもとに条件を整理しています。募集状況・応募条件は掲載元でご確認ください。「情報確認」は採用企業が募集継続を確認した日時ではありません。
            </p>
          </section>

          {otherListings.length > 0 ? <OtherListings listings={otherListings} /> : null}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
            <OutboundLink listingId={job.primaryListingId} route={job.applicationRoute} placement="detail" />
            <SaveButton jobId={job.id} title={job.title} variant="full" />
            <CompareToggle jobId={job.id} title={job.title} />
          </div>
          <p className="mt-4 text-sm">
            <Link href={`/report?jobId=${job.id}`} className="inline-flex min-h-11 items-center gap-1.5">
              <Flag aria-hidden className="size-4" />
              この求人の掲載内容の訂正・削除を依頼する
            </Link>
          </p>
        </article>

        <aside className="sticky top-6 hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:block" aria-label="条件のまとめ">
          <p className="text-xs font-bold text-muted">条件のまとめ</p>
          <SalaryText salary={job.salary} size="md" className="mt-1" />
          <p className="mt-1 text-sm text-muted text-wrap-anywhere">{locationText(job) ?? '勤務地の記載なし'}</p>
          <p className="text-sm text-muted">{job.employmentTypes.map(employmentTypeLabel).join('・')}</p>
          <OutboundLink listingId={job.primaryListingId} route={job.applicationRoute} placement="detail" className="mt-4 w-full" />
          <p className="mt-2 text-xs text-muted">当サービスでは応募を受け付けていません。応募方法は掲載元でご確認ください。</p>
          <div className="mt-4 flex gap-2">
            <SaveButton jobId={job.id} title={job.title} variant="full" className="flex-1" />
            <CompareToggle jobId={job.id} title={job.title} className="flex-1" />
          </div>
          <p className="mt-4 border-t border-line-soft pt-3 text-xs text-muted">
            掲載元：{job.sourceName}
            <br />
            情報確認：{formatDateTimeJst(job.lastFetchedAt)}（日本時間）
          </p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" data-testid="mobile-cta">
        <div className="page-container flex items-center gap-2 py-2.5">
          <SaveButton jobId={job.id} title={job.title} />
          <OutboundLink listingId={job.primaryListingId} route={job.applicationRoute} placement="detail" className="flex-1 text-[15px]" />
        </div>
      </div>
    </div>
  );
}

function FactCell({ label, value, unknown }: { label: string; value: string | null; unknown?: boolean }) {
  const isUnknown = unknown || value === null || value.trim() === '';
  return (
    <div className="border-b border-line p-3 sm:odd:border-r">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={isUnknown ? 'mt-0.5 font-bold text-warn' : 'mt-0.5 font-bold text-wrap-anywhere'}>{value && value.trim() !== '' ? value : '原文に記載なし'}</dd>
    </div>
  );
}

function factRows(job: PublicJob): { label: string; value: string | null }[] {
  const labels = [...(getOccupation(job.occupation)?.compareFields ?? [])];
  for (const label of Object.keys(job.facts)) if (!labels.includes(label)) labels.push(label);
  return labels.map((label) => {
    const value = job.facts[label];
    return { label, value: value === null || value === undefined ? null : Array.isArray(value) ? value.join(' / ') : String(value) };
  });
}

function OtherListings({ listings }: { listings: OtherListing[] }) {
  return (
    <details className="mt-6 rounded-xl border border-line" data-testid="other-listings">
      <summary className="flex min-h-12 items-center px-4 font-bold">他の掲載元（{listings.length}件）</summary>
      <div className="border-t border-line px-4 py-3">
        <p className="text-xs text-muted">同じ募集と判断した他の掲載元です。給与などは各掲載元の記載をそのまま表示し、条件のよい値を組み合わせません。</p>
        <ul className="mt-3 space-y-3">
          {listings.map((l) => (
            <li key={l.listingId} className="rounded-lg bg-page p-3 text-sm">
              <p className="font-bold text-wrap-anywhere">{l.sourceName}</p>
              <p className="text-muted">
                {applicationRouteLabel(l.applicationRoute)} ／ {formatSalary(l.salary)}
              </p>
              <p className="text-xs text-muted">
                情報確認：{formatDateTimeJst(l.lastFetchedAt)}（日本時間）{l.staleWarning ? ' ・確認から時間が経過' : ''}
              </p>
              <OutboundLink listingId={l.listingId} route={l.applicationRoute} placement="other_listing" className="mt-2 min-h-11 bg-surface px-4 text-sm text-primary hover:bg-primary-soft" />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** 掲載終了：検索から除外し、元ページへの導線は出さない */
function EndedJob({ title, employerName }: { title: string; employerName: string }) {
  return (
    <div className="page-container py-10">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center" data-testid="job-ended">
        <p className="text-sm font-bold text-warn">この求人の掲載は終了しています</p>
        <h1 className="mt-2 text-xl font-bold text-wrap-anywhere">{title}</h1>
        <p className="mt-1 text-sm text-muted text-wrap-anywhere">{employerName}</p>
        <p className="mt-4 text-sm text-muted">募集条件は表示していません。元の求人ページへのご案内も停止しています。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-5 font-bold text-white no-underline hover:bg-primary-hover">
            ほかの求人を探す
          </Link>
          <Link href="/saved" className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface px-5 font-bold text-ink no-underline">
            保存した求人へ
          </Link>
        </div>
      </div>
    </div>
  );
}
