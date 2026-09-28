'use client';

export type TrackEventName =
  | 'search_submitted'
  | 'filter_applied'
  | 'job_viewed'
  | 'saved_toggled'
  | 'compare_opened'
  | 'outbound_clicked'
  | 'report_submitted';

type TrackProps = Record<string, string | number | boolean | null>;

interface TrackedEvent {
  event: TrackEventName;
  props: TrackProps;
  at: number;
}

declare global {
  interface Window {
    __WORKLENS_EVENTS__?: TrackedEvent[];
  }
}

/**
 * 基本イベントの記録（M0）。外部analyticsへは送信せず、ブラウザ内に最大100件だけ保持する。
 * 自由記述の検索語などは渡さない（呼び出し側でコード化した値・件数だけを渡す）。
 */
export function track(event: TrackEventName, props: TrackProps = {}): void {
  if (typeof window === 'undefined') return;
  const list = (window.__WORKLENS_EVENTS__ ??= []);
  list.push({ event, props, at: Date.now() });
  if (list.length > 100) list.shift();
}
