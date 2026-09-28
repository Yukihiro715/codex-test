'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Info, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';
import {
  DEFAULT_QUERY,
  PREFECTURES,
  SORT_DESCRIPTIONS,
  SORT_OPTIONS,
  activeConditions,
  facetsForOccupation,
  getPrefectureByCode,
  occupationLabel,
  parseSearchQuery,
  serializeQuery,
  withPatch,
  type ActiveCondition,
  type QueryIssue,
  type SearchQuery,
  type SortValue,
} from '@worklens/domain';
import type { SearchResponse } from '@worklens/data';
import { JobCard } from '@/components/jobs/job-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';
import { FilterPanel, type FilterChangeMeta } from './filter-panel';
import { FilterSheet } from './filter-sheet';

const subscribeNothing = () => () => {};

function hrefFor(queryString: string): string {
  return queryString ? `/jobs?${queryString}` : '/jobs';
}

function headingFor(query: SearchQuery): string {
  const parts: string[] = [];
  if (query.pref) parts.push(getPrefectureByCode(query.pref)?.name ?? '');
  if (query.loc) parts.push(query.loc);
  if (query.occupation) parts.push(occupationLabel(query.occupation));
  const base = parts.filter(Boolean).join('・');
  if (query.q) return `「${query.q}」${base ? `（${base}）` : ''}の求人`;
  return base ? `${base}の求人` : '求人を探す';
}

/**
 * 検索一覧（S02）。URLが唯一の状態で、条件変更は history.pushState で履歴に積む。
 * 戻る/進む・再読込で同じ条件とページを復元し、エラー時は既存の結果を残して再試行できる。
 */
export function SearchView({ initial, sourceIds }: { initial: SearchResponse; sourceIds: string[] }) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const knownSources = useMemo(() => new Set(sourceIds), [sourceIds]);
  const parsed = useMemo(() => parseSearchQuery(new URLSearchParams(searchParams?.toString() ?? ''), { sourceIds: knownSources }), [searchParams, knownSources]);
  const key = serializeQuery(parsed.query);

  // この画面を開いている間だけの結果キャッシュ（戻る/進むを即座に復元するため）
  const [cache] = useState(() => new Map<string, SearchResponse>([[initial.queryString, initial]]));
  const [initialKey] = useState(key);
  if (!cache.has(initialKey)) cache.set(initialKey, initial);

  const [latest, setLatest] = useState<SearchResponse>(initial);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // サーバーから新しい初期データが来た（別ページからの遷移など）ときは、それを最新として使う
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    cache.set(initial.queryString, initial);
    setLatest(initial);
  }
  // 条件が変わったら前の条件の通信エラー表示を消す（戻る/進むを含む）
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    if (errorKey !== null) setErrorKey(null);
  }
  const [retryCount, setRetryCount] = useState(0);
  const [notices, setNotices] = useState<QueryIssue[]>(initial.issues);
  const [showSkeleton, setShowSkeleton] = useState(false);
  // 検索画面は loading.tsx（Suspense）の内側にあるため、この画面自体の準備完了（hydration後）を別に示す
  const clientReady = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  const cached = cache.get(key);
  const result = cached ?? latest;
  const loading = !cached && errorKey !== key;
  const failed = !cached && errorKey === key;

  useEffect(() => {
    if (cache.has(key)) return;
    const controller = new AbortController();
    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 250);
    fetch(`/api/jobs${key ? `?${key}` : ''}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SearchResponse;
      })
      .then((data) => {
        cache.set(key, data);
        cache.set(data.queryString, data);
        setLatest(data);
        setErrorKey(null);
        if (data.issues.length > 0) setNotices(data.issues);
      })
      .catch(() => {
        if (!controller.signal.aborted) setErrorKey(key);
      })
      .finally(() => {
        clearTimeout(skeletonTimer);
        if (!controller.signal.aborted) setShowSkeleton(false);
      });
    return () => {
      clearTimeout(skeletonTimer);
      controller.abort();
    };
  }, [key, retryCount, cache]);

  // 検証で値を無視した場合・ページ番号を補正した場合は、URLを実際に適用した条件（正規形）に合わせる
  useEffect(() => {
    if (!cached) return;
    const current = window.location.search.replace(/^\?/, '');
    if (current !== cached.queryString) window.history.replaceState(null, '', hrefFor(cached.queryString));
  }, [cached, key]);

  const query = cached?.query ?? parsed.query;
  const heading = headingFor(query);

  useEffect(() => {
    document.title = `${heading}｜WORKLENS（開発仮称）`;
  }, [heading]);

  const navigate = useCallback((next: SearchQuery, options: { replace?: boolean } = {}) => {
    const href = hrefFor(serializeQuery(next));
    setNotices([]);
    if (options.replace) window.history.replaceState(null, '', href);
    else window.history.pushState(null, '', href);
  }, []);

  const onFilterChange = useCallback(
    (next: SearchQuery, meta?: FilterChangeMeta) => {
      navigate(next);
      // 結果の見出しより下までスクロールしている場合は、新しい結果の先頭に戻す
      const headingEl = resultsRef.current;
      if (headingEl && headingEl.getBoundingClientRect().top < 0) headingEl.scrollIntoView({ block: 'start' });
      track('filter_applied', { occupation: next.occupation, conditions: activeConditions(next).length });
      if (meta?.cleared && meta.cleared.length > 0) {
        toast(`${occupationLabel(meta.previousOccupation ?? '')}の専用条件（${meta.cleared.join('、')}）を解除しました。勤務地などの共通条件はそのままです。`);
      }
    },
    [navigate, toast],
  );

  const removeChip = (chip: ActiveCondition) => {
    if (chip.group === 'occupation' && Object.keys(query.facets).length > 0) {
      toast(`${occupationLabel(query.occupation ?? '')}の専用条件もあわせて解除しました。`);
    }
    onFilterChange(chip.without);
  };

  const clearAll = () => onFilterChange({ ...DEFAULT_QUERY, sort: query.sort === 'salary' ? 'relevance' : query.sort });

  const goToPage = (page: number) => {
    navigate(withPatch(query, { page }));
    resultsRef.current?.scrollIntoView({ block: 'start' });
    resultsRef.current?.focus({ preventScroll: true });
  };

  const chips = activeConditions(query, (id) => result.sources.find((s) => s.id === id)?.name ?? id);
  const priorityFacts = facetsForOccupation(query.occupation)
    .filter((def) => (query.facets[def.key]?.length ?? 0) > 0 && def.factLabel)
    .map((def) => def.factLabel as string);
  const firstIndex = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastIndex = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="page-container pb-8 pt-4 lg:pt-6" data-client-ready={clientReady ? 'true' : 'false'}>
      <nav aria-label="パンくずリスト" className="mb-3 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="text-muted">
              ホーム
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current={query.occupation ? undefined : 'page'}>{query.occupation ? <Link href="/jobs" className="text-muted">求人検索</Link> : '求人検索'}</li>
          {query.occupation ? (
            <>
              <li aria-hidden>/</li>
              <li aria-current="page">{occupationLabel(query.occupation)}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <CompactSearchBar
        key={`${query.q ?? ''}|${query.loc ?? ''}|${query.pref ?? ''}`}
        query={query}
        onSubmit={(q, loc) => {
          const parsedLoc = parseSearchQuery({ loc }).query;
          const next = withPatch(query, { q: q || null, loc: parsedLoc.loc, pref: parsedLoc.pref });
          navigate(next);
          track('search_submitted', { hasKeyword: Boolean(q), hasLocation: Boolean(loc), occupation: next.occupation });
        }}
      />

      <div className="mt-5 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside
          className="hidden rounded-[14px] border border-line bg-surface p-5 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain"
          aria-labelledby="filters-heading"
        >
          <h2 id="filters-heading" className="mb-4 text-base font-bold">
            条件を絞り込む
          </h2>
          <FilterPanel query={query} counts={result.facetCounts} sources={result.sources} onChange={onFilterChange} idPrefix="desktop" />
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 id="results-heading" ref={resultsRef} tabIndex={-1} className="text-2xl font-bold leading-snug text-wrap-anywhere outline-none lg:text-[32px]">
                {heading}
              </h1>
              <p className="mt-1 text-sm text-muted" aria-live="polite" data-testid="result-count">
                <span className="mr-1 text-2xl font-extrabold text-ink tabular-nums">{result.total}</span>件
                {result.total > 0 ? `（${firstIndex}〜${lastIndex}件を表示）` : ''}
                {loading ? '・更新中' : ''}
              </p>
            </div>
            <div>
              <label htmlFor="sort" className="mb-1 block text-xs font-bold text-muted">
                並び替え
              </label>
              <select
                id="sort"
                className="field-input max-w-[260px] text-sm"
                value={query.sort}
                aria-describedby="sort-description"
                onChange={(e) => onFilterChange(withPatch(query, { sort: e.target.value as SortValue }))}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === 'salary' && !query.salaryUnit}>
                    {o.label}
                    {o.value === 'salary' && !query.salaryUnit ? '（給与の単位を選ぶと使えます）' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted" id="sort-description">
            {SORT_DESCRIPTIONS[query.sort]}
          </p>

          {notices.length > 0 ? (
            <div className="mt-4 rounded-xl border border-warn/40 bg-warn-bg p-4 text-sm text-warn" role="status" data-testid="query-notices">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-bold">
                  <Info aria-hidden className="size-4 shrink-0" />
                  URLの一部の条件を使っていません
                </p>
                <button type="button" className="-m-2 inline-flex size-11 items-center justify-center" aria-label="お知らせを閉じる" onClick={() => setNotices([])}>
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-6">
                {notices.map((n) => (
                  <li key={`${n.param}-${n.value}`} className="text-wrap-anywhere">
                    {n.message}（{n.param}={n.value}）
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 lg:hidden">
            <FilterSheet query={query} counts={result.facetCounts} sources={result.sources} onApply={(next) => onFilterChange(next)} />
          </div>

          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="active-chips">
              <p className="sr-only">適用中の条件</p>
              <ul className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chip.id}>
                    <button
                      type="button"
                      onClick={() => removeChip(chip)}
                      aria-label={`条件「${chip.label}」を外す`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#c6d5ff] bg-[#edf2ff] px-3 text-xs font-bold text-[#234ab0] hover:border-primary"
                    >
                      <span className="text-wrap-anywhere">{chip.label}</span>
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={clearAll} className="inline-flex min-h-11 items-center px-1 text-xs font-bold text-primary underline-offset-4 hover:underline">
                条件をすべてクリア
              </button>
            </div>
          ) : null}

          {result.unknownNotes.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted" data-testid="unknown-notes">
              {result.unknownNotes.map((n) => (
                <li key={n.group} className="flex items-start gap-1.5">
                  <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    「{n.label}」の記載がない求人 {n.count}件は、この条件の結果に含めていません。
                    {n.group === 'salary' ? '（「給与の下限が記載されていない求人も含める」で表示できます）' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {failed ? (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger" data-testid="search-error">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert aria-hidden className="size-4" />
                検索結果を更新できませんでした。前回の結果を表示しています。
              </p>
              <Button
                variant="dangerOutline"
                size="sm"
                onClick={() => {
                  setErrorKey(null);
                  setRetryCount((n) => n + 1);
                }}
              >
                <RotateCcw aria-hidden className="size-4" />
                再試行
              </Button>
            </div>
          ) : null}

          <div className="mt-4" aria-busy={loading}>
            {loading && showSkeleton ? (
              <ResultsSkeleton />
            ) : (
              <>
                {result.promotions.length > 0 ? (
                  <section aria-labelledby="pr-heading" className="mb-4 rounded-[var(--radius-card)] border border-warn/40 bg-[#fffaf0] p-3 sm:p-4" data-testid="promotions">
                    <h2 id="pr-heading" className="mb-2 text-xs font-bold text-warn">
                      PR（広告枠・デモ表示／課金なし）：検索条件に合う求人だけを表示し、下の検索結果の並び順には影響しません
                    </h2>
                    {result.promotions.map((p) => (
                      <JobCard key={p.campaignId} job={p.job} promoted priorityFacts={priorityFacts} />
                    ))}
                  </section>
                ) : null}

                {result.total === 0 ? (
                  <EmptyState result={result} onNavigate={onFilterChange} onClearAll={clearAll} />
                ) : (
                  <ol className="flex flex-col gap-3" aria-label="検索結果">
                    {result.items.map((job) => (
                      <li key={job.id}>
                        <JobCard job={job} priorityFacts={priorityFacts} showPostedDate={query.sort === 'newest'} />
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>

          {result.pageCount > 1 ? <Pagination page={result.page} pageCount={result.pageCount} query={query} onPage={goToPage} /> : null}

          <p className="mt-6 rounded-xl border border-[#dce5ce] bg-note-bg p-4 text-xs leading-relaxed text-note-ink">
            公開情報をもとに条件を整理しています。「情報確認」は当サービスが掲載元の情報を確認した日時で、採用企業が募集継続を確認した意味ではありません。
            おすすめ順は条件の適合・情報の正確さ・鮮度・関連度で並べ、広告費で並び順を変えません。
          </p>
        </section>
      </div>
    </div>
  );
}

function CompactSearchBar({ query, onSubmit }: { query: SearchQuery; onSubmit: (q: string, loc: string) => void }) {
  const [q, setQ] = useState(query.q ?? '');
  const [loc, setLoc] = useState(query.loc ?? (query.pref ? (getPrefectureByCode(query.pref)?.name ?? '') : ''));
  return (
    <form
      role="search"
      aria-label="キーワードと勤務地で検索"
      className="grid gap-2 rounded-[14px] border border-line bg-surface p-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(q.trim(), loc.trim());
      }}
    >
      <div>
        <label htmlFor="search-q" className="mb-1 block text-xs font-bold text-muted">
          職種・キーワード
        </label>
        <input id="search-q" type="search" className="field-input" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} placeholder="職種、資格、企業名など" />
      </div>
      <div>
        <label htmlFor="search-loc" className="mb-1 block text-xs font-bold text-muted">
          勤務地
        </label>
        <input
          id="search-loc"
          type="text"
          className="field-input"
          maxLength={40}
          value={loc}
          list="search-loc-options"
          onChange={(e) => setLoc(e.target.value)}
          placeholder="都道府県・市区町村"
        />
        <datalist id="search-loc-options">
          {PREFECTURES.map((p) => (
            <option key={p.code} value={p.name} />
          ))}
        </datalist>
      </div>
      <Button type="submit" className="h-11">
        <Search aria-hidden className="size-4" />
        検索
      </Button>
    </form>
  );
}

function EmptyState({ result, onNavigate, onClearAll }: { result: SearchResponse; onNavigate: (q: SearchQuery) => void; onClearAll: () => void }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line bg-surface px-5 py-10 text-center" data-testid="empty-state">
      <h2 className="text-lg font-bold">条件に合う求人が見つかりませんでした</h2>
      <p className="mt-2 text-sm text-muted">条件を自動で変更することはありません。{result.relaxations.length > 0 ? '次の条件を外すと求人が見つかります。' : ''}</p>
      {result.relaxations.length > 0 ? (
        <ul className="mx-auto mt-4 flex max-w-md flex-col gap-2" data-testid="relaxations">
          {result.relaxations.map((r) => (
            <li key={r.group}>
              <a
                href={hrefFor(serializeQuery(r.query))}
                rel="nofollow"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(r.query);
                }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] border border-line px-4 text-left text-sm font-bold text-ink no-underline hover:border-primary hover:text-primary"
              >
                <span className="text-wrap-anywhere">{r.label}</span>
                <span className="shrink-0 text-xs text-muted">{r.count}件</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" className="mt-4" onClick={onClearAll}>
        条件をすべてクリア
      </Button>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="results-skeleton" aria-label="読み込み中">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-3 h-6 w-3/4" />
          <div className="skeleton mt-2 h-4 w-1/2" />
          <div className="skeleton mt-4 h-7 w-40" />
          <div className="skeleton mt-4 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function Pagination({ page, pageCount, query, onPage }: { page: number; pageCount: number; query: SearchQuery; onPage: (page: number) => void }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2);
  const link = (target: number, label: React.ReactNode, ariaLabel: string, disabled = false, current = false) =>
    disabled ? (
      <span aria-disabled="true" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-line px-3 text-sm text-muted opacity-50">
        {label}
      </span>
    ) : (
      <a
        href={hrefFor(serializeQuery(withPatch(query, { page: target })))}
        rel="nofollow"
        aria-label={ariaLabel}
        aria-current={current ? 'page' : undefined}
        onClick={(e) => {
          e.preventDefault();
          if (!current) onPage(target);
        }}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-[10px] border px-3 text-sm font-bold no-underline',
          current ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink hover:border-primary hover:text-primary',
        )}
      >
        {label}
      </a>
    );
  return (
    <nav aria-label="ページ" className="mt-6 flex flex-wrap items-center justify-center gap-2" data-testid="pagination">
      {link(page - 1, <ChevronLeft aria-hidden className="size-4" />, '前のページ', page <= 1)}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - (pages[i - 1] ?? p) > 1 ? <span className="px-1 text-muted">…</span> : null}
          {link(p, p, `${p}ページ目`, false, p === page)}
        </span>
      ))}
      {link(page + 1, <ChevronRight aria-hidden className="size-4" />, '次のページ', page >= pageCount)}
    </nav>
  );
}
