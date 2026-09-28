import Link from 'next/link';

/** 非公開（削除依頼・ソース停止など）と存在しないIDを区別しない最小限の案内 */
export default function JobNotFound() {
  return (
    <div className="page-container py-10">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center" data-testid="job-unavailable">
        <h1 className="text-xl font-bold">この求人は現在表示できません</h1>
        <p className="mt-3 text-sm text-muted">掲載が停止された、または存在しない求人です。内容は表示していません。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-5 font-bold text-white no-underline hover:bg-primary-hover">
            求人を探す
          </Link>
          <Link href="/saved" className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface px-5 font-bold text-ink no-underline">
            保存した求人へ
          </Link>
        </div>
      </div>
    </div>
  );
}
