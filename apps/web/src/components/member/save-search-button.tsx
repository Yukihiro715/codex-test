'use client';

import Link from 'next/link';
import { BellPlus, Check } from 'lucide-react';
import { serializeQuery, type SearchQuery } from '@worklens/domain';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useMember } from '@/components/member/member-provider';
import { saveSearch, useSavedSearches } from '@/lib/member-lists';

/**
 * 「この条件を保存」（会員機能のデモ）。ログイン中は検索条件を保存し、マイページで新着メールを設定できる。
 * ログインしていなければログイン画面へ（戻り先はこの検索結果）。ログインの入口がない環境では出さない。
 */
export function SaveSearchButton({ query }: { query: SearchQuery }) {
  const { loginAvailable, status, member } = useMember();
  const saved = useSavedSearches();
  const { toast } = useToast();
  if (!loginAvailable) return null;

  const queryString = serializeQuery({ ...query, page: 1 });
  const isSaved = saved.some((s) => s.query === queryString);

  if (status === 'loading') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <BellPlus aria-hidden className="size-4" />
        この条件を保存
      </Button>
    );
  }

  if (!member) {
    const next = queryString ? `/jobs?${queryString}` : '/jobs';
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })} data-testid="save-search">
        <BellPlus aria-hidden className="size-4" />
        この条件を保存
      </Link>
    );
  }

  if (isSaved) {
    return (
      <Link href="/mypage#saved-searches" className={buttonVariants({ variant: 'selected', size: 'sm' })} data-testid="save-search">
        <Check aria-hidden className="size-4" />
        保存済みの条件
      </Link>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      data-testid="save-search"
      onClick={() => {
        const result = saveSearch(queryString);
        if (result === 'added' || result === 'exists') toast('検索条件を保存しました。マイページで新着メールの設定ができます。');
        else if (result === 'full') toast('保存できる検索条件は20件までです。マイページで不要な条件を削除してください。', { tone: 'warn' });
        else toast('この検索条件は保存できませんでした。', { tone: 'warn' });
      }}
    >
      <BellPlus aria-hidden className="size-4" />
      この条件を保存
    </Button>
  );
}
