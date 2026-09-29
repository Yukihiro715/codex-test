import type { Metadata } from 'next';
import { MyPageView } from '@/components/member/mypage-view';
import { requireMemberPage } from '@/server/member';

export const metadata: Metadata = { title: 'マイページ', robots: { index: false, follow: false } };

/** マイページ（M0はデモ）。ログインしていなければログイン画面へ */
export default async function MyPage() {
  const member = await requireMemberPage('/mypage');
  return <MyPageView member={member} />;
}
