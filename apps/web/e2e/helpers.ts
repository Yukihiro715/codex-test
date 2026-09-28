import { expect, type Page } from '@playwright/test';

/** ページを開き、クライアントの準備（hydration）ができるまで待つ */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForClient(page);
}

/** ルートの準備完了に加え、Suspense内の画面（data-client-ready）の準備完了も待つ */
export async function waitForClient(page: Page): Promise<void> {
  await expect(page.locator('html[data-hydrated="true"]')).toHaveCount(1);
  await expect(page.locator('[data-client-ready="false"]')).toHaveCount(0);
}

/** 検索結果の件数（aria-liveの件数表示から読む） */
export async function resultTotal(page: Page): Promise<number> {
  const text = await page.getByTestId('result-count').locator('span').first().textContent();
  return Number(text?.trim());
}

/** 検索結果のカード（PR枠を除く） */
export function resultCards(page: Page) {
  return page.getByRole('list', { name: '検索結果' }).getByTestId('job-card');
}

export async function resultIds(page: Page): Promise<string[]> {
  return resultCards(page).evaluateAll((cards) => cards.map((c) => c.getAttribute('data-job-id') ?? ''));
}

export async function loginAdmin(page: Page, next = '/admin/sources'): Promise<void> {
  await open(page, `/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByRole('button', { name: 'デモ管理者としてログイン' }).click();
  await page.waitForURL(`**${next}`);
  await waitForClient(page);
}

/** ページ全体が横にはみ出していないか（比較表の内部スクロールは除く） */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
