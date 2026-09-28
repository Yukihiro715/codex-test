'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Info, X } from 'lucide-react';
import { COMPARE_LIMIT, type CompareRow, type JobLookupItem, type PublicJobSummary } from '@worklens/domain';
import { SaveButton } from '@/components/jobs/save-button';
import { OutboundLink } from '@/components/jobs/outbound-link';
import { compareStore, removeFromCompare, useCompareIds } from '@/lib/local-lists';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';

function itemId(item: JobLookupItem): string {
  return item.status === 'public' ? item.job.id : item.id;
}

/**
 * 比較（最大3件）。PCは項目列＋求人列、スマホは項目列を固定した横スクロール。
 * 「違いだけ表示」では表示が同じ行を隠す（不明同士を有利・不利に判定しない）。
 */
export function CompareView({ items, rows, truncated }: { items: JobLookupItem[]; rows: CompareRow[]; truncated: boolean }) {
  const router = useRouter();
  const storedIds = useCompareIds();
  const [diffOnly, setDiffOnly] = useState(false);
  const captionId = useId();
  const jobs = items.flatMap((item): PublicJobSummary[] => (item.status === 'public' ? [item.job] : []));
  const unavailable = items.filter((item) => item.status !== 'public');
  const ids = items.map(itemId);

  // /compare をIDなしで開いたときは、このブラウザの比較リストを表示する
  useEffect(() => {
    if (items.length === 0 && storedIds.length > 0) router.replace(`/compare?ids=${storedIds.join(',')}`);
  }, [items.length, storedIds, router]);

  useEffect(() => {
    if (items.length > 0) track('compare_opened', { count: items.length });
  }, [items.length]);

  const remove = (id: string) => {
    removeFromCompare(id);
    const next = ids.filter((v) => v !== id);
    router.replace(next.length > 0 ? `/compare?ids=${next.join(',')}` : '/compare');
  };

  const visibleRows = diffOnly ? rows.filter((r) => r.differs) : rows;
  const onlyJob = jobs.length === 1 ? jobs[0] : undefined;

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
          <li aria-current="page">比較</li>
        </ol>
      </nav>
      <h1 className="text-[28px] font-extrabold leading-snug lg:text-[32px]">働き方を、同じ項目で比較。</h1>
      <p className="mt-1 text-sm text-muted">最大{COMPARE_LIMIT}件。給与の単位が違う求人は、単純な金額順には並べません。「原文に記載なし」は有利・不利を判定しません。</p>

      {truncated ? (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn-bg p-3 text-sm text-warn" role="status">
          比較できるのは{COMPARE_LIMIT}件までです。4件目以降は表示していません。
        </p>
      ) : null}

      {unavailable.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warn/40 bg-warn-bg p-4 text-sm text-warn" data-testid="compare-unavailable">
          <p className="font-bold">表示できない求人があります（内容は表示しません）</p>
          <ul className="mt-2 space-y-1">
            {unavailable.map((item) => (
              <li key={itemId(item)} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-wrap-anywhere">{item.status === 'expired' ? `掲載終了：${item.title}` : '掲載停止中、または存在しない求人'}</span>
                <button type="button" onClick={() => remove(itemId(item))} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-bold underline">
                  比較から外す
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {jobs.length <= 1 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6 text-center" data-testid="compare-empty">
          <h2 className="text-lg font-bold">{jobs.length === 0 ? '比較する求人がありません' : 'もう1件以上追加すると比較できます'}</h2>
          <p className="mt-2 text-sm text-muted">
            検索結果や求人詳細の「比較に追加」から、最大{COMPARE_LIMIT}件まで選べます。比較リストはこのブラウザにだけ保存されます。
          </p>
          {onlyJob ? (
            <p className="mt-3 text-sm">
              選択中：<span className="font-bold text-wrap-anywhere">{onlyJob.title}</span>
              <button type="button" onClick={() => remove(onlyJob.id)} className="ml-2 inline-flex min-h-11 items-center font-bold text-primary underline">
                外す
              </button>
            </p>
          ) : null}
          <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-primary px-5 font-bold text-white no-underline hover:bg-primary-hover">
            求人を探して追加する
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <label className="check-row font-bold">
              <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} data-testid="diff-only" />
              <span>違いのある項目だけ表示</span>
            </label>
            <p className="flex items-center gap-1 text-xs text-muted lg:hidden">
              <ArrowLeftRight aria-hidden className="size-4" />
              表は横にスクロールできます
            </p>
          </div>
          <div
            role="region"
            aria-labelledby={captionId}
            tabIndex={0}
            className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface"
            data-testid="compare-table-region"
          >
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <caption id={captionId} className="px-4 py-3 text-left text-xs text-muted">
                求人{jobs.length}件の条件比較（左端の列は比較する項目。{diffOnly ? '違いのある項目だけ表示中' : 'すべての項目を表示中'}）
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-[132px] min-w-[112px] border-b border-line bg-[#f4f7fa] px-3 py-3 text-left align-top text-xs font-bold">
                    比較する項目
                  </th>
                  {jobs.map((job) => (
                    <th key={job.id} scope="col" className="min-w-[200px] border-b border-l border-line bg-[#f4f7fa] px-4 py-3 text-left align-top font-normal">
                      <Link href={`/jobs/${job.id}`} className="block font-bold leading-snug text-ink text-wrap-anywhere hover:text-primary">
                        {job.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted text-wrap-anywhere">{job.employerName}</span>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SaveButton jobId={job.id} title={job.title} />
                        <button
                          type="button"
                          onClick={() => remove(job.id)}
                          aria-label={`${job.title}を比較から外す`}
                          className="inline-flex min-h-11 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-xs font-bold hover:border-danger hover:text-danger"
                        >
                          <X aria-hidden className="size-4" />
                          外す
                        </button>
                      </div>
                      <OutboundLink listingId={job.primaryListingId} route={job.applicationRoute} placement="compare" className="mt-2 min-h-11 w-full px-3 text-xs" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={jobs.length + 1} className="px-4 py-6 text-center text-muted">
                      表示が異なる項目はありません。
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.key} data-row={row.key}>
                      <th scope="row" className="sticky left-0 z-10 border-b border-line bg-[#fafcfd] px-3 py-3 text-left align-top text-xs font-bold leading-snug">
                        {row.label}
                      </th>
                      {row.cells.map((cell, i) => (
                        <td
                          key={`${row.key}-${jobs[i]?.id ?? i}`}
                          className={cn(
                            'border-b border-l border-line px-4 py-3 align-top leading-relaxed text-wrap-anywhere',
                            cell.kind === 'unknown' && 'font-bold text-warn',
                            cell.kind === 'na' && 'text-muted',
                          )}
                        >
                          {cell.text}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            異なる職種の比較では、その職種にない項目を「対象外」と表示します。最終的な条件は各掲載元でご確認ください。
          </p>
        </>
      )}
      {storedIds.length > 0 && ids.join(',') !== storedIds.join(',') && items.length > 0 ? (
        <p className="mt-4 text-sm">
          <button type="button" className="inline-flex min-h-11 items-center font-bold text-primary underline" onClick={() => compareStore.set(ids)}>
            この比較をこのブラウザの比較リストにする
          </button>
        </p>
      ) : null}
    </div>
  );
}
