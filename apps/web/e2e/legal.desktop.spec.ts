import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('利用規約（草案）：条番号・参照・運営会社・草案表示', async ({ page }) => {
  await open(page, '/terms');
  await expect(page).toHaveTitle('利用規約｜求人マップ（デモ）');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('求人マップ 利用規約');
  await expect(page.getByTestId('draft-badge')).toContainText('法務確認前');

  const headings = page.getByTestId('terms-article').locator('h2');
  await expect(headings).toHaveCount(17);
  await expect(headings.first()).toHaveText('第1条（適用）');
  await expect(page.getByRole('heading', { name: '第7条（禁止事項）' })).toBeVisible();
  // 条番号は自動で振り、本文の参照とずれない
  await expect(page.getByTestId('terms-article').filter({ hasText: '第8条（利用の制限）' })).toContainText('第7条（禁止事項）に違反した場合');
  await expect(page.getByTestId('terms-article').filter({ hasText: '第12条（採用企業等との関係）' })).toContainText('第6条のフォーム');
  await expect(page.getByRole('heading', { name: '第6条（訂正・削除の申請とお問い合わせ）' })).toBeVisible();

  await expect(page.locator('main')).toContainText('職業紹介');
  await expect(page.locator('main')).toContainText('重大な過失を除く過失による行為にのみ適用');
  await expect(page.locator('main')).toContainText('株式会社プロセント（Prosent,Inc.）');
  await expect(page.locator('main')).toContainText('制定日：本番公開時に記載します');
});

test('求人マップにおける情報の取扱い：運営会社のポリシーへのリンクと利用目的', async ({ page }) => {
  await open(page, '/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('求人マップにおける情報の取扱い');
  await expect(page.getByTestId('draft-badge')).toBeVisible();
  await expect(page.getByTestId('corporate-privacy-link')).toHaveAttribute('href', 'https://prosent.co.jp/privacy-policy/');
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText(['情報', '取得のしかた', '利用目的', '保存期間']);
  await expect(table.getByRole('rowheader')).toHaveCount(6);
  await expect(page.locator('main')).toContainText('第三者へ情報を送信させるタグ');
});

test('運営会社：会社名・所在地・電話番号・問い合わせ窓口（届出受理番号は未確定のため出さない）', async ({ page }) => {
  await open(page, '/about');
  await expect(page.getByTestId('draft-badge')).toHaveCount(0);
  const operator = page.getByTestId('about-operator');
  await expect(operator).toContainText('株式会社プロセント（Prosent,Inc.）');
  await expect(operator).toContainText('〒104-0054 東京都中央区勝どき1-3-1-43F');
  await expect(operator).toContainText('電話番号03-6732-9992');
  await expect(operator).toContainText('求人マップ（kyujinmap.jp）');
  await expect(operator).not.toContainText('届出受理番号');
  await expect(operator.getByRole('link', { name: /お問い合わせ/ })).toHaveAttribute('href', '/report');
});

test('お問い合わせ：求人の指定なしで送れる。求人についての申請はURLが必要', async ({ page }) => {
  await open(page, '/report');
  await page.getByRole('radio', { name: '掲載されている条件が違う' }).check();
  await page.getByLabel('内容').fill('条件が違います（テスト）');
  await page.getByRole('button', { name: '申請を送信する' }).click();
  await expect(page.getByText('対象の求人ページのURLを入力してください')).toBeVisible();

  await page.getByRole('radio', { name: /サービスについてのお問い合わせ/ }).check();
  await expect(page.getByLabel(/対象ページのURL/)).toHaveAccessibleName(/（任意）/);
  await page.getByRole('button', { name: '申請を送信する' }).click();
  await expect(page.getByTestId('report-receipt')).toContainText('申請を受け付けました');
});

test('robots.txt と sitemap：デモでは sitemap を案内せず空にする', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /api/');
  expect(robots).not.toContain('Sitemap:');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('<loc>');
});
