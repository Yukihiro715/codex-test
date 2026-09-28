'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power, RotateCcw } from 'lucide-react';
import { DISPLAY_MODE_LABELS, displayModeAtMost, type DisplayMode } from '@worklens/domain';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

async function post(path: string, body?: unknown): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, message: data.message ?? (res.ok ? '更新しました。' : '操作できませんでした。') };
}

/**
 * ソースの公開・収集の操作。「公開停止」はデータ削除とは別の操作。
 * 有効化できるかはサーバー側で判定する（画面のボタン表示だけに頼らない）。
 */
export function SourceControls({
  sourceId,
  sourceName,
  publicEnabled,
  fetchEnabled,
  displayMode,
  maxDisplayMode,
  showDisplaySelect = false,
}: {
  sourceId: string;
  sourceName: string;
  publicEnabled: boolean;
  fetchEnabled: boolean;
  displayMode: DisplayMode;
  maxDisplayMode: DisplayMode;
  showDisplaySelect?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const run = async (action: string, body?: unknown) => {
    setPending(action);
    const result = await post(`/api/admin/sources/${sourceId}/${action}`, body);
    toast(result.message, { tone: result.ok ? 'info' : 'warn' });
    setPending(null);
    router.refresh();
  };

  const modes: DisplayMode[] = (['none', 'facts_link', 'full_authorized'] as DisplayMode[]).filter((m) => displayModeAtMost(m, maxDisplayMode) || m === displayMode);

  return (
    <div className="flex flex-col gap-3" data-testid={`source-controls-${sourceId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-sm font-bold">公開：{publicEnabled ? 'ON' : 'OFF'}</span>
        {publicEnabled ? (
          <Button variant="danger" size="sm" disabled={pending !== null} onClick={() => run('pause')} aria-label={`${sourceName}の公開を停止する`}>
            <Power aria-hidden className="size-4" />
            公開停止
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={pending !== null} onClick={() => run('resume')} aria-label={`${sourceName}の公開を再開する`}>
            公開を再開
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-sm font-bold">収集：{fetchEnabled ? 'ON' : 'OFF'}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending !== null}
          onClick={() => run(fetchEnabled ? 'fetch-off' : 'fetch-on')}
          aria-label={`${sourceName}の収集を${fetchEnabled ? '停止' : '有効化'}する`}
        >
          {fetchEnabled ? '収集を停止' : '収集を有効化'}
        </Button>
      </div>
      {showDisplaySelect ? (
        <div>
          <label htmlFor={`display-${sourceId}`} className="mb-1 block text-sm font-bold">
            表示方式（審査の上限：{DISPLAY_MODE_LABELS[maxDisplayMode]}）
          </label>
          <select
            id={`display-${sourceId}`}
            className="field-input max-w-sm"
            value={displayMode}
            disabled={pending !== null}
            onChange={(e) => run('display', { displayMode: e.target.value })}
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {DISPLAY_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        const result = await post('/api/admin/demo/reset');
        toast(result.message, { tone: result.ok ? 'info' : 'warn' });
        router.refresh();
      }}
    >
      <RotateCcw aria-hidden className="size-4" />
      デモの操作をリセット
    </Button>
  );
}
