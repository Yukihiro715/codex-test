import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { HeroSearchForm } from '@/components/search/hero-search-form';
import { JobCard } from '@/components/jobs/job-card';
import { OccupationIcon } from '@/components/jobs/occupation-icon';
import { getRepository, getRequestContext } from '@/server/repository';
import { isDemoMode } from '@/server/env';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const repo = getRepository();
  const home = await repo.home(await getRequestContext());
  const demo = isDemoMode();

  return (
    <>
      <section className="page-container grid items-center gap-10 pb-8 pt-9 lg:grid-cols-[1.3fr_0.8fr] lg:gap-12 lg:pb-10 lg:pt-14">
        <div>
          <p className="mb-3 text-[13px] font-bold tracking-[0.09em] text-primary">条件から探す、仕事の検索サービス</p>
          <h1 className="text-[34px] font-extrabold leading-[1.35] tracking-tight lg:text-[48px]">
            働き方の違いまで、
            <br />
            比べて探す。
          </h1>
          <p className="mt-4 text-[15px] text-muted lg:text-base">
            職種ごとに必要な条件をそろえて、公開求人を横断比較。
            <br className="hidden sm:inline" />
            気になる仕事は、元の掲載ページで詳しく確認できます。
          </p>
          <HeroSearchForm className="mt-7" />
        </div>
        <CompareIllustration />
      </section>

      <section id="occupations" aria-labelledby="occupations-heading" className="page-container scroll-mt-4 py-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="occupations-heading" className="text-xl font-bold">
            職種から探す
          </h2>
          <p className="text-sm text-muted">職種ごとに、絞り込める条件と比べる項目が変わります</p>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {home.occupations.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/occupations/${o.slug}`}
                className="flex h-full min-h-[76px] items-center gap-3 rounded-xl border border-line bg-surface p-3 text-ink no-underline hover:border-primary hover:bg-[#eef3ff] sm:p-4"
              >
                <OccupationIcon slug={o.slug} className="size-6 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug">{o.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">
                    {o.visibleCount === 0 ? '現在準備中の職種です' : o.description}
                    {!demo && o.visibleCount > 0 ? `（${o.visibleCount}件）` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="compare-heading" className="page-container py-8">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:p-8">
          <p className="inline-block rounded-md bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">比較機能</p>
          <h2 id="compare-heading" className="mt-3 text-xl font-bold lg:text-2xl">
            給与だけでは見えない違いを、同じ項目で。
          </h2>
          <ol className="mt-4 grid gap-3 text-[15px] md:grid-cols-3">
            <li className="rounded-xl bg-page p-4">
              <span className="block text-xs font-bold text-primary">1</span>
              気になる求人を「比較に追加」（最大3件）。保存と比較はこのブラウザだけに記録します。
            </li>
            <li className="rounded-xl bg-page p-4">
              <span className="block text-xs font-bold text-primary">2</span>
              給与の単位・勤務時間・必要資格・職種ごとの条件を、同じ順序で並べて表示します。
            </li>
            <li className="rounded-xl bg-page p-4">
              <span className="block text-xs font-bold text-primary">3</span>
              「記載なし」は有利・不利を判定しません。最終的な条件は元の掲載ページで確認できます。
            </li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="recent-heading" className="page-container py-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-heading" className="text-xl font-bold">
            最近情報を確認した求人
          </h2>
          <Link href="/jobs?sort=newest" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold">
            新着順で探す <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        {home.recentJobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">現在表示できる求人がありません。</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {home.recentJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="data-heading" className="page-container py-8">
        <div className="rounded-xl border border-[#dce5ce] bg-note-bg p-5 text-sm text-note-ink lg:p-6">
          <h2 id="data-heading" className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck aria-hidden className="size-5" />
            データの扱い
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>公開されている求人情報をもとに、比較に必要な条件を整理して表示します。原稿の全文や写真は転載しません。</li>
            <li>「情報確認」の日時は当サービスが情報を確認した日時で、採用企業が募集継続を保証したものではありません。募集状況・応募条件は掲載元でご確認ください。</li>
            <li>
              掲載内容の誤りや掲載停止のご希望は、<Link href="/report">訂正・削除の申請フォーム</Link>から受け付けます。収集の考え方は
              <Link href="/sources">収集方針</Link>をご覧ください。
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}

/** 画面説明用の架空イメージ（実績件数・口コミには置き換えない） */
function CompareIllustration() {
  return (
    <figure className="order-last rounded-[18px] border border-line bg-surface p-5 shadow-[0_14px_35px_rgba(20,45,69,0.04)] lg:rotate-[1.5deg] lg:p-6" aria-label="比較画面のイメージ（架空）">
      <p className="mb-3 text-sm font-bold">給与の、その先も。</p>
      <div className="grid grid-cols-2 gap-2.5 text-[13px]">
        {[
          ['勤務スタイル', '日勤のみ'],
          ['オンコール', '記載なし'],
          ['必要な資格', '看護師'],
          ['帰宅頻度', '毎日'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#e6ebf0] bg-[#f6f8fb] p-3">
            {label}
            <b className={value === '記載なし' ? 'mt-1 block text-base text-warn' : 'mt-1 block text-base text-ink'}>{value}</b>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-center text-[13px] font-bold text-accent-ink">同じ項目で並べると、違いが見える。</p>
      <figcaption className="mt-2 text-[11px] text-muted">画面の説明用イメージです（架空の値）</figcaption>
    </figure>
  );
}
