import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DISPLAY_MODE_LABELS, formatDateJst } from '@worklens/domain';
import { AdminHeader } from '@/components/admin/admin-header';
import { SourceControls } from '@/components/admin/source-controls';
import { requireAdminPage, readDemoState } from '@/server/admin';
import { getRepository, getRequestContext } from '@/server/repository';
import { LANE_LABELS, ROBOTS_LABELS } from '@/components/admin/labels';

export const metadata: Metadata = { title: 'ソースの詳細（デモ）', robots: { index: false, follow: false } };

const yesNo = (v: boolean) => (v ? '可' : '不可');

export default async function AdminSourceDetailPage({ params }: PageProps<'/admin/sources/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/admin/sources/${id}`);
  const row = await getRepository().getSource(id, await getRequestContext());
  if (!row) notFound();
  const s = row.source;
  const history = (await readDemoState()).history.filter((h) => h.sourceId === id);

  const sections: { title: string; items: [string, string][] }[] = [
    {
      title: '対象範囲',
      items: [
        ['ソースID', s.id],
        ['種別', s.kind === 'demo' ? '架空fixture' : '実ソース候補'],
        ['レーン', LANE_LABELS[s.lane] ?? s.lane],
        ['対象ホスト', s.hosts.length > 0 ? s.hosts.join(', ') : '未登録'],
        ['対象パス', s.allowedPaths.length > 0 ? s.allowedPaths.join(', ') : '未登録'],
      ],
    },
    {
      title: '審査と根拠',
      items: [
        ['審査状態', s.reviewStatus],
        ['審査記録ID', s.reviewId ?? '記録なし'],
        ['審査の有効期限', s.reviewExpiresAt ? formatDateJst(s.reviewExpiresAt) : '設定なし'],
        ['規約URL', s.termsUrl ?? '記録なし'],
        ['規約確認日', s.termsCheckedAt ? formatDateJst(s.termsCheckedAt) : '記録なし'],
        ['robots', ROBOTS_LABELS[s.robotsStatus] ?? s.robotsStatus],
      ],
    },
    {
      title: '取得上限（自社の上限。相手の許可条件が厳しい場合はそちらを優先）',
      items: [
        ['1日あたりのリクエスト上限（ホスト単位）', `${s.maxRequestsPerHostPerDay}件`],
        ['同時接続数（ホスト単位）', `${s.maxConcurrencyPerHost}`],
        ['リクエスト間隔', `${s.minRequestIntervalMs / 1000}秒以上`],
        ['レスポンス上限', `${Math.round(s.maxResponseBytes / 1024 / 1024)}MB`],
        ['確認不能で非表示にするまで', `${s.staleHideAfterHours}時間`],
      ],
    },
    {
      title: '保存と表示の権限',
      items: [
        ['原文の保存', s.storageMode === 'facts_only' ? '事実項目のみ（原文は保持しない）' : s.storageMode],
        ['原文の保持時間', `${s.rawRetentionHours}時間`],
        ['表示方式', DISPLAY_MODE_LABELS[s.displayMode]],
        ['公開するフィールド', s.publicFields.join(', ')],
        ['本文の表示', yesNo(s.displayMode === 'full_authorized')],
        ['画像の表示', yesNo(s.imageAllowed)],
        ['検索エンジンへの掲載（index）', yesNo(s.seoIndexAllowed)],
        ['JobPosting構造化データ', yesNo(s.jobPostingAllowed)],
        ['広告（PR）化', yesNo(s.commercialPromotionAllowed)],
      ],
    },
  ];

  return (
    <div className="page-container pb-10 pt-6">
      <AdminHeader
        title={s.name}
        lead={s.activationNote}
        breadcrumb={[
          { href: '/admin/sources', label: 'ソース一覧' },
          { href: `/admin/sources/${s.id}`, label: s.id },
        ]}
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[14px] border border-line bg-surface p-5">
              <h2 className="text-base font-bold">{section.title}</h2>
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14em)_1fr]">
                {section.items.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-bold text-wrap-anywhere">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="text-base font-bold">判定・操作の履歴（変更者つき）</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">このブラウザでの操作履歴はありません。M1で監査ログ（DB）に置き換えます。</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    {h.at.replace('T', ' ').slice(0, 19)}（UTC）／デモ管理者／{h.action}
                    {h.detail ? `（${h.detail}）` : ''}／{h.result === 'applied' ? '反映' : '却下'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="mt-4 space-y-4 lg:mt-0">
          <section className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-3 text-base font-bold">状態の操作</h2>
            <SourceControls
              sourceId={s.id}
              sourceName={s.name}
              publicEnabled={s.publicEnabled}
              fetchEnabled={s.fetchEnabled}
              displayMode={s.displayMode}
              maxDisplayMode={row.base.displayMode}
              showDisplaySelect
            />
            <p className="mt-3 text-xs text-muted">「公開停止」は検索・詳細・比較・外部遷移からの即時除外で、データの削除ではありません。データ削除は監査付きの別操作としてM1で実装します。</p>
          </section>
          <section className="rounded-[14px] border border-line bg-surface p-5 text-sm">
            <h2 className="mb-2 text-base font-bold">件数</h2>
            <p>公開中：{row.publicJobCount}件</p>
            <p>鮮度の注意表示：{row.staleWarningCount}件</p>
            <p>確認不能で非表示：{row.hiddenStaleCount}件</p>
            <p>掲載終了：{row.expiredCount}件</p>
            <p>削除依頼で非公開：{row.suppressedCount}件</p>
          </section>
          {row.publicBlockers.length > 0 || row.fetchBlockers.length > 0 ? (
            <section className="rounded-[14px] border border-warn/40 bg-warn-bg p-5 text-sm text-warn">
              <h2 className="mb-2 text-base font-bold">有効化できない理由</h2>
              <ul className="list-disc space-y-1 pl-5">
                {[...new Set([...row.publicBlockers, ...row.fetchBlockers])].map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
