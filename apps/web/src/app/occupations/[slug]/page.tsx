import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import {
  DEFAULT_QUERY,
  OCCUPATIONS,
  OCCUPATION_GUIDES,
  getOccupation,
  isHubIndexable,
  searchHref,
  toggleFacetValue,
  toggleListValue,
  withPatch,
  type SearchQuery,
} from '@worklens/domain';
import { HeroSearchForm } from '@/components/search/hero-search-form';
import { JobCard } from '@/components/jobs/job-card';
import { OccupationIcon } from '@/components/jobs/occupation-icon';
import { getRepository, getRequestContext } from '@/server/repository';
import { isDemoMode } from '@/server/env';

/** 職種ごとの条件ショートカット（3〜5件）。専用UIのない職種は共通条件を使う */
const SHORTCUTS: Record<string, { label: string; apply: (q: SearchQuery) => SearchQuery }[]> = {
  driver: [
    { label: '毎日帰宅', apply: (q) => toggleFacetValue(q, 'home', 'daily') },
    { label: '手積みなし', apply: (q) => toggleFacetValue(q, 'manualLoading', 'no') },
    { label: '中型免許', apply: (q) => toggleFacetValue(q, 'license', 'medium') },
    { label: '地場・近距離', apply: (q) => toggleFacetValue(q, 'range', 'local') },
  ],
  manufacturing: [
    { label: '日勤', apply: (q) => toggleFacetValue(q, 'shift', 'day') },
    { label: '寮あり', apply: (q) => toggleFacetValue(q, 'dorm', 'yes') },
    { label: '重量物なし', apply: (q) => toggleFacetValue(q, 'heavy', 'no') },
    { label: '直接雇用', apply: (q) => toggleFacetValue(q, 'hire', 'direct') },
  ],
  nurse: [
    { label: '夜勤なし', apply: (q) => toggleFacetValue(q, 'night', 'no') },
    { label: 'オンコールなし', apply: (q) => toggleFacetValue(q, 'onCall', 'no') },
    { label: '准看護師も応募可', apply: (q) => toggleFacetValue(q, 'lpn', 'ok') },
    { label: 'クリニック', apply: (q) => toggleFacetValue(q, 'facility', 'clinic') },
  ],
  engineer: [
    { label: 'フルリモート', apply: (q) => toggleFacetValue(q, 'office', 'remote') },
    { label: '自社開発・自社サービス', apply: (q) => toggleFacetValue(q, 'workStyle', 'in_house') },
    { label: 'TypeScript', apply: (q) => toggleFacetValue(q, 'tech', 'typescript') },
    { label: '業務委託', apply: (q) => toggleFacetValue(q, 'contract', 'freelance') },
  ],
};

const COMMON_SHORTCUTS: { label: string; apply: (q: SearchQuery) => SearchQuery }[] = [
  { label: '正社員', apply: (q) => toggleListValue(q, 'emp', 'fulltime') },
  { label: 'パート・アルバイト', apply: (q) => toggleListValue(q, 'emp', 'parttime') },
  { label: '月給で比べる', apply: (q) => withPatch(q, { salaryUnit: 'MONTH' }) },
  { label: '3日以内に情報確認', apply: (q) => withPatch(q, { fresh: '72h' }) },
];

export async function generateMetadata({ params }: PageProps<'/occupations/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const occupation = getOccupation(slug);
  if (!occupation) return { title: '職種が見つかりません', robots: { index: false, follow: false } };
  const hub = await getRepository().occupationHub(slug, await getRequestContext());
  const indexable = isHubIndexable(hub.visibleCount, { demo: isDemoMode() });
  return {
    title: `${occupation.label}の求人`,
    description: `${occupation.label}の仕事を、${occupation.description.replace('で比較', '')}などの条件で比べて探せます。`,
    alternates: { canonical: `/occupations/${slug}` },
    // 空のハブ・デモはnoindex（SEO04）
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function OccupationHubPage({ params }: PageProps<'/occupations/[slug]'>) {
  const { slug } = await params;
  const occupation = getOccupation(slug);
  if (!occupation) notFound();
  const hub = await getRepository().occupationHub(slug, await getRequestContext());
  const guide = OCCUPATION_GUIDES[slug];
  const base: SearchQuery = { ...DEFAULT_QUERY, occupation: slug };
  const shortcuts = SHORTCUTS[slug] ?? COMMON_SHORTCUTS;
  const empty = hub.visibleCount === 0;

  return (
    <div className="page-container pb-10 pt-4 lg:pt-6">
      <nav aria-label="パンくずリスト" className="mb-4 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="text-muted">
              ホーム
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/#occupations" className="text-muted">
              職種から探す
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{occupation.label}</li>
        </ol>
      </nav>

      <header className="flex items-start gap-3">
        <OccupationIcon slug={slug} className="mt-1.5 size-8 shrink-0 text-primary" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-snug lg:text-[32px]">{guide?.hubTitle ?? `${occupation.label}の仕事を、働き方から探す。`}</h1>
          <p className="mt-1 text-sm text-muted">{occupation.description}</p>
        </div>
      </header>

      {empty ? (
        <section className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6 text-center" data-testid="hub-empty">
          <h2 className="text-lg font-bold">現在準備中の職種です</h2>
          <p className="mt-2 text-sm text-muted">この職種で表示できる求人がありません。求人を架空に作って表示することはしません。ほかの職種からお探しください。</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="shortcut-heading" className="mt-6">
            <h2 id="shortcut-heading" className="text-base font-bold">
              よく使う条件で探す
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {shortcuts.map((s) => (
                <li key={s.label}>
                  <Link
                    href={searchHref(s.apply(base))}
                    className="inline-flex min-h-11 items-center gap-1 rounded-[10px] border border-line bg-surface px-4 text-sm font-bold text-ink no-underline hover:border-primary hover:text-primary"
                  >
                    {s.label}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
            <HeroSearchForm occupation={slug} idPrefix="hub" className="mt-4" />
          </section>

          {guide ? (
            <section aria-labelledby="points-heading" className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:p-6">
              <h2 id="points-heading" className="text-lg font-bold">
                比較するときに見るポイント
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
                {guide.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">比較表では「{occupation.compareFields.join('」「')}」を同じ順序で並べます。</p>
            </section>
          ) : null}

          <section aria-labelledby="samples-heading" className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="samples-heading" className="text-lg font-bold">
                最近情報を確認した{occupation.label}の求人
              </h2>
              <Link href={searchHref(base)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold">
                この職種の求人をすべて見る <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {hub.sampleJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="related-heading" className="mt-10">
        <h2 id="related-heading" className="text-base font-bold">
          ほかの職種
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {OCCUPATIONS.filter((o) => o.slug !== slug).map((o) => (
            <li key={o.slug}>
              <Link
                href={`/occupations/${o.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-sm font-bold text-ink no-underline hover:border-primary"
              >
                <OccupationIcon slug={o.slug} className="size-4 text-primary" />
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
