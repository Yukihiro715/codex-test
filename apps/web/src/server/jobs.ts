import 'server-only';
import { cache } from 'react';
import { getRepository, getRequestContext } from './repository';

/** 同じリクエスト内（metadataとページ）で求人の判定を1回にまとめる */
export const getJobForRequest = cache(async (id: string) => {
  const ctx = await getRequestContext();
  const repo = getRepository();
  const result = await repo.getJob(id, ctx);
  const sourceRow = result.status === 'public' ? await repo.getSource(result.detail.job.sourceId, ctx) : null;
  return { result, source: sourceRow?.source ?? null, now: ctx.now };
});
