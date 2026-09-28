import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] text-center font-bold leading-tight no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'border border-primary bg-primary text-white hover:bg-primary-hover',
        secondary: 'border border-line bg-surface text-ink hover:border-primary hover:text-primary',
        selected: 'border border-[#9bb5ff] bg-primary-soft text-primary-ink',
        ghost: 'border border-transparent bg-transparent text-ink hover:bg-page',
        link: 'min-h-11 px-1 text-primary underline-offset-4 hover:underline',
        danger: 'border border-danger bg-danger text-white hover:bg-[#9a1d13]',
        dangerOutline: 'border border-danger bg-surface text-danger hover:bg-danger-soft',
        accent: 'border border-accent bg-accent text-accent-ink hover:bg-[#dff0a0]',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-[15px]',
        lg: 'px-6 py-3 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...(asChild ? {} : { type: type ?? 'button' })} {...props} />;
}
