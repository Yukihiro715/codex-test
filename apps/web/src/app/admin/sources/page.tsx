import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DISPLAY_MODE_LABELS, formatDateJst } from '@worklens/domain';
import type { AdminSourceRow } from '@worklens/data';
import { Badge } from '@/components/ui/badge';
import { AdminHeader } from '@/components/admin/admin-header';
import { LANE_LABELS, ROBOTS_LABELS } from '@/components/admin/labels';
import { ResetDemoButton, SourceControls } from '@/components/admin/source-controls';
import { requireAdminPage, readDemoState } from '@/server/admin';
import { getConfig } from '@/server/env';
import { getRepository, getRequestContext } from '@/server/repository';

export const metadata: Metadata = { title: 'ソース管理（デモ）', robots: { index: false, follow: false } };

export default async function AdminSourcesPage() {
  await requireAdminPage('/admin/sources');
  const ctx = await getRequestContext();
  const rows = await getRepository().listSources(ctx);
  const state = await readDemoState();
  const config = getConfig();
  const demoRows = rows.filter((r) => r.base.kind === 'demo');
  const candidateRows = rows.filter((r) => r.base.kind === 'candidate');
  const publicTotal = rows.reduce((sum, r) => sum + r.publicJobCount, 0);

  return (
    <div className="page-container pb-10 pt-6">
      <AdminHeader
        title="ソース別の収集・表示・停止"
        lead="収集・表示・SEO・広告化を個別に管理します。ここでの操作はこのブラウザのデモ表示にだけ反映されます（データは削除しません）。"
        breadcrumb={[{ href: '/admin/sources', label: 'ソース一覧' }]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">公開中の架空求人（デモ）</p>
          <p className="text-2xl font-extrabold" data-testid="admin-public-total">
            {publicTotal}件
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">実ソースのライブ収集</p>
          <p className="text-2xl font-extrabold">{config.ENABLE_LIVE_CRAWL ? '設定上は可' : 'すべてOFF'}</p>
          <p className="text-xs text-muted">ENABLE_LIVE_CRAWL={String(config.ENABLE_LIVE_CRAWL)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">取得成功率・最終成功</p>
          <p className="text-2xl font-extrabold">未計測</p>
          <p className="text-xs text-muted">M1の収集workerで計測</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <ResetDemoButton />
      </div>

      <section aria-labelledby="demo-sources" className="mt-6">
        <h2 id="demo-sources" className="text-lg font-bold">
          デモ用のソース（架空fixture）
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {demoRows.map((row) => (
            <li key={row.base.id}>
              <SourceCard row={row} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="candidate-sources" className="mt-8">
        <h2 id="candidate-sources" className="text-lg font-bold">
          実ソース候補（初期OFF・審査記録が揃うまで有効化不可）
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {candidateRows.map((row) => (
            <li key={row.base.id}>
              <SourceCard row={row} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-heading" className="mt-8">
        <h2 id="history-heading" className="text-lg font-bold">
          操作履歴（このブラウザ・最新12件）
        </h2>
        {state.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">まだ操作はありません。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm" data-testid="admin-history">
            {state.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="rounded-lg bg-surface px-3 py-2">
                {h.at.replace('T', ' ').slice(0, 19)}（UTC）／デモ管理者／{h.sourceId}／{h.action}
                {h.detail ? `（${h.detail}）` : ''}／{h.result === 'applied' ? '反映' : '却下（審査条件を満たさない）'}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-6 text-xs text-muted">抽出レビュー（A03）・訂正/削除の処理（A04）・在庫品質と送客（A05）はM1以降で実装します。</p>
    </div>
  );
}

function SourceCard({ row }: { row: AdminSourceRow }) {
  const s = row.source;
  return (
    <article className="rounded-[14px] border border-line bg-surface p-4 sm:p-5" data-testid={`source-card-${s.id}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={s.kind === 'demo' ? 'demo' : 'warn'}>{s.kind === 'demo' ? '架空' : '実ソース候補'}</Badge>
            <Badge tone="neutral">{LANE_LABELS[s.lane] ?? s.lane}</Badge>
            <Badge tone={s.publicEnabled ? 'info' : 'danger'}>{s.publicEnabled ? '公開中' : '公開停止中'}</Badge>
            {row.overridden ? <Badge tone="accent">デモで変更中</Badge> : null}
          </div>
          <h3 className="mt-2 text-base font-bold text-wrap-anywhere">
            <Link href={`/admin/sources/${s.id}`} className="inline-flex min-h-11 items-center gap-1 text-ink">
              {s.name}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted">公開件数</dt>
              <dd className="font-bold" data-testid={`public-count-${s.id}`}>
                {row.publicJobCount}件
              </dd>
            </div>
            <div>
              <dt className="text-muted">鮮度の注意表示</dt>
              <dd className="font-bold">{row.staleWarningCount}件</dd>
            </div>
            <div>
              <dt className="text-muted">確認不能で非表示</dt>
              <dd className="font-bold">{row.hiddenStaleCount}件</dd>
            </div>
            <div>
              <dt className="text-muted">表示方式</dt>
              <dd className="font-bold">{DISPLAY_MODE_LABELS[s.displayMode]}</dd>
            </div>
            <div>
              <dt className="text-muted">審査</dt>
              <dd className="font-bold">{s.reviewStatus === 'approved' ? `承認（${s.reviewId}）` : '未審査'}</dd>
            </div>
            <div>
              <dt className="text-muted">規約確認日</dt>
              <dd className="font-bold">{s.termsCheckedAt ? formatDateJst(s.termsCheckedAt) : '記録なし'}</dd>
            </div>
            <div>
              <dt className="text-muted">robots</dt>
              <dd className="font-bold">{ROBOTS_LABELS[s.robotsStatus] ?? s.robotsStatus}</dd>
            </div>
            <div>
              <dt className="text-muted">取得成功率・最終成功</dt>
              <dd className="font-bold">未計測（M1）</dd>
            </div>
          </dl>
          {row.publicBlockers.length > 0 ? (
            <div className="mt-2 rounded-lg bg-warn-bg p-2 text-xs text-warn">
              <p className="font-bold">公開を有効化できない理由</p>
              <ul className="list-disc pl-5">
                {row.publicBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 lg:w-64">
          <SourceControls
            sourceId={s.id}
            sourceName={s.name}
            publicEnabled={s.publicEnabled}
            fetchEnabled={s.fetchEnabled}
            displayMode={s.displayMode}
            maxDisplayMode={row.base.displayMode}
          />
        </div>
      </div>
    </article>
  );
}
