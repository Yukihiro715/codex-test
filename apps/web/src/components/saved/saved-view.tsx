'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Info, Trash2, TriangleAlert } from 'lucide-react';
import type { JobLookupItem } from '@worklens/domain';
import { JobCard } from '@/components/jobs/job-card';
import { removeSaved, savedStore, useSavedIds } from '@/lib/local-lists';

type SortMode = 'saved' | 'checked';

function useStoragePersistent(): boolean {
  return useSyncExternalStore(
    savedStore.subscribe,
    () => savedStore.isPersistent(),
    () => true,
  );
}

/**
 * 保存した求人（S06）。このブラウザのlocalStorageにあるIDだけを使い、内容は毎回サーバーで公開状態を確認して取得する。
 * 掲載終了・非公開になった求人は、保存していた内容を復元せず最小限の表示と削除操作だけを出す。
 */
export function SavedView() {
  const ids = useSavedIds();
  const persistent = useStoragePersistent();
  const [items, setItems] = useState<{ key: string; list: JobLookupItem[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('saved');
  const key = ids.join(',');

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/jobs/lookup?ids=${encodeURIComponent(key)}`, { signal: controller.signal, cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: JobLookupItem[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        setItems({ key, list: data.items });
        setFailedKey(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(key);
      });
    return () => controller.abort();
  }, [key]);

  const byId = new Map((items?.list ?? []).map((item) => [item.status === 'public' ? item.job.id : item.id, item]));
  // 保存が新しい順（配列の末尾が最新）
  const ordered = [...ids].reverse();
  const sorted =
    sort === 'checked'
      ? [...ordered].sort((a, b) => {
          const ia = byId.get(a);
          const ib = byId.get(b);
          const ta = ia?.status === 'public' ? ia.job.lastFetchedAt : '';
          const tb = ib?.status === 'public' ? ib.job.lastFetchedAt : '';
          return tb.localeCompare(ta);
        })
      : ordered;
  const loading = ids.length > 0 && items?.key !== key && failedKey !== key;

  return (
    <div className="page-container pb-10 pt-4 lg:pt-6">
      <h1 className="text-[28px] font-extrabold lg:text-[32px]">保存した求人</h1>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        このブラウザにだけ保存しています（求人IDのみ）。他の端末やブラウザには引き継がれません。
      </p>
      {!persistent ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-warn/40 bg-warn-bg p-3 text-sm text-warn" role="status">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          このブラウザでは保存領域を利用できないため、ページを閉じると保存が消えます。
        </p>
      ) : null}

      {ids.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center" data-testid="saved-empty">
          <h2 className="text-lg font-bold">保存した求人はありません</h2>
          <p className="mt-2 text-sm text-muted">気になる求人の保存ボタンを押すと、ここに表示されます。</p>
          <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-primary px-5 font-bold text-white no-underline hover:bg-primary-hover">
            求人を探す
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm" aria-live="polite">
              <span className="text-xl font-extrabold">{ids.length}</span>件を保存中
            </p>
            <div>
              <label htmlFor="saved-sort" className="mb-1 block text-xs font-bold text-muted">
                並び替え
              </label>
              <select id="saved-sort" className="field-input text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                <option value="saved">保存が新しい順</option>
                <option value="checked">情報確認が新しい順</option>
              </select>
            </div>
          </div>
          {failedKey === key ? (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
              保存した求人の情報を取得できませんでした。時間をおいて再度お試しください。
            </p>
          ) : null}
          {loading ? (
            <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="読み込み中">
              {ids.slice(0, 3).map((id) => (
                <div key={id} className="skeleton h-40 w-full" />
              ))}
            </div>
          ) : (
            <ol className="mt-4 flex flex-col gap-3" aria-label="保存した求人">
              {sorted.map((id) => {
                const item = byId.get(id);
                if (!item) return null;
                if (item.status === 'public') {
                  return (
                    <li key={id}>
                      <JobCard job={item.job} />
                    </li>
                  );
                }
                return (
                  <li key={id}>
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4"
                      data-testid="saved-unavailable"
                      data-job-id={id}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-warn">{item.status === 'expired' ? '掲載終了' : '非公開'}</p>
                        <p className="mt-0.5 text-sm text-wrap-anywhere">
                          {item.status === 'expired' ? `${item.title}（${item.employerName}）` : 'この求人は掲載が停止されたため、内容を表示できません。'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSaved(id)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-sm font-bold hover:border-danger hover:text-danger"
                      >
                        <Trash2 aria-hidden className="size-4" />
                        保存から削除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
