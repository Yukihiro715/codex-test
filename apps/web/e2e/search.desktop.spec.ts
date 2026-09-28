import { expect, test } from '@playwright/test';
import { open, resultCards, resultIds, resultTotal, waitForClient } from './helpers';

const sorted = (ids: string[]) => [...ids].sort();

test('UI01 キーワードと勤務地はAND条件で結果が変わり、URLに反映される', async ({ page }) => {
  await open(page, '/jobs');
  expect(await resultTotal(page)).toBe(32);

  await page.getByLabel('職種・キーワード').fill('配送');
  await page.getByRole('button', { name: '検索', exact: true }).click();
  await expect(page).toHaveURL(/\/jobs\?q=%E9%85%8D%E9%80%81$/);
  await expect.poll(() => resultTotal(page)).toBe(4);

  await page.getByLabel('勤務地', { exact: true }).fill('横浜');
  await page.getByRole('button', { name: '検索', exact: true }).click();
  await expect(page).toHaveURL(/q=%E9%85%8D%E9%80%81&loc=%E6%A8%AA%E6%B5%9C/);
  await expect.poll(() => resultIds(page)).toEqual(['demo-driver-2']);
});

test('UI02 職種を変えると専用条件だけ解除し、共通条件は保持して通知する', async ({ page }) => {
  await open(page, '/jobs?occupation=driver&manualLoading=no&home=daily&pref=13&emp=fulltime');
  await expect(page.getByRole('checkbox', { name: /手積みなし/ })).toBeChecked();

  await page.locator('#desktop-occupation').selectOption('nurse');
  await expect(page).toHaveURL('/jobs?pref=13&occupation=nurse&emp=fulltime');
  await expect(page.getByTestId('toast')).toContainText('ドライバーの専用条件（手積み：手積みなし（明記あり）、帰宅頻度：毎日帰宅（明記あり））を解除しました');
  await expect(page.locator('#desktop-pref')).toHaveValue('13');
  await expect(page.getByRole('checkbox', { name: '正社員' })).toBeChecked();
  await expect(page.getByTestId('occupation-filters')).toContainText('オンコール');
});

test('UI03 月給30万円以上：時給・年収・下限不明の求人を混ぜない', async ({ page }) => {
  await open(page, '/jobs');
  await expect(page.locator('#desktop-salary-min')).toBeDisabled();
  await page.locator('#desktop-salary-unit').selectOption('MONTH');
  await expect(page).toHaveURL(/salaryUnit=MONTH/);
  await page.locator('#desktop-salary-min').fill('300000');
  await page.locator('#desktop-salary-min').press('Enter');
  await expect(page).toHaveURL(/salaryUnit=MONTH&salaryMin=300000/);

  const ids = await resultIds(page);
  expect(ids.length).toBeGreaterThan(5);
  expect(ids).not.toContain('demo-driver-2'); // 月給28万〜
  expect(ids).not.toContain('demo-service-4'); // 月給の金額記載なし
  expect(ids).not.toContain('demo-engineer-1'); // 年収
  await expect(resultCards(page).filter({ hasText: /時給|年収/ })).toHaveCount(0);
  await expect(page.getByTestId('unknown-notes')).toContainText('「給与の下限」の記載がない求人 2件');

  const api = await page.request.get('/api/jobs?salaryUnit=MONTH&salaryMin=300000');
  const body = (await api.json()) as { items: { salary: { unit: string; min: number | null } }[] };
  for (const item of body.items) {
    expect(item.salary.unit).toBe('MONTH');
    expect(item.salary.min).not.toBeNull();
    expect(item.salary.min ?? 0).toBeGreaterThanOrEqual(300000);
  }
});

test('UI04 「オンコールなし」は明記のある求人だけ。不明は適合させず件数を示す', async ({ page }) => {
  await open(page, '/jobs?occupation=nurse');
  expect(await resultTotal(page)).toBe(5);
  await page.getByRole('checkbox', { name: /オンコールなし（明記あり）/ }).check();
  await expect(page).toHaveURL(/occupation=nurse&onCall=no/);
  await expect.poll(async () => sorted(await resultIds(page))).toEqual(['demo-nurse-1', 'demo-nurse-4']);
  await expect(page.getByTestId('unknown-notes')).toContainText('「オンコール」の記載がない求人 2件は、この条件の結果に含めていません。');
});

test('UI05 戻る/進む・再読込で条件とページを復元する', async ({ page }) => {
  await open(page, '/jobs');
  await page.locator('#desktop-occupation').selectOption('driver');
  await expect(page).toHaveURL('/jobs?occupation=driver');
  const daily = page.getByRole('checkbox', { name: /毎日帰宅/ });
  await daily.check();
  await expect(page).toHaveURL('/jobs?occupation=driver&home=daily');
  await expect.poll(() => resultTotal(page)).toBe(4);
  const dailyIds = await resultIds(page);

  await page.goBack();
  await expect(page).toHaveURL('/jobs?occupation=driver');
  await expect(daily).not.toBeChecked();
  await expect.poll(() => resultTotal(page)).toBe(5);

  await page.goForward();
  await expect(page).toHaveURL('/jobs?occupation=driver&home=daily');
  await expect(daily).toBeChecked();
  await expect.poll(() => resultIds(page)).toEqual(dailyIds);

  await page.reload();
  await waitForClient(page);
  await expect(page.getByRole('checkbox', { name: /毎日帰宅/ })).toBeChecked();
  expect(await resultIds(page)).toEqual(dailyIds);

  // ページ番号も復元する
  await open(page, '/jobs');
  const firstPage = await resultIds(page);
  await page.getByRole('link', { name: '2ページ目' }).click();
  await expect(page).toHaveURL('/jobs?page=2');
  await expect(page.getByRole('link', { name: '2ページ目' })).toHaveAttribute('aria-current', 'page');
  const secondPage = await resultIds(page);
  expect(secondPage).toHaveLength(12);
  await page.goBack();
  await expect(page).toHaveURL('/jobs');
  await expect.poll(() => resultIds(page)).toEqual(firstPage);
  await page.goForward();
  await expect.poll(() => resultIds(page)).toEqual(secondPage);
  await page.reload();
  await waitForClient(page);
  expect(await resultIds(page)).toEqual(secondPage);
});

test('UI06 0件では条件を自動で外さず、個別に緩める提案を出す', async ({ page }) => {
  await open(page, `/jobs?occupation=nurse&onCall=no&loc=${encodeURIComponent('横浜')}`);
  await expect(page.getByTestId('empty-state')).toBeVisible();
  expect(await resultTotal(page)).toBe(0);
  await expect(page).toHaveURL(/onCall=no/);
  await expect(page).toHaveURL(/loc=/);
  const relax = page.getByTestId('relaxations');
  await expect(relax).toContainText('勤務地「横浜」を外す');
  await expect(relax).toContainText('オンコール：オンコールなし（明記あり）を外す');

  await relax.getByRole('link', { name: /勤務地「横浜」を外す/ }).click();
  await expect(page).toHaveURL('/jobs?occupation=nurse&onCall=no');
  await expect.poll(() => resultTotal(page)).toBe(2);
});

test('UI12 PR枠：予算のある契約求人だけ「PR」と明記し、予算切れの求人は自然検索にだけ出る', async ({ page }) => {
  await open(page, '/jobs');
  const promotions = page.getByTestId('promotions');
  await expect(promotions).toBeVisible();
  await expect(promotions).toContainText('PR（広告枠・デモ表示／課金なし）');
  await expect(promotions.getByTestId('promoted-card')).toHaveAttribute('data-job-id', 'demo-engineer-2');
  await expect(promotions.getByTestId('promoted-card').getByText('PR', { exact: true })).toBeVisible();

  await open(page, '/jobs?occupation=nurse');
  await expect(page.getByTestId('promotions')).toHaveCount(0);
  expect(await resultIds(page)).toContain('demo-nurse-2');

  // 条件に合わない場合はPRも出さない
  await open(page, '/jobs?occupation=driver');
  await expect(page.getByTestId('promotions')).toHaveCount(0);
});

test('通信エラーでは既存の結果を残し、再試行できる', async ({ page }) => {
  await open(page, '/jobs');
  const before = await resultIds(page);
  const searchApi = (url: URL) => url.pathname === '/api/jobs';
  await page.route(searchApi, (route) => route.abort());
  await page.locator('#desktop-occupation').selectOption('driver');
  await expect(page.getByTestId('search-error')).toBeVisible();
  expect(await resultIds(page)).toEqual(before);

  await page.unroute(searchApi);
  await page.getByRole('button', { name: '再試行' }).click();
  await expect(page.getByTestId('search-error')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ドライバーの求人');
  await expect.poll(() => resultTotal(page)).toBe(5);
});

test('読み込みが遅いときはスケルトンを表示する', async ({ page }) => {
  await open(page, '/jobs');
  await page.route(
    (url) => url.pathname === '/api/jobs',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    },
  );
  await page.locator('#desktop-occupation').selectOption('engineer');
  await expect(page.getByTestId('results-skeleton')).toBeVisible();
  await expect(page.getByTestId('results-skeleton')).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => resultTotal(page)).toBe(5);
});

test('URLの不正な値は無視して通知し、URLを適用した条件に合わせる', async ({ page }) => {
  await open(page, '/jobs?salaryUnit=WEEK&occupation=pilot&manualLoading=no');
  const notices = page.getByTestId('query-notices');
  await expect(notices).toContainText('給与の単位は時給・日給・月給・年収から選んでください');
  await expect(notices).toContainText('指定された職種が見つからない');
  await expect(notices).toContainText('「手積み」は職種「ドライバー」の専用条件');
  await expect(page).toHaveURL(/\/jobs$/);
  expect(await resultTotal(page)).toBe(32);
});

test('SEC02 検索語にscriptを含めても実行されず文字として表示する', async ({ page }) => {
  let dialog = false;
  page.on('dialog', async (d) => {
    dialog = true;
    await d.dismiss();
  });
  const payload = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  await open(page, `/jobs?q=${encodeURIComponent(payload)}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('<script>alert(1)</script>');
  await page.waitForTimeout(300);
  expect(dialog).toBe(false);
});

test('SEO03 検索一覧はnoindexでJobPostingを出さない', async ({ page }) => {
  await open(page, '/jobs?occupation=driver');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test('給与順は単位の指定が必要で、確認できた下限の高い順に並ぶ', async ({ page }) => {
  await open(page, '/jobs?occupation=driver');
  await expect(page.locator('#sort option[value="salary"]')).toBeDisabled();
  await open(page, '/jobs?occupation=driver&salaryUnit=MONTH&sort=salary');
  const response = await page.request.get('/api/jobs?occupation=driver&salaryUnit=MONTH&sort=salary');
  const body = (await response.json()) as { items: { id: string; salary: { min: number } }[] };
  const mins = body.items.map((j) => j.salary.min);
  expect(mins).toEqual([...mins].sort((a, b) => b - a));
  expect(await resultIds(page)).toEqual(body.items.map((j) => j.id));
});

test('新着順は掲載開始日、なければ初回検出日と明記する', async ({ page }) => {
  await open(page, '/jobs?sort=newest&occupation=driver');
  const first = resultCards(page).first();
  await expect(first).toContainText('初回検出日');
  await expect(resultCards(page).filter({ hasText: '掲載開始日：2026/09/26' })).toHaveCount(1);
});
