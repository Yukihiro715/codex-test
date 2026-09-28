'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COMPARE_LIMIT, type JobLookupItem } from '@worklens/domain';
import { clearCompare, useCompareIds } from '@/lib/local-lists';
import { cn } from '@/lib/utils';

/**
 * 比較トレー（最大3件）。画面下に固定し、同じ高さの余白をページ末尾に確保してコンテンツを覆わない。
 */
export function CompareTray() {
  const ids = useCompareIds();
  const pathname = usePathname() ?? '/';
  const [titles, setTitles] = useState<Record<string, string>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/jobs/lookup?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: JobLookupItem[] }>) : null))
      .then((data) => {
        if (!data) return;
        const next: Record<string, string> = {};
        for (const item of data.items) {
          next[item.status === 'public' ? item.job.id : item.id] =
            item.status === 'public' ? item.job.title : item.status === 'expired' ? `${item.title}（掲載終了）` : '表示できない求人';
        }
        setTitles(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key]);

  const hidden = ids.length === 0 || pathname.startsWith('/compare') || pathname.startsWith('/admin');
  if (hidden) return null;
  const onDetail = pathname.startsWith('/jobs/');

  return (
    <>
      <div aria-hidden className={cn('h-24', onDetail && 'max-lg:hidden')} />
      <aside
        aria-label="比較中の求人"
        data-testid="compare-tray"
        className={cn('fixed inset-x-0 bottom-0 z-40 bg-ink pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-4px_24px_rgba(20,45,69,0.12)]', onDetail && 'max-lg:hidden')}
      >
        <div className="page-container flex min-h-[76px] flex-wrap items-center gap-x-4 gap-y-1 py-2">
          <p className="shrink-0 text-sm font-bold" aria-live="polite">
            {ids.length}/{COMPARE_LIMIT}件を比較中
          </p>
          <p className="hidden min-w-0 flex-1 truncate text-xs text-[#dbe6ed] md:block">{ids.map((id) => titles[id] ?? '読み込み中…').join(' ／ ')}</p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={clearCompare} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-white underline-offset-4 hover:underline">
              クリア
            </button>
            <Link
              href={`/compare?ids=${ids.join(',')}`}
              className="inline-flex min-h-11 items-center rounded-[10px] border border-accent bg-accent px-4 text-sm font-bold text-accent-ink no-underline hover:bg-[#dff0a0]"
            >
              違いを比較する
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
