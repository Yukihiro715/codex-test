'use client';

import { Check, Plus } from 'lucide-react';
import { COMPARE_LIMIT } from '@worklens/domain';
import { toggleCompare, useCompareIds } from '@/lib/local-lists';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/** 比較への追加・解除。4件目は既存を消さずに上限を案内する（UI07） */
export function CompareToggle({ jobId, title, className }: { jobId: string; title: string; className?: string }) {
  const ids = useCompareIds();
  const active = ids.includes(jobId);
  const { toast } = useToast();
  const onClick = () => {
    const result = toggleCompare(jobId);
    if (result === 'full') {
      toast(`比較できるのは${COMPARE_LIMIT}件までです。比較中の求人を外してから追加してください。`, { tone: 'warn' });
    } else if (result === 'added') {
      toast(`比較に追加しました（${ids.length + 1}/${COMPARE_LIMIT}件）`);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${title}を${active ? '比較から外す' : '比較に追加する'}`}
      className={cn(
        'relative z-10 inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-bold transition-colors',
        active ? 'border-[#9bb5ff] bg-primary-soft text-primary-ink' : 'border-line bg-surface text-ink hover:border-primary hover:text-primary',
        className,
      )}
    >
      {active ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
      <span>{active ? '比較中' : '比較に追加'}</span>
    </button>
  );
}
