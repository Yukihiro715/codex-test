import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold leading-5', {
  variants: {
    tone: {
      info: 'bg-primary-soft text-primary-ink',
      neutral: 'bg-[#eef2f6] text-ink',
      warn: 'bg-warn-bg text-warn',
      pr: 'border border-warn bg-warn-bg text-warn',
      accent: 'bg-accent text-accent-ink',
      danger: 'bg-danger-soft text-danger',
      demo: 'bg-ink text-white',
    },
  },
  defaultVariants: { tone: 'info' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
