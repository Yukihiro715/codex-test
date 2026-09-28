import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('S04 facts_link は比較用の条件概要として表示し、本文を出さない（DATA09・SEO01）', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  await expect(page.getByTestId('display-mode')).toHaveText('比較用の条件概要');
  await expect(page.getByTestId('authorized-description')).toHaveCount(0);
  await expect(page.getByTestId('fact-table')).toContainText('手積み');
  // 表示中の主CTA（折りたたまれた「他の掲載元」のリンクは除く）
  const cta = page.getByRole('link', { name: '元の求人ページで確認' }).first();
  await expect(cta).toHaveText('元の求人ページで確認');
  await expect(cta).toHaveAttribute('href', '/out/demo-driver-1?placement=detail');
  await expect(cta).toHaveAttribute('rel', 'nofollow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

  const response = await page.request.get('/api/jobs/demo-driver-1');
  const body = (await response.json()) as { detail: { job: Record<string, unknown> } };
  expect(body.detail.job.authorizedDescription).toBeNull();
  expect(Object.keys(body.detail.job)).not.toContain('contentHash');
});

test('S04 full_authorized は許諾範囲の本文を表示する', async ({ page }) => {
  await open(page, '/jobs/demo-driver-2');
  await expect(page.getByTestId('display-mode')).toHaveText('掲載許諾のある詳細');
  await expect(page.getByTestId('authorized-description')).toContainText('架空の求人説明');
});

test('S04 他の掲載元を展開でき、給与は各掲載元の記載のまま（合成しない）', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  const other = page.getByTestId('other-listings');
  await other.locator('summary').click();
  await expect(other).toContainText('デモ人材紹介サイト（架空）');
  await expect(other).toContainText('月給 30万〜38万円');
  await expect(page.locator('article').getByText('月給').first()).toBeVisible();
});

test('S04 ハローワーク経由は応募方法の確認を案内する', async ({ page }) => {
  await open(page, '/jobs/demo-nurse-4');
  await expect(page.getByRole('link', { name: 'ハローワークで応募方法を確認' }).first()).toHaveAttribute('href', '/out/demo-nurse-4?placement=detail');
});

test('S04 鮮度の注意と、元公開日がない場合の初回検出日表示', async ({ page }) => {
  await open(page, '/jobs/demo-nurse-5');
  await expect(page.getByText('情報確認から時間が経っています').first()).toBeVisible();
  await expect(page.getByTestId('job-detail')).toContainText('初回検出日：2026/09/18（元の掲載開始日の記載なし）');
});

test('掲載終了の求人はCTAを出さず「掲載は終了しています」と表示する', async ({ page }) => {
  await open(page, '/jobs/demo-manufacturing-4');
  await expect(page.getByTestId('job-ended')).toContainText('この求人の掲載は終了しています');
  await expect(page.getByTestId('outbound-link')).toHaveCount(0);
  await expect(page.getByTestId('job-ended')).not.toContainText('時給');
  const api = await page.request.get('/api/jobs/demo-manufacturing-4');
  expect(api.status()).toBe(410);
});

test('削除依頼で非公開の求人は、存在しない求人と同じ最小限の表示（404）', async ({ page }) => {
  const response = await page.goto('/jobs/demo-office-4');
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId('job-unavailable')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('総務アシスタント');
  const api = await page.request.get('/api/jobs/demo-office-4');
  expect(api.status()).toBe(404);
  const unknown = await page.request.get('/api/jobs/no-such-job');
  expect(await api.json()).toEqual({ status: 'unavailable', id: 'demo-office-4' });
  expect(await unknown.json()).toEqual({ status: 'unavailable', id: 'no-such-job' });
});

test('外部遷移（GET /out）はデモでは移動せず、課金対象外として案内する（BILL01）', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  await page.getByRole('link', { name: '元の求人ページで確認' }).first().click();
  await expect(page).toHaveURL('/out/demo-driver-1?placement=detail');
  await expect(page.getByTestId('outbound-demo')).toContainText('外部サイトへは移動しません');
  await expect(page.getByTestId('outbound-destination')).toContainText('https://employer-driver-1.example/jobs/1');
  await expect(page.getByTestId('outbound-demo')).toContainText('課金対象外');

  await open(page, '/out/demo-manufacturing-4');
  await expect(page.getByTestId('outbound-unavailable')).toBeVisible();
});

test('S07 訂正・削除の申請：入力検査と受付番号', async ({ page }) => {
  await open(page, '/report?jobId=demo-driver-1');
  await expect(page.getByTestId('report-target')).toContainText('地場配送ドライバー');
  await expect(page.getByLabel(/対象ページのURL/)).toHaveValue('https://employer-driver-1.example/jobs/1');

  await page.getByRole('button', { name: '申請を送信する' }).click();
  await expect(page.getByText('申請の種類を選んでください')).toBeVisible();
  await expect(page.getByText('内容を入力してください')).toBeVisible();

  await page.getByRole('radio', { name: '掲載されている条件が違う' }).check();
  await page.getByLabel('内容').fill('給与の下限が掲載元と異なります（テスト）');
  await page.getByRole('checkbox', { name: '対応結果の連絡を希望する' }).check();
  await page.getByRole('button', { name: '申請を送信する' }).click();
  await expect(page.getByText('返信先のメールアドレスを入力してください')).toBeVisible();

  await page.getByLabel('返信先メールアドレス').fill('user@example.com');
  await page.getByRole('button', { name: '申請を送信する' }).click();
  await expect(page.getByTestId('report-receipt')).toContainText('申請を受け付けました');
  await expect(page.getByTestId('receipt-id')).toHaveText(/^RPT-\d{8}-[A-Z0-9]{6}$/);
  await expect(page.getByTestId('report-receipt')).toContainText('必要な対応を行います');
});

test('S03 職種ハブ：専用条件のショートカットと比較のポイント', async ({ page }) => {
  await open(page, '/occupations/driver');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ドライバーの仕事を、働き方から探す。');
  await expect(page.getByRole('link', { name: '毎日帰宅' })).toHaveAttribute('href', '/jobs?occupation=driver&home=daily');
  await page.getByRole('link', { name: '手積みなし' }).click();
  await expect(page).toHaveURL('/jobs?occupation=driver&manualLoading=no');
  await expect(page.getByRole('checkbox', { name: /手積みなし/ })).toBeChecked();
});

test('S01 ホーム：検索フォームと職種から探す', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('働き方の違いまで、');
  await page.getByLabel('職種・キーワード').fill('看護師');
  await page.getByLabel('勤務地').fill('東京');
  await page.getByRole('button', { name: '求人を探す' }).click();
  await page.waitForURL(/\/jobs\?/);
  await expect(page).toHaveURL('/jobs?q=%E7%9C%8B%E8%AD%B7%E5%B8%AB&pref=13');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('「看護師」（東京都）の求人');

  await open(page, '/');
  await page.getByRole('link', { name: /IT・エンジニア/ }).click();
  await expect(page).toHaveURL('/occupations/engineer');
});
