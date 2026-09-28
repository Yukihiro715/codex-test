'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toggleSaved, useSavedIds } from '@/lib/local-lists';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';

/** 保存の切り替え（このブラウザのlocalStorageにIDだけを保存） */
export function SaveButton({ jobId, title, variant = 'icon', className }: { jobId: string; title: string; variant?: 'icon' | 'full'; className?: string }) {
  const saved = useSavedIds().includes(jobId);
  const { toast } = useToast();
  const Icon = saved ? BookmarkCheck : Bookmark;
  const onClick = () => {
    const next = toggleSaved(jobId);
    track('saved_toggled', { saved: next });
    toast(next ? 'このブラウザに保存しました（他の端末には引き継がれません）' : '保存を解除しました');
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={variant === 'icon' ? `${title}を${saved ? '保存済み（解除する）' : '保存する'}` : undefined}
      className={cn(
        'relative z-10 inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border text-sm font-bold transition-colors',
        variant === 'icon' ? 'size-11' : 'px-4',
        saved ? 'border-[#abc0ff] bg-primary-soft text-primary-ink' : 'border-line bg-surface text-ink hover:border-primary hover:text-primary',
        className,
      )}
    >
      <Icon aria-hidden className="size-5" />
      {variant === 'full' ? <span>{saved ? '保存済み' : '保存する'}</span> : null}
    </button>
  );
}
