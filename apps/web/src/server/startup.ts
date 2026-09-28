import 'server-only';
import { getConfig } from './env';
import { getRepository } from './repository';

/**
 * 起動時の検査（REL01）。本番環境でfixture（demo=true）を読み込む設定なら起動を止める。
 * 環境変数の不正（ENABLE_BILLING=true など未実装機能の有効化）もここで検出する。
 */
export function verifyStartupSafety(): void {
  const config = getConfig();
  getRepository();
  console.info(
    `[startup] DATA_MODE=${config.DATA_MODE} APP_ENV=${config.APP_ENV} ENABLE_LIVE_CRAWL=${config.ENABLE_LIVE_CRAWL} ENABLE_BILLING=${config.ENABLE_BILLING} ENABLE_JOBPOSTING=${config.ENABLE_JOBPOSTING}`,
  );
}

/** Node.jsランタイムでだけ呼ぶ。検査に失敗したらプロセスを終了する */
export function runStartupChecks(): void {
  try {
    verifyStartupSafety();
  } catch (error) {
    console.error('[startup] 起動前の検査に失敗したため停止します:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
