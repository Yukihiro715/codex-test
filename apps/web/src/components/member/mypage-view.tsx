'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Bookmark, History, LogOut, Mail, Search, Trash2, UserRound } from 'lucide-react';
import { activeConditions, formatDateJst, parseSearchQuery, type JobLookupItem } from '@worklens/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { logout, useMember } from '@/components/member/member-provider';
import { MEMBER_PROVIDERS, memberProviderName, type MemberSummary } from '@/lib/member';
import { useSavedIds } from '@/lib/local-lists';
import {
  clearMemberData,
  historyStore,
  removeSavedSearch,
  setSavedSearchAlert,
  updateMemberPrefs,
  useHistoryIds,
  useMemberPrefs,
  useSavedSearches,
  type MemberPrefs,
} from '@/lib/member-lists';

const SECTIONS = [
  { id: 'saved-jobs', label: '保存した求人', icon: Bookmark },
  { id: 'saved-searches', label: '保存した条件', icon: Search },
  { id: 'history', label: '最近見た求人', icon: History },
  { id: 'mail', label: 'メール配信', icon: Mail },
  { id: 'account', label: 'ログイン・退会', icon: UserRound },
] as const;

const SAVED_PREVIEW = 3;
const HISTORY_PREVIEW = 10;

/** 公開状態を確認して求人の見出しを取得する（掲載終了・非公開は最小限の表示） */
function useLookup(ids: readonly string[]): JobLookupItem[] | null {
  const key = ids.join(',');
  const [data, setData] = useState<{ key: string; items: JobLookupItem[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/jobs/lookup?ids=${encodeURIComponent(key)}`, { signal: controller.signal, cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: JobLookupItem[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((body) => setData({ key, items: body.items }))
      .catch(() => {});
    return () => controller.abort();
  }, [key]);
  if (!key) return [];
  return data?.key === key ? data.items : null;
}

/** 保存した検索条件ごとの現在の件数（デモでは新着の判定の代わりに該当件数を表示する） */
function useSearchTotals(queries: readonly string[]): Record<string, number> {
  const key = queries.join('\n');
  const [data, setData] = useState<{ key: string; totals: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const list = key.split('\n');
    Promise.all(
      list.map((q) =>
        fetch(`/api/jobs${q ? `?${q}` : ''}`, { signal: controller.signal, cache: 'no-store' })
          .then((res) => (res.ok ? (res.json() as Promise<{ total: number }>) : null))
          .then((body) => [q, body?.total ?? null] as const),
      ),
    )
      .then((entries) => setData({ key, totals: Object.fromEntries(entries.filter((e): e is readonly [string, number] => e[1] !== null)) }))
      .catch(() => {});
    return () => controller.abort();
  }, [key]);
  return data?.key === key ? data.totals : {};
}

function describeSavedSearch(query: string): string {
  const labels = activeConditions(parseSearchQuery(new URLSearchParams(query)).query).map((c) => c.label);
  return labels.length > 0 ? labels.join('・') : 'すべての求人';
}

function Section({ id, title, icon: Icon, children, action }: { id: string; title: string; icon: typeof Bookmark; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="flex items-center gap-2 text-lg font-bold">
          <Icon aria-hidden className="size-5 text-primary" />
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JobLine({ item }: { item: JobLookupItem }) {
  if (item.status === 'public') {
    return (
      <Link href={`/jobs/${item.job.id}`} className="block rounded-lg px-3 py-2.5 no-underline hover:bg-page">
        <span className="block font-bold text-ink text-wrap-anywhere">{item.job.title}</span>
        <span className="block text-xs text-muted text-wrap-anywhere">{item.job.employerName}</span>
      </Link>
    );
  }
  return (
    <p className="rounded-lg px-3 py-2.5 text-sm text-muted">
      <Badge tone="warn" className="mr-2">
        {item.status === 'expired' ? '掲載終了' : '表示できません'}
      </Badge>
      {item.status === 'expired' ? item.title : '掲載が終了したか、非公開になった求人です'}
    </p>
  );
}

function PrefCheckbox({ prefKey, label, hint, prefs }: { prefKey: keyof MemberPrefs; label: string; hint?: string; prefs: MemberPrefs }) {
  const id = `pref-${prefKey}`;
  return (
    <div>
      <label className="check-row font-bold" htmlFor={id}>
        <input id={id} type="checkbox" checked={prefs[prefKey]} onChange={(e) => updateMemberPrefs({ [prefKey]: e.target.checked })} />
        <span>{label}</span>
      </label>
      {hint ? <p className="pl-[30px] text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * マイページ（デモ）。保存した求人・保存した検索条件・最近見た求人・メール配信・ログイン方法・退会。
 * デモでは会員情報をこのブラウザにだけ保存する。本実装では会員ごとにサーバーへ保存し、端末どうしで同期する。
 */
export function MyPageView({ member }: { member: MemberSummary }) {
  const savedIds = useSavedIds();
  const searches = useSavedSearches();
  const historyIds = useHistoryIds();
  const prefs = useMemberPrefs();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const router = useRouter();
  const { refresh } = useMember();

  const savedPreviewIds = [...savedIds].reverse().slice(0, SAVED_PREVIEW);
  const historyPreviewIds = historyIds.slice(0, HISTORY_PREVIEW);
  const lookup = useLookup([...new Set([...savedPreviewIds, ...historyPreviewIds])]);
  const byId = new Map((lookup ?? []).map((item) => [item.status === 'public' ? item.job.id : item.id, item]));
  const totals = useSearchTotals(searches.map((s) => s.query));

  const signOut = async () => {
    await logout();
    await refresh();
    router.push('/');
  };
  const withdraw = async () => {
    clearMemberData();
    await logout();
    await refresh();
    router.push('/');
  };

  return (
    <div className="page-container pb-12 pt-4 lg:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold lg:text-[32px]">マイページ</h1>
          <p className="mt-1 text-sm text-muted" data-testid="mypage-member">
            {member.displayName}さん（{memberProviderName(member.provider)}でログイン中）
          </p>
        </div>
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut aria-hidden className="size-4" />
          ログアウト
        </Button>
      </div>
      {member.demo ? (
        <p className="mt-4 rounded-xl bg-page p-3 text-xs leading-relaxed text-muted" data-testid="mypage-demo-note">
          デモ：会員情報はこのブラウザにだけ保存し、サーバーには送りません。本番では、ログインした端末どうしで同期します。メールも送信しません。
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="マイページのメニュー" className="lg:sticky lg:top-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink no-underline hover:border-primary hover:text-primary"
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section
            id="saved-jobs"
            title="保存した求人"
            icon={Bookmark}
            action={
              <Link href="/saved" className="inline-flex min-h-11 items-center text-sm font-bold">
                すべて見る（{savedIds.length}件）
              </Link>
            }
          >
            {savedIds.length === 0 ? (
              <p className="text-sm text-muted">保存した求人はありません。求人の保存ボタンを押すと、ここに表示されます。</p>
            ) : (
              <ul className="divide-y divide-line-soft" data-testid="mypage-saved">
                {savedPreviewIds.map((id) => {
                  const item = byId.get(id);
                  return <li key={id}>{item ? <JobLine item={item} /> : <p className="px-3 py-2.5 text-sm text-muted">読み込み中…</p>}</li>;
                })}
              </ul>
            )}
          </Section>

          <Section id="saved-searches" title="保存した検索条件" icon={Search}>
            {searches.length === 0 ? (
              <p className="text-sm text-muted">
                検索結果の画面で「この条件を保存」を押すと、ここに表示されます。<Link href="/jobs">求人を探す</Link>
              </p>
            ) : (
              <ul className="space-y-3" data-testid="mypage-searches">
                {searches.map((search) => {
                  const total = totals[search.query];
                  const alertId = `alert-${search.query || 'all'}`;
                  return (
                    <li key={search.query} className="rounded-xl border border-line p-4" data-testid="saved-search">
                      <Link href={search.query ? `/jobs?${search.query}` : '/jobs'} className="font-bold text-wrap-anywhere">
                        {describeSavedSearch(search.query)}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {formatDateJst(search.savedAt)}に保存
                        {total !== undefined ? `・現在 ${total}件` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
                        <label className="check-row" htmlFor={alertId}>
                          <input id={alertId} type="checkbox" checked={search.alert} onChange={(e) => setSavedSearchAlert(search.query, e.target.checked)} />
                          <span>新着求人をメールで受け取る</span>
                        </label>
                        <Button variant="ghost" size="sm" onClick={() => removeSavedSearch(search.query)} aria-label={`${describeSavedSearch(search.query)}の保存を削除`}>
                          <Trash2 aria-hidden className="size-4" />
                          削除
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!prefs.newJobsMail && searches.some((s) => s.alert) ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-warn">
                <Bell aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                「メール配信の設定」で新着求人メールを停止しているため、メールは届きません。
              </p>
            ) : null}
          </Section>

          <Section
            id="history"
            title="最近見た求人"
            icon={History}
            action={
              historyIds.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => historyStore.set([])}>
                  <Trash2 aria-hidden className="size-4" />
                  履歴を削除
                </Button>
              ) : null
            }
          >
            {historyIds.length === 0 ? (
              <p className="text-sm text-muted">{prefs.history ? 'ログイン中に見た求人が、ここに表示されます。' : '閲覧履歴を残さない設定になっています。'}</p>
            ) : (
              <ul className="divide-y divide-line-soft" data-testid="mypage-history">
                {historyPreviewIds.map((id) => {
                  const item = byId.get(id);
                  return <li key={id}>{item ? <JobLine item={item} /> : <p className="px-3 py-2.5 text-sm text-muted">読み込み中…</p>}</li>;
                })}
              </ul>
            )}
            <div className="mt-3 border-t border-line-soft pt-3">
              <PrefCheckbox prefs={prefs} prefKey="history" label="閲覧履歴を残す" hint="オフにすると、これから見た求人を記録しません。" />
            </div>
          </Section>

          <Section id="mail" title="メール配信の設定" icon={Mail}>
            <div className="space-y-1" data-testid="mypage-mail">
              <PrefCheckbox prefs={prefs} prefKey="newJobsMail" label="保存した検索条件の新着求人" />
              <PrefCheckbox prefs={prefs} prefKey="recommendMail" label="おすすめ求人" />
              <PrefCheckbox prefs={prefs} prefKey="newsMail" label="求人マップからのお知らせ" />
            </div>
          </Section>

          <Section id="account" title="ログイン方法・退会" icon={UserRound}>
            <h3 className="text-sm font-bold">ログイン方法</h3>
            <ul className="mt-2 divide-y divide-line-soft rounded-xl border border-line" data-testid="mypage-providers">
              {MEMBER_PROVIDERS.map((provider) => (
                <li key={provider.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  <span className="font-bold">{provider.name}</span>
                  {provider.id === member.provider ? (
                    <Badge tone="info">ログインに使用中</Badge>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">追加は準備中</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line-soft pt-4">
              <h3 className="text-sm font-bold">退会</h3>
              <p className="mt-1 text-sm text-muted">保存した検索条件・閲覧履歴・メール配信の設定を削除して、ログアウトします。</p>
              <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                <Button variant="dangerOutline" className="mt-3" onClick={() => setWithdrawOpen(true)}>
                  退会する
                </Button>
                <DialogContent aria-describedby="withdraw-description">
                  <div className="p-6 pr-16">
                    <DialogTitle className="text-lg font-bold">退会しますか？</DialogTitle>
                    <DialogDescription id="withdraw-description" className="mt-2 text-sm text-muted">
                      保存した検索条件・閲覧履歴・メール配信の設定を削除し、ログアウトします。この操作は取り消せません。この端末の「保存した求人」は残ります。
                    </DialogDescription>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button variant="danger" onClick={() => void withdraw()}>
                        退会する
                      </Button>
                      <DialogClose asChild>
                        <Button variant="secondary">キャンセル</Button>
                      </DialogClose>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
