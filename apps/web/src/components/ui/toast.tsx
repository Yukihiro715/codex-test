'use client';

import * as React from 'react';
import { X } from 'lucide-react';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'warn';
}

interface ToastApi {
  toast: (text: string, options?: { tone?: 'info' | 'warn' }) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/**
 * 画面下部の通知。aria-live で読み上げ、比較トレーの上に表示する。
 * 新しい通知は前の通知を置き換える（重ねて表示しない）。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<ToastMessage | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = React.useRef(0);

  const toast = React.useCallback<ToastApi['toast']>((text, options) => {
    counter.current += 1;
    setMessage({ id: counter.current, text, tone: options?.tone ?? 'info' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 6000);
  }, []);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4" role="status" aria-live="polite" aria-atomic="true">
        {message ? (
          <div
            key={message.id}
            data-testid="toast"
            className={
              'pointer-events-auto flex max-w-[min(560px,calc(100vw-32px))] items-start gap-3 rounded-[10px] px-4 py-3 text-sm leading-relaxed shadow-[0_5px_30px_rgba(0,0,0,0.18)] ' +
              (message.tone === 'warn' ? 'border border-warn bg-warn-bg text-warn' : 'bg-ink text-white')
            }
          >
            <span className="text-wrap-anywhere">{message.text}</span>
            <button
              type="button"
              className="-my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
              aria-label="通知を閉じる"
              onClick={() => setMessage(null)}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast は ToastProvider の中で使ってください');
  return context;
}
