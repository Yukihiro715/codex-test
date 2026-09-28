'use client';

import { RotateCcw } from 'lucide-react';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-container py-12">
      <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center" role="alert">
        <h1 className="text-xl font-bold">表示中にエラーが発生しました</h1>
        <p className="mt-3 text-sm text-muted">時間をおいて再度お試しください。問題が続く場合は、ページを再読み込みしてください。</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-primary px-5 font-bold text-white hover:bg-primary-hover"
        >
          <RotateCcw aria-hidden className="size-4" />
          再試行
        </button>
      </div>
    </div>
  );
}
