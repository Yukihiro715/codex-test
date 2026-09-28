import { getOccupation, type FactMap } from '@worklens/domain';
import { cn } from '@/lib/utils';

export interface CardFact {
  label: string;
  value: string | null;
}

/** カードに出す職種別の条件（最初は3つまで）。絞り込み中の条件を優先して表示する */
export function cardFacts(occupation: string, facts: FactMap, priority: readonly string[] = [], limit = 3): CardFact[] {
  const order = [...priority.filter((p) => p in facts), ...(getOccupation(occupation)?.compareFields ?? []), ...Object.keys(facts)];
  const labels = [...new Set(order)].filter((label) => label in facts || (getOccupation(occupation)?.compareFields ?? []).includes(label));
  return labels.slice(0, limit).map((label) => {
    const value = facts[label];
    return { label, value: value === null || value === undefined ? null : Array.isArray(value) ? value.join(' / ') : String(value) };
  });
}

export function FactTags({ facts, className }: { facts: CardFact[]; className?: string }) {
  if (facts.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="主な条件">
      {facts.map((f) => (
        <li
          key={f.label}
          className={cn('rounded-md px-2.5 py-1 text-xs leading-5 text-wrap-anywhere', f.value === null ? 'bg-warn-bg text-warn' : 'bg-[#f1f5f8] text-ink')}
        >
          {f.label}：{f.value ?? '原文に記載なし'}
        </li>
      ))}
    </ul>
  );
}
