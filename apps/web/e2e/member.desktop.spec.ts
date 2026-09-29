import { expect, test } from '@playwright/test';
import { loginMember, open, waitForClient } from './helpers';

test('ログイン画面：5つのログイン方法・ログイン状態の保持・メール配信（初期値オフ）・同意・ヘルプ', async ({ page }) => {
  await open(page, '/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ログイン・無料会員登録');
  for (const name of ['Googleで続ける', 'Yahoo! JAPAN IDで続ける', 'LINEで続ける', 'Appleで続ける', 'メールアドレスで続ける']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByRole('checkbox', { name: 'ログイン状態を保持する' })).toBeChecked();
  // 広告にあたるメールの同意は初期値オフで、送信者（運営会社）を明記する
  await expect(page.getByRole('checkbox', { name: /株式会社プロセント）から、新着求人・おすすめ求人のメールを受け取る/ })).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'ログインでお困りの方' })).toHaveAttribute('href', '/login/help');
  // 同意の文はボタンより前に表示する
  const consent = page.getByTestId('login-consent');
  await expect(consent.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
  const consentBeforeButtons = await consent.evaluate((el) => {
    const first = document.querySelector('[aria-busy] button');
    return first ? Boolean(el.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
  });
  expect(consentBeforeButtons).toBe(true);
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
  // 登録時にメールを受け取る選択をしていないので、新着メールは初期値オフ
  const alert = saved.getByRole('checkbox', { name: '新着求人をメールで受け取る' });
  await expect(alert).not.toBeChecked();
  await alert.check();
  await expect(alert).toBeChecked();
  await expect(page.locator('#saved-searches')).toContainText('新着求人メールを停止しているため');
  await saved.getByRole('button', { name: /の保存を削除$/ }).click();
  await expect(page.getByTestId('saved-search')).toHaveCount(0);
  await expect(page.locator('#saved-searches')).toContainText('「この条件を保存」を押すと');
});

test('最近見た求人：初期値は記録しない。オンにした会員のログイン中だけ記録する', async ({ page }) => {
  await loginMember(page);
  await open(page, '/jobs/demo-driver-1');
  await open(page, '/mypage');
  await expect(page.locator('#history')).toContainText('閲覧履歴を残さない設定になっています');
  const toggle = page.getByRole('checkbox', { name: '閲覧履歴を残す' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();

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

test('メールアドレスで続ける：形式を確認してから確認コードでログイン（デモでは送信しない）', async ({ page }) => {
  await open(page, '/login');
  await page.getByRole('button', { name: 'メールアドレスで続ける' }).click();
  await page.getByRole('button', { name: '確認コードを送る' }).click();
  await expect(page.getByText('メールアドレスを正しく入力してください')).toBeVisible();
  await page.getByLabel('メールアドレス', { exact: true }).fill('user@example.com');
  await page.getByRole('button', { name: '確認コードを送る' }).click();
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
