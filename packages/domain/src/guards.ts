export type AppEnv = 'local' | 'test' | 'staging' | 'production';
export type DataMode = 'demo' | 'live';

export class FixtureSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureSafetyError';
  }
}

/**
 * REL01：本番環境で架空fixtureを混在させない。
 * NODE_ENV だけで判定せず、明示の APP_ENV と、読み込んだレコードの demo フラグを検査する。
 */
export function assertFixtureSafety(input: { appEnv: AppEnv; dataMode: DataMode; demoRecordCount: number }): void {
  if (input.appEnv !== 'production') return;
  if (input.dataMode === 'demo') {
    throw new FixtureSafetyError('APP_ENV=production では DATA_MODE=demo で起動できません（架空fixtureの公開を防止）。');
  }
  if (input.demoRecordCount > 0) {
    throw new FixtureSafetyError(`APP_ENV=production で demo=true のレコードが ${input.demoRecordCount} 件読み込まれています。公開を停止します。`);
  }
}
