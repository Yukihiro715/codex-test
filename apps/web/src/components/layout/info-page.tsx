import { Badge } from '@/components/ui/badge';

/**
 * 運営会社・利用規約・情報の取扱い・収集方針などの説明ページ。
 * draft を渡したページは確定前であることをバッジで示す（例：法務確認前の利用規約）。
 */
export function InfoPage({ title, lead, draft, children }: { title: string; lead?: string; draft?: string; children: React.ReactNode }) {
  return (
    <div className="page-container pb-10 pt-6">
      <article className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        {draft ? (
          <Badge tone="warn" data-testid="draft-badge">
            {draft}
          </Badge>
        ) : null}
        <h1 className={`${draft ? 'mt-3 ' : ''}text-[28px] font-extrabold leading-snug lg:text-[32px]`}>{title}</h1>
        {lead ? <p className="mt-2 text-sm text-muted">{lead}</p> : null}
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </div>
  );
}
