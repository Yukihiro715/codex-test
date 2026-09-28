import { expect, test } from '@playwright/test';
import { loginAdmin, open, resultIds } from './helpers';

test('SEC04 未ログインでは管理APIが401、管理画面はログインへ（画面の非表示だけに頼らない）', async ({ page, request, baseURL }) => {
  const list = await request.get('/api/admin/sources');
  expect(list.status()).toBe(401);
  const pause = await request.post('/api/admin/sources/demo_agency/pause', { headers: { Origin: baseURL ?? '' } });
  expect(pause.status()).toBe(401);

  await page.goto('/admin/sources');
  await expect(page).toHaveURL('/admin/login?next=%2Fadmin%2Fsources');

  // 偽造したCookieでは通らない
  await page.context().addCookies([{ name: 'wl_admin', value: 'v1.9999999999.forged', url: baseURL ?? '' }]);
  const forged = await page.request.get('/api/admin/sources');
  expect(forged.status()).toBe(401);
});

test('OPS01 ソースの公開停止は検索・詳細・API・外部遷移に即時反映し、再開で戻る', async ({ page }) => {
  await loginAdmin(page);
  await expect(page.getByTestId('public-count-demo_employer_facts')).toHaveText(/\d+件/);

  await page.getByRole('button', { name: 'デモ企業採用ページ群（事実情報のみ）の公開を停止する' }).click();
  await expect(page.getByTestId('toast')).toContainText('公開を停止しました');
  await expect(page.getByTestId('source-card-demo_employer_facts')).toContainText('公開停止中');
  await expect(page.getByTestId('public-count-demo_employer_facts')).toHaveText('0件');

  const search = await page.request.get('/api/jobs?occupation=driver');
  const body = (await search.json()) as { items: { id: string; sourceId: string }[] };
  expect(body.items.some((j) => j.sourceId === 'demo_employer_facts')).toBe(false);
  expect(body.items.map((j) => j.id)).not.toContain('demo-driver-3');
  // 同一募集の別ソース（紹介会社）が公開中なら、その掲載元で表示される
  expect(body.items.find((j) => j.id === 'demo-driver-1')?.sourceId).toBe('demo_agency');
  expect((await page.request.get('/api/jobs/demo-driver-3')).status()).toBe(404);

  await open(page, '/jobs?occupation=driver');
  expect(await resultIds(page)).not.toContain('demo-driver-3');
  await open(page, '/out/demo-driver-3');
  await expect(page.getByTestId('outbound-unavailable')).toBeVisible();

  await open(page, '/admin/sources');
  await page.getByRole('button', { name: 'デモ企業採用ページ群（事実情報のみ）の公開を再開する' }).click();
  await expect(page.getByTestId('toast')).toContainText('公開を再開しました');
  await expect(page.getByTestId('source-card-demo_employer_facts')).toContainText('公開中');
  expect((await page.request.get('/api/jobs/demo-driver-3')).status()).toBe(200);
  await expect(page.getByTestId('admin-history')).toContainText('demo_employer_facts／pause／反映');
});

test('REL02 審査記録のない実ソース候補は、管理操作でも有効化できない', async ({ page }) => {
  await loginAdmin(page);
  const card = page.getByTestId('source-card-engage_review');
  await expect(card).toContainText('公開停止中');
  await expect(card).toContainText('公開を有効化できない理由');

  await page.getByRole('button', { name: 'エンゲージ・範囲確認候補の公開を再開する' }).click();
  await expect(page.getByTestId('toast')).toContainText('有効化できません');
  await expect(card).toContainText('公開停止中');

  await page.getByRole('button', { name: 'エンゲージ・範囲確認候補の収集を有効化する' }).click();
  await expect(page.getByTestId('toast')).toContainText('ENABLE_LIVE_CRAWL=false');
  await expect(card).toContainText('収集：OFF');

  const res = await page.request.post('/api/admin/sources/hellowork_public/resume', {
    headers: { Origin: new URL(page.url()).origin, 'Content-Type': 'application/json' },
    data: {},
  });
  expect(res.status()).toBe(409);
});

test('A02 ソース詳細：対象範囲・審査・取得上限・表示権限と、表示方式は上限より広げられない', async ({ page }) => {
  await loginAdmin(page, '/admin/sources/demo_employer_authorized');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('デモ企業採用ページ群（本文表示の許諾あり）');
  await expect(page.locator('main')).toContainText('1日あたりのリクエスト上限（ホスト単位）');
  await expect(page.locator('main')).toContainText('JobPosting構造化データ');

  await page.locator('#display-demo_employer_authorized').selectOption('facts_link');
  await expect(page.getByTestId('toast')).toContainText('表示方式を変更しました');
  await open(page, '/jobs/demo-driver-2');
  await expect(page.getByTestId('display-mode')).toHaveText('比較用の条件概要');
  await expect(page.getByTestId('authorized-description')).toHaveCount(0);

  const res = await page.request.post('/api/admin/sources/demo_employer_facts/display', {
    headers: { Origin: new URL(page.url()).origin },
    data: { displayMode: 'full_authorized' },
  });
  expect(res.status()).toBe(409);
});

test('OPS03 申請フォームへの大量リクエストはレート制限し、CSRFを拒否する', async ({ request, baseURL }) => {
  const origin = baseURL ?? '';
  const userAgent = `e2e-rate-limit-${Date.now()}-${Math.random()}`;
  const data = { jobId: 'demo-driver-1', type: 'incorrect', details: 'レート制限の確認', wantsReply: false };
  for (let i = 0; i < 5; i += 1) {
    const ok = await request.post('/api/reports', { data, headers: { Origin: origin, 'User-Agent': userAgent } });
    expect(ok.status()).toBe(201);
  }
  const limited = await request.post('/api/reports', { data, headers: { Origin: origin, 'User-Agent': userAgent } });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);

  const noOrigin = await request.post('/api/reports', { data, headers: { 'User-Agent': `${userAgent}-csrf` } });
  expect(noOrigin.status()).toBe(403);
  const crossOrigin = await request.post('/api/reports', { data, headers: { Origin: 'https://evil.example', 'User-Agent': `${userAgent}-csrf2` } });
  expect(crossOrigin.status()).toBe(403);

  const invalid = await request.post('/api/reports', {
    data: { ...data, details: '', wantsReply: true, email: 'no' },
    headers: { Origin: origin, 'User-Agent': `${userAgent}-invalid` },
  });
  expect(invalid.status()).toBe(400);
  const body = (await invalid.json()) as { fieldErrors: Record<string, string> };
  expect(Object.keys(body.fieldErrors).sort()).toEqual(['details', 'email']);
});
