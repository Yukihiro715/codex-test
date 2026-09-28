import { expect, test } from '@playwright/test';
import { horizontalOverflow, open, resultTotal } from './helpers';

test('UI11 絞り込みシートはキーボードで開閉でき、Escで閉じると適用せず元のボタンへfocusを戻す', async ({ page }) => {
  await open(page, '/jobs');
  const trigger = page.getByTestId('open-filter-sheet');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByTestId('filter-sheet');
  await expect(sheet).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="filter-sheet"]')))).toBe(true);

  await sheet.locator('#sheet-occupation').selectOption('driver');
  await expect(sheet.getByTestId('occupation-filters')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL('/jobs');
  expect(await resultTotal(page)).toBe(32);
});

test('スマホの絞り込み：「この条件で表示」で入力中の条件だけを反映する', async ({ page }) => {
  await open(page, '/jobs');
  await page.getByTestId('open-filter-sheet').click();
  const sheet = page.getByTestId('filter-sheet');
  await sheet.locator('#sheet-occupation').selectOption('driver');
  await sheet.getByRole('checkbox', { name: /毎日帰宅（明記あり）/ }).check();
  await expect(sheet.getByTestId('apply-filters')).toHaveText('この条件で表示（4件）');
  await sheet.getByTestId('apply-filters').click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL('/jobs?occupation=driver&home=daily');
  await expect.poll(() => resultTotal(page)).toBe(4);
  await expect(page.getByTestId('active-chips')).toContainText('帰宅頻度：毎日帰宅（明記あり）');
});

test('スマホのメニュー：開いてEscで閉じ、元のボタンへfocusを戻す', async ({ page }) => {
  await open(page, '/');
  const button = page.getByRole('button', { name: 'メニューを開く' });
  await button.click();
  await expect(page.getByRole('dialog', { name: 'メニュー' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('スマホの求人詳細：画面下に固定CTAを表示する', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  const cta = page.getByTestId('mobile-cta');
  await expect(cta).toBeVisible();
  await expect(cta.getByTestId('outbound-link')).toHaveText('元の求人ページで確認');
});

test('スマホの比較表：表だけが横スクロールし、ページははみ出さない', async ({ page }) => {
  await open(page, '/compare?ids=demo-driver-1,demo-nurse-1,demo-engineer-4');
  const region = page.getByTestId('compare-table-region');
  const scrollable = await region.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrollable).toBe(true);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page.getByText('表は横にスクロールできます')).toBeVisible();
});
