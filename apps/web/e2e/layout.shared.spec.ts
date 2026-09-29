import { expect, test } from '@playwright/test';
import { horizontalOverflow, open } from './helpers';

const PAGES = [
  '/',
  '/jobs',
  '/jobs?occupation=driver',
  '/jobs/demo-driver-4',
  '/jobs/demo-engineer-4',
  '/occupations/driver',
  '/compare?ids=demo-driver-4,demo-nurse-1,demo-engineer-4',
  '/saved',
  '/report?jobId=demo-driver-4',
  '/sources',
  '/employers',
  '/about',
  '/terms',
  '/privacy',
  '/login',
  '/login/help',
];

for (const path of PAGES) {
  test(`UI10 横にはみ出さない・デモ表示を常時出す: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, path);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('demo-banner')).toContainText('求人・企業・金額はすべて架空です');
    expect(errors).toEqual([]);
  });
}

test('UI10 長い求人タイトル・長い社名がカード内で折り返される', async ({ page }) => {
  await open(page, '/jobs?occupation=driver');
  const card = page.locator('[data-testid="job-card"][data-job-id="demo-driver-4"]');
  await expect(card).toBeVisible();
  const overflow = await card.evaluate((el) => {
    const title = el.querySelector('h3');
    return (title?.scrollWidth ?? 0) - (title?.clientWidth ?? 0) + (el.scrollWidth - el.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test('キーボードで検索結果の求人を開ける（focus可視）', async ({ page }) => {
  await open(page, '/jobs?occupation=nurse');
  const link = page.locator('[data-testid="job-card"] h3 a').first();
  const save = page.locator('[data-testid="job-card"]').first().getByRole('button', { name: /保存する$/ });
  // キーボード操作でフォーカスを移す（:focus-visible の表示を確認するため）
  await link.focus();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/jobs\/demo-nurse-/);
});
