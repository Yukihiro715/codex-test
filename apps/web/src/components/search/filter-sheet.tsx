'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { DEFAULT_QUERY, activeConditions, occupationLabel, serializeQuery, type FacetCounts, type SearchQuery } from '@worklens/domain';
import type { SearchResponse } from '@worklens/data';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { FilterPanel } from './filter-panel';

/**
 * スマホの絞り込み（下から出るシート）。入力中のdraftと適用済みの条件を区別し、
 * 「この条件で表示」でだけ反映する。「閉じる」・Esc・背景タップでは適用しない。
 */
export function FilterSheet({
  query,
  counts,
  sources,
  onApply,
}: {
  query: SearchQuery;
  counts: FacetCounts;
  sources: { id: string; name: string }[];
  onApply: (next: SearchQuery) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchQuery>(query);
  const [preview, setPreview] = useState<{ key: string; total: number; counts: FacetCounts } | null>(null);
  const { toast } = useToast();
  const draftKey = serializeQuery({ ...draft, page: 1 });
  const activeCount = activeConditions(query).length;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/jobs${draftKey ? `?${draftKey}` : ''}`, { signal: controller.signal, cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<SearchResponse>) : Promise.reject(new Error(String(res.status)))))
        .then((data) => setPreview({ key: draftKey, total: data.total, counts: data.facetCounts }))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, draftKey]);

  const previewReady = preview?.key === draftKey;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(query);
          setPreview(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full" data-testid="open-filter-sheet">
          <SlidersHorizontal aria-hidden className="size-5" />
          絞り込み{activeCount > 0 ? `（${activeCount}件の条件）` : ''}
        </Button>
      </DialogTrigger>
      <DialogContent side="bottom" closeLabel="閉じる（適用しない）" data-testid="filter-sheet">
        <div className="border-b border-line px-5 py-4 pr-16">
          <DialogTitle className="text-lg font-bold">条件を絞り込む</DialogTitle>
          <DialogDescription className="text-xs text-muted">「この条件で表示」を押すまで、検索結果は変わりません。</DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterPanel
            query={draft}
            counts={previewReady ? preview.counts : counts}
            sources={sources}
            idPrefix="sheet"
            onChange={(next, meta) => {
              setDraft(next);
              if (meta?.cleared && meta.cleared.length > 0) {
                toast(`${occupationLabel(meta.previousOccupation ?? '')}の専用条件（${meta.cleared.join('、')}）を解除しました。勤務地などの共通条件はそのままです。`);
              }
            }}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-surface px-5 py-3">
          <Button variant="ghost" onClick={() => setDraft({ ...DEFAULT_QUERY, sort: draft.sort })}>
            すべてクリア
          </Button>
          <Button
            className="flex-1"
            data-testid="apply-filters"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            この条件で表示{previewReady ? `（${preview.total}件）` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
