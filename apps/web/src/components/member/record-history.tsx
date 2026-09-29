'use client';

import { useEffect } from 'react';
import { useMember } from '@/components/member/member-provider';
import { recordHistory, useMemberPrefs } from '@/lib/member-lists';

/** 会員がログイン中で、履歴を残す設定のときだけ「最近見た求人」に記録する（デモはこのブラウザ内だけ） */
export function RecordHistory({ jobId }: { jobId: string }) {
  const { member } = useMember();
  const { history } = useMemberPrefs();
  useEffect(() => {
    if (member && history) recordHistory(jobId);
  }, [member, history, jobId]);
  return null;
}
