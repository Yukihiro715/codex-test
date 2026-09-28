'use client';

import { useEffect } from 'react';

/** 画面の操作準備ができたことを示す属性（e2eテストで操作開始のタイミングに使う） */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
