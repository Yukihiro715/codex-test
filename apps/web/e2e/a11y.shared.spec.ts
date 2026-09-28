import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAdmin, open } from './helpers';

const PAGES = ['/', '/jobs?occupation=nurse&onCall=no', '/jobs/demo-driver-1', '/jobs/demo-driver-2', '/occupations/driver', '/compare?ids=demo-driver-1,demo-nurse-1,demo-engineer-4', '/saved', '/report?jobId=demo-driver-1'];

/** 自動検査（axe-core・WCAG 2.x A/AA）。重大・深刻な違反がないこと */
for (const path of PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await open(page, path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  });
}

test('a11y: 管理画面（ソース一覧）', async ({ page }) => {
  await loginAdmin(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
});
