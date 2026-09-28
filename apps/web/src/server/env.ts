import 'server-only';
import { z } from 'zod';
import { resolveAdminSecret } from './admin-auth';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const envSchema = z.object({
  /** demo = 架空fixture / live = 実データ（M1で実装） */
  DATA_MODE: z.enum(['demo', 'live']).default('demo'),
  /** 本番判定はNODE_ENVではなくこの値で行う（REL01） */
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
  ENABLE_LIVE_CRAWL: bool(false),
  ENABLE_BILLING: bool(false),
  ENABLE_JOBPOSTING: bool(false),
  /** デモの基準時刻。fixtureの鮮度計算を実行日に依存させない */
  DEMO_NOW: z
    .string()
    .default('2026-09-29T12:00:00Z')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'DEMO_NOW はISO 8601の日時で指定してください'),
  ADMIN_DEMO_LOGIN: bool(true),
  ADMIN_SESSION_SECRET: z.string().min(16).optional(),
  REPORT_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  REPORT_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`環境変数が不正です: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`);
    }
    if (parsed.data.ENABLE_BILLING) {
      throw new Error('ENABLE_BILLING=true はM3（広告契約・sandbox台帳）の実装まで使えません。');
    }
    cached = parsed.data;
  }
  return cached;
}

export function isDemoMode(): boolean {
  return getConfig().DATA_MODE === 'demo';
}

/** 現在時刻。デモでは固定の基準時刻を使う（表示・鮮度判定を再現可能にする） */
export function getNow(): Date {
  const config = getConfig();
  return config.DATA_MODE === 'demo' ? new Date(config.DEMO_NOW) : new Date();
}

/** 管理画面デモのセッション署名キー。本番では必須（未設定なら管理画面を使えない） */
export function getAdminSecret(): string | null {
  const config = getConfig();
  return resolveAdminSecret({ ADMIN_SESSION_SECRET: config.ADMIN_SESSION_SECRET, APP_ENV: config.APP_ENV });
}

/** デモ管理者ログインを使えるか（本番環境では常に不可） */
export function isAdminDemoLoginEnabled(): boolean {
  const config = getConfig();
  return config.ADMIN_DEMO_LOGIN && config.APP_ENV !== 'production' && config.DATA_MODE === 'demo';
}
