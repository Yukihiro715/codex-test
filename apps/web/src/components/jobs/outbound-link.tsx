'use client';

import { ExternalLink } from 'lucide-react';
import { outboundCtaLabel, type ApplicationRoute, type OutboundPlacement } from '@worklens/domain';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';

/**
 * 元の求人ページへの遷移。サーバー管理の遷移先（/out/:listingId）だけを使い、任意URLへ飛ばさない。
 * 通常の<a>なのでページのプリフェッチ対象にならない（GETでは課金しない）。
 */
export function OutboundLink({
  listingId,
  route,
  placement,
  className,
  label,
}: {
  listingId: string;
  route: ApplicationRoute;
  placement: OutboundPlacement;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={`/out/${encodeURIComponent(listingId)}?placement=${placement}`}
      rel="nofollow"
      data-testid="outbound-link"
      onClick={() => track('outbound_clicked', { placement, route })}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-primary bg-primary px-5 text-center font-bold leading-tight text-white no-underline hover:bg-primary-hover',
        className,
      )}
    >
      {label ?? outboundCtaLabel(route)}
      <ExternalLink aria-hidden className="size-4 shrink-0" />
    </a>
  );
}
