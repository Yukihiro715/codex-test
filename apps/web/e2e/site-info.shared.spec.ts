import { expect, test } from '@playwright/test';
import { open } from './helpers';

const OPERATOR = '株式会社プロセント（Prosent,Inc.）';
const ADDRESS = '〒104-0054 東京都中央区勝どき1-3-1-43F';

test('サイト名・運営会社・所在地をヘッダーとフッターに表示し、電話番号は載せない', async ({ page }) => {
  await open(page, '/');
  await expect(page).toHaveTitle(/^求人マップ（デモ）｜/);
  await expect(page.getByRole('link', { name: '求人マップ（デモ） ホーム' })).toBeVisible();

  const operator = page.getByTestId('footer-operator');
  await expect(operator).toContainText(OPERATOR);
  await expect(operator).toContainText(ADDRESS);
  const footerText = (await page.locator('footer').innerText()).replace(/\s+/g, ' ');
  expect(footerText).not.toContain('電話');
  expect(footerText).not.toMatch(/0\d{1,4}-\d{1,4}-\d{3,4}/);
  expect(footerText).not.toContain('未設定');

  const privacy = page.locator('footer').getByRole('link', { name: /^プライバシーポリシー/ });
  await expect(privacy).toHaveAttribute('href', 'https://prosent.co.jp/privacy-policy/');
  await expect(privacy).toHaveAttribute('target', '_blank');
  await expect(privacy).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('footer').getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/kyujinmap\.jp\/?$/);
});

test('ハローワークの求人を含むページに運営事業者を表示する', async ({ page }) => {
  await open(page, '/jobs/demo-nurse-4');
  await expect(page.getByTestId('page-operator')).toContainText(`このページの運営事業者：${OPERATOR}`);

  await open(page, '/jobs/demo-driver-1');
  await expect(page.getByTestId('page-operator')).toHaveCount(0);

  await open(page, '/jobs?occupation=nurse');
  await expect(page.getByTestId('page-operator')).toContainText(OPERATOR);
  await open(page, '/jobs?occupation=driver');
  await expect(page.getByTestId('page-operator')).toHaveCount(0);
});
