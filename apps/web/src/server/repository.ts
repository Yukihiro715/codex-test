import 'server-only';
import { cookies } from 'next/headers';
import { assertFixtureSafety } from '@worklens/domain';
import { FixtureJobRepository, loadFixtureData, type JobRepository, type RepositoryContext } from '@worklens/data';
import { getConfig, getNow } from './env';
import { DEMO_STATE_COOKIE, decodeDemoState } from './demo-state';

let repository: JobRepository | undefined;

/**
 * 求人リポジトリ。M0はfixture実装のみ。
 * 本番環境（APP_ENV=production）でfixtureを読み込もうとした場合は起動を止める（REL01）。
 */
export function getRepository(): JobRepository {
  if (repository) return repository;
  const config = getConfig();
  if (config.DATA_MODE === 'live') {
    assertFixtureSafety({ appEnv: config.APP_ENV, dataMode: config.DATA_MODE, demoRecordCount: 0 });
    throw new Error('DATA_MODE=live はM1（PostgreSQL・検索エンジン・収集worker）で実装します。M0では DATA_MODE=demo で起動してください。');
  }
  const repo = new FixtureJobRepository(loadFixtureData());
  assertFixtureSafety({ appEnv: config.APP_ENV, dataMode: config.DATA_MODE, demoRecordCount: repo.demoRecordCount() });
  repository = repo;
  return repo;
}

/** 1リクエスト分の判定コンテキスト（時刻・管理デモでのソース停止状態） */
export async function getRequestContext(): Promise<RepositoryContext> {
  const jar = await cookies();
  const state = decodeDemoState(jar.get(DEMO_STATE_COOKIE)?.value);
  return { now: getNow(), sourceOverrides: state.overrides, liveCrawlEnabled: getConfig().ENABLE_LIVE_CRAWL };
}
