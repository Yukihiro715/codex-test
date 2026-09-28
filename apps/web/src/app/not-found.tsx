import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-container py-12">
      <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">ページが見つかりません</h1>
        <p className="mt-3 text-sm text-muted">URLが変更されたか、削除された可能性があります。</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-primary px-5 font-bold text-white no-underline">
          ホームへ
        </Link>
      </div>
    </div>
  );
}
