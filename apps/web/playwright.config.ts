import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;

/**
 * e2e（受入テスト UI01〜UI12 ほか）。本番ビルドを起動して検証する。
 * E2E_SKIP_BUILD=1 で既存の .next を使う（npm run build 済みの場合）。
 * ブラウザは @playwright/test と同じ版のChromium（npx playwright install chromium）を使う。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /.*\.(desktop|shared)\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: /.*\.(mobile|shared)\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATA_MODE: 'demo',
      APP_ENV: 'test',
      ENABLE_LIVE_CRAWL: 'false',
      ENABLE_BILLING: 'false',
      ENABLE_JOBPOSTING: 'false',
      DEMO_NOW: '2026-09-29T12:00:00Z',
      REPORT_RATE_LIMIT: '5',
      REPORT_RATE_WINDOW_SECONDS: '600',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
