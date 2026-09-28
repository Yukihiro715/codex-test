import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export function AdminHeader({ title, lead, breadcrumb }: { title: string; lead?: string; breadcrumb?: { href: string; label: string }[] }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="パンくずリスト" className="text-xs text-muted">
          <ol className="flex flex-wrap items-center gap-1">
            <li>管理（デモ）</li>
            {(breadcrumb ?? []).map((b) => (
              <li key={b.href} className="flex items-center gap-1">
                <span aria-hidden>/</span>
                <Link href={b.href} className="text-muted">
                  {b.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-muted underline-offset-4 hover:underline">
            ログアウト
          </button>
        </form>
      </div>
      <Badge tone="demo" className="mt-2">
        管理画面デモ
      </Badge>
      <h1 className="mt-2 text-[28px] font-extrabold leading-snug lg:text-[32px]">{title}</h1>
      {lead ? <p className="mt-1 text-sm text-muted">{lead}</p> : null}
    </div>
  );
}
