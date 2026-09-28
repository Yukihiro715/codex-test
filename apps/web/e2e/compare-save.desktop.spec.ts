import { expect, test } from '@playwright/test';
import { loginAdmin, open, resultCards, waitForClient } from './helpers';

test('UI07 4件目を比較に追加すると上限を案内し、既存の3件を消さない', async ({ page }) => {
  await open(page, '/jobs?occupation=driver');
  const cards = resultCards(page);
  for (let i = 0; i < 3; i += 1) {
    await cards.nth(i).getByRole('button', { name: /比較に追加する$/ }).click();
  }
  await expect(page.getByTestId('compare-tray')).toContainText('3/3件を比較中');

  await cards.nth(3).getByRole('button', { name: /比較に追加する$/ }).click();
  await expect(page.getByTestId('toast')).toContainText('比較できるのは3件までです');
  await expect(page.getByTestId('compare-tray')).toContainText('3/3件を比較中');
  for (let i = 0; i < 3; i += 1) {
    await expect(cards.nth(i).getByRole('button', { name: /比較から外す$/ })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(cards.nth(3).getByRole('button', { name: /比較に追加する$/ })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('link', { name: '違いを比較する' }).click();
  await expect(page).toHaveURL(/\/compare\?ids=[a-z0-9-]+,[a-z0-9-]+,[a-z0-9-]+$/);
  await expect(page.locator('thead th[scope="col"]')).toHaveCount(4);
});

test('比較表：異職種は「対象外」、違いだけ表示、列を外す', async ({ page }) => {
  await open(page, '/compare?ids=demo-driver-1,demo-nurse-1,demo-engineer-4');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('caption')).toContainText('求人3件の条件比較');
  await expect(page.locator('tr[data-row="fact:driver:配送範囲"] td').nth(1)).toHaveText('対象外');
  await expect(page.locator('tr[data-row="hours"] td').first()).toHaveText('原文に記載なし');

  await expect(page.locator('tr[data-row="employment"]')).toHaveCount(1);
  await page.getByTestId('diff-only').check();
  await expect(page.locator('tr[data-row="employment"]')).toHaveCount(0);
  // 不明同士は「違い」として扱わない
  await expect(page.locator('tr[data-row="hours"]')).toHaveCount(0);
  await expect(page.locator('tr[data-row="salary"]')).toHaveCount(1);

  await page.getByRole('button', { name: '外来看護師を比較から外す' }).click();
  await expect(page).toHaveURL('/compare?ids=demo-driver-1,demo-engineer-4');
  await expect(page.locator('thead th[scope="col"]')).toHaveCount(3);
});

test('比較：4件以上のURLは3件までにし、1件以下は説明と追加導線を出す', async ({ page }) => {
  await open(page, '/compare?ids=demo-driver-1,demo-driver-2,demo-driver-3,demo-driver-5');
  await expect(page.getByText('比較できるのは3件までです。4件目以降は表示していません。')).toBeVisible();
  await expect(page.locator('thead th[scope="col"]')).toHaveCount(4);

  await open(page, '/compare?ids=demo-driver-1');
  await expect(page.getByTestId('compare-empty')).toContainText('もう1件以上追加すると比較できます');
  await expect(page.getByRole('link', { name: '求人を探して追加する' })).toBeVisible();
});

test('UI08 保存して再読込しても、このブラウザで保存状態を維持する', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  await page.getByRole('button', { name: '保存する' }).first().click();
  await expect(page.getByTestId('toast')).toContainText('このブラウザに保存しました');
  await expect(page.getByTestId('saved-count')).toContainText('1');

  await page.reload();
  await waitForClient(page);
  await expect(page.getByTestId('saved-count')).toContainText('1');
  await expect(page.getByRole('button', { name: '保存済み' }).first()).toHaveAttribute('aria-pressed', 'true');

  await open(page, '/saved');
  await expect(page.locator('[data-testid="job-card"][data-job-id="demo-driver-1"]')).toBeVisible();
  await expect(page.getByText('他の端末やブラウザには引き継がれません')).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('worklens:saved:v1'));
  expect(JSON.parse(stored ?? '[]')).toEqual(['demo-driver-1']);
});

test('UI09 保存済み求人が非公開・掲載終了になったら、原稿を再表示せず最小限の表示にする', async ({ page }) => {
  await open(page, '/');
  await page.evaluate(() => localStorage.setItem('worklens:saved:v1', JSON.stringify(['demo-driver-1', 'demo-manufacturing-4', 'demo-office-4'])));
  await open(page, '/saved');

  const suppressed = page.locator('[data-testid="saved-unavailable"][data-job-id="demo-office-4"]');
  await expect(suppressed).toContainText('非公開');
  await expect(suppressed).not.toContainText('総務アシスタント');
  await expect(suppressed).not.toContainText('月給');

  const ended = page.locator('[data-testid="saved-unavailable"][data-job-id="demo-manufacturing-4"]');
  await expect(ended).toContainText('掲載終了');
  await expect(ended).not.toContainText('時給');
  await expect(page.locator('[data-testid="job-card"][data-job-id="demo-driver-1"]')).toBeVisible();

  await suppressed.getByRole('button', { name: '保存から削除' }).click();
  await expect(suppressed).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('worklens:saved:v1') ?? '[]') as string[]);
  expect(stored).toEqual(['demo-driver-1', 'demo-manufacturing-4']);
});

test('UI09 保存後にソースが公開停止されると、保存一覧でも内容を出さない', async ({ page }) => {
  await open(page, '/');
  await page.evaluate(() => localStorage.setItem('worklens:saved:v1', JSON.stringify(['demo-driver-3'])));
  await open(page, '/saved');
  await expect(page.locator('[data-testid="job-card"][data-job-id="demo-driver-3"]')).toBeVisible();

  await loginAdmin(page);
  await page.getByRole('button', { name: 'デモ企業採用ページ群（事実情報のみ）の公開を停止する' }).click();
  await expect(page.getByTestId('toast')).toContainText('公開を停止しました');

  await open(page, '/saved');
  const item = page.locator('[data-testid="saved-unavailable"][data-job-id="demo-driver-3"]');
  await expect(item).toContainText('非公開');
  await expect(item).not.toContainText('長距離トラックドライバー');
});
