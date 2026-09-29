import { expect, test } from '@playwright/test';
import { loginMember, open, waitForClient } from './helpers';

test('ログイン画面：5つのログイン方法・ログイン状態の保持・メール配信・同意・ヘルプ', async ({ page }) => {
  await open(page, '/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ログイン・無料会員登録');
  for (const name of ['Googleで続ける', 'Yahoo! JAPAN IDで続ける', 'LINEで続ける', 'Appleで続ける', 'メールアドレスで続ける']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByRole('checkbox', { name: 'ログイン状態を保持する' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '新着求人・おすすめ求人のメールを受け取る' })).toBeChecked();
  await expect(page.getByRole('link', { name: 'ログインでお困りの方' })).toHaveAttribute('href', '/login/help');
  await expect(page.locator('main').getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
  await expect(page.getByTestId('login-demo-note')).toContainText('外部のサービスには接続しません');
  await expect(page.getByTestId('member-link')).toHaveText('ログイン');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('マイページはログインが必要（戻り先つきでログイン画面へ）', async ({ page }) => {
  await page.goto('/mypage');
  await expect(page).toHaveURL('/login?next=%2Fmypage');
});

test('デモのログイン → マイページ → ログアウト', async ({ page }) => {
  await loginMember(page, 'LINEで続ける');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('マイページ');
  await expect(page.getByTestId('mypage-member')).toContainText('LINEでログイン中');
  await expect(page.getByTestId('member-link')).toHaveText('マイページ');
  await expect(page.getByTestId('mypage-providers').getByRole('listitem').filter({ hasText: 'LINE' })).toContainText('ログインに使用中');
  await expect(page.getByTestId('mypage-demo-note')).toContainText('サーバーには送りません');

  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('member-link')).toHaveText('ログイン');
  await page.goto('/mypage');
  await expect(page).toHaveURL('/login?next=%2Fmypage');
});

test('ログイン後は元の検索結果に戻り、検索条件を保存してマイページで管理できる', async ({ page }) => {
  await open(page, '/jobs?occupation=nurse&onCall=no');
  await page.getByTestId('save-search').click();
  await expect(page).toHaveURL('/login?next=%2Fjobs%3Foccupation%3Dnurse%26onCall%3Dno');
  await waitForClient(page);
  await page.getByRole('button', { name: 'Googleで続ける' }).click();
  await expect(page).toHaveURL('/jobs?occupation=nurse&onCall=no');
  await waitForClient(page);

  await page.getByTestId('save-search').click();
  await expect(page.getByTestId('toast')).toContainText('検索条件を保存しました');
  await expect(page.getByTestId('save-search')).toHaveText('保存済みの条件');

  await open(page, '/mypage');
  const saved = page.getByTestId('saved-search');
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText('職種：看護師');
  await expect(saved).toContainText('オンコールなし');
  await expect(saved).toContainText('現在 2件');
  const alert = saved.getByRole('checkbox', { name: '新着求人をメールで受け取る' });
  await expect(alert).toBeChecked();
  await alert.uncheck();
  await expect(alert).not.toBeChecked();
  await saved.getByRole('button', { name: /の保存を削除$/ }).click();
  await expect(page.getByTestId('saved-search')).toHaveCount(0);
  await expect(page.locator('#saved-searches')).toContainText('「この条件を保存」を押すと');
});

test('最近見た求人：ログイン中だけ記録し、設定でオフにできる', async ({ page }) => {
  await open(page, '/jobs/demo-driver-1');
  await loginMember(page);
  await expect(page.locator('#history')).toContainText('ログイン中に見た求人が、ここに表示されます');

  await open(page, '/jobs/demo-nurse-1');
  await open(page, '/mypage');
  const history = page.getByTestId('mypage-history');
  await expect(history).toContainText('外来看護師');
  await expect(history).not.toContainText('地場配送ドライバー');

  await page.getByRole('checkbox', { name: '閲覧履歴を残す' }).uncheck();
  await open(page, '/jobs/demo-driver-2');
  await open(page, '/mypage');
  await expect(page.getByTestId('mypage-history').getByRole('link')).toHaveCount(1);

  await page.getByRole('button', { name: '履歴を削除' }).click();
  await expect(page.locator('#history')).toContainText('閲覧履歴を残さない設定になっています');
});

test('メールアドレスで続ける：形式を確認してからログイン（デモでは送信しない）', async ({ page }) => {
  await open(page, '/login');
  await page.getByRole('button', { name: 'メールアドレスで続ける' }).click();
  await page.getByRole('button', { name: 'ログイン用のリンクを送る' }).click();
  await expect(page.getByText('メールアドレスを正しく入力してください')).toBeVisible();
  await page.getByLabel('メールアドレス', { exact: true }).fill('user@example.com');
  await page.getByRole('button', { name: 'ログイン用のリンクを送る' }).click();
  await expect(page).toHaveURL('/mypage');
  await expect(page.getByTestId('mypage-member')).toContainText('メールアドレスでログイン中');
});

test('退会：確認のうえ会員情報を消してログアウトする', async ({ page }) => {
  await loginMember(page, 'Appleで続ける', '/jobs?occupation=driver');
  await page.getByTestId('save-search').click();
  await expect(page.getByTestId('save-search')).toHaveText('保存済みの条件');

  await open(page, '/mypage');
  await expect(page.getByTestId('saved-search')).toHaveCount(1);
  await page.getByRole('button', { name: '退会する' }).click();
  const dialog = page.getByRole('dialog', { name: '退会しますか？' });
  await expect(dialog).toContainText('この端末の「保存した求人」は残ります');
  await dialog.getByRole('button', { name: '退会する' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('member-link')).toHaveText('ログイン');

  await loginMember(page, 'Appleで続ける');
  await expect(page.getByTestId('saved-search')).toHaveCount(0);
});

test('デモのログインAPI：同一オリジンだけ受け付け、不正な入力は拒否する', async ({ request, baseURL }) => {
  const origin = baseURL ?? '';
  const session = await request.get('/api/member/session');
  expect(await session.json()).toEqual({ member: null, loginAvailable: true });

  const crossOrigin = await request.post('/api/member/session', { data: { provider: 'google', remember: true }, headers: { Origin: 'https://evil.example' } });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await request.post('/api/member/session', { data: { provider: 'github', remember: true }, headers: { Origin: origin } });
  expect(invalid.status()).toBe(400);
  const ok = await request.post('/api/member/session', { data: { provider: 'yahoo_japan', remember: false }, headers: { Origin: origin } });
  expect(ok.status()).toBe(200);
  expect(ok.headers()['set-cookie']).toMatch(/km_member=m1\.yahoo_japan\.0\./);
  expect(ok.headers()['set-cookie']).toMatch(/HttpOnly/i);
  expect(ok.headers()['set-cookie']).not.toMatch(/Max-Age/i);
});
