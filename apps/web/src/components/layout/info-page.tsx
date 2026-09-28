import { Badge } from '@/components/ui/badge';

/** 運営者・収集方針・利用説明などの草案ページ（M2公開前に確定） */
export function InfoPage({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="page-container pb-10 pt-6">
      <article className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <Badge tone="warn">草案・本番公開前に確定</Badge>
        <h1 className="mt-3 text-[28px] font-extrabold leading-snug lg:text-[32px]">{title}</h1>
        {lead ? <p className="mt-2 text-sm text-muted">{lead}</p> : null}
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </article>
    </div>
  );
}
