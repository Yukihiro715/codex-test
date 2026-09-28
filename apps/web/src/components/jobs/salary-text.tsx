import { describeSalary, type Salary } from '@worklens/domain';
import { cn } from '@/lib/utils';

/** 給与の表示。単位を必ず併記し、記載がない場合は「記載なし」と書く（色だけで示さない） */
export function SalaryText({ salary, size = 'lg', className }: { salary: Salary; size?: 'lg' | 'md'; className?: string }) {
  const d = describeSalary(salary);
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 font-extrabold tracking-tight', size === 'lg' ? 'text-[22px] sm:text-[23px]' : 'text-lg', className)}>
      <span className="text-sm font-bold tracking-normal">{d.unitLabel}</span>
      <span className={cn(d.unknown && 'text-base font-bold text-warn')}>{d.amountText}</span>
      {d.note ? <span className="text-xs font-bold tracking-normal text-muted">（{d.note}）</span> : null}
    </p>
  );
}
