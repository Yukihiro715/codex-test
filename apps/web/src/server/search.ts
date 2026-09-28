import 'server-only';
import { parseSearchQuery, type QueryInput } from '@worklens/domain';
import type { SearchResponse } from '@worklens/data';
import { getRepository, getRequestContext } from './repository';

/** URLのクエリを検証して検索する（ページとAPIで共通）。URL由来の通知と検索時の通知をまとめて返す。 */
export async function runSearch(input: QueryInput): Promise<SearchResponse> {
  const repo = getRepository();
  const { query, issues } = parseSearchQuery(input, { sourceIds: repo.sourceIds() });
  const result = await repo.search(query, await getRequestContext());
  return { ...result, issues: [...issues, ...result.issues] };
}
