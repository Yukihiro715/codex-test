'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * アクセシブルなダイアログ（Radix）。focus trap・Escで閉じる・元の要素へfocusを戻す。
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

type Side = 'bottom' | 'right' | 'center';

const sideClasses: Record<Side, string> = {
  bottom:
    'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px] pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-[sheet-up_180ms_ease-out]',
  right: 'inset-y-0 right-0 h-dvh w-[min(360px,88vw)] data-[state=open]:animate-[sheet-left_180ms_ease-out]',
  center: 'left-1/2 top-1/2 max-h-[88dvh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[18px]',
};

export function DialogContent({
  className,
  children,
  side = 'center',
  closeLabel = '閉じる',
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: Side; closeLabel?: string; showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#102338]/50" />
      <DialogPrimitive.Content
        className={cn('fixed z-50 flex flex-col overflow-hidden bg-surface text-ink shadow-[0_20px_70px_rgba(20,45,69,0.25)] outline-none', sideClasses[side], className)}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-lg bg-page text-ink hover:bg-line-soft"
            aria-label={closeLabel}
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
