'use client';

import { useEffect } from 'react';
import { track, type TrackEventName } from '@/lib/track';

/** 画面表示のイベントを1回だけ記録する（外部送信なし） */
export function TrackView({ event, props }: { event: TrackEventName; props: Record<string, string | number | boolean | null> }) {
  const serialized = JSON.stringify(props);
  useEffect(() => {
    track(event, JSON.parse(serialized) as Record<string, string | number | boolean | null>);
  }, [event, serialized]);
  return null;
}
