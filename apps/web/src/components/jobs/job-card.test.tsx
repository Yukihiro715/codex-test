import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicJobSummary } from '@worklens/domain';
import { ToastProvider } from '@/components/ui/toast';
import { JobCard } from './job-card';

function job(overrides: Partial<PublicJobSummary> = {}): PublicJobSummary {
  return {
    id: 'demo-test-1',
    primaryListingId: 'demo-test-1',
    title: 'テスト求人',
    employerName: 'テスト株式会社（架空）',
    occupation: 'nurse',
    locations: [{ country: 'JP', prefectureCode: '13', city: '新宿区', displayAddress: '東京都新宿区', remoteMode: 'unknown' }],
    employmentTypes: ['fulltime'],
    salary: { currency: 'JPY', min: 300000, max: 360000, unit: 'MONTH', basis: 'gross', fixedOvertimeIncluded: 'unknown', fixedOvertimeHours: null, fixedOvertimeAmount: null, evidenceIds: [] },
    facts: { 施設形態: 'クリニック', 必要資格: null, 夜勤: 'なし', オンコール: null },
    facets: { onCall: null },
    workingHours: null,
    requiredQualification: null,
    displayMode: 'facts_link',
    sourceId: 'demo_employer_facts',
    sourceName: 'デモ企業採用ページ',
    sourceUrl: 'https://demo-test-1.example/jobs/1',
    lastFetchedAt: '2026-09-29T00:00:00Z',
    sourcePostedAt: null,
    firstSeenAt: '2026-09-29T00:00:00Z',
    validThrough: null,
    applicationRoute: 'employer',
    state: 'published',
    staleWarning: false,
    otherListingCount: 0,
    demo: true,
    ...overrides,
  };
}

const renderCard = (props: Parameters<typeof JobCard>[0]) =>
  render(
    <ToastProvider>
      <JobCard {...props} />
    </ToastProvider>,
  );

describe('求人カード', () => {
  it('求人の文字列にscriptを含んでも実行・解釈せず文字として表示する（SEC02）', () => {
    const { container } = renderCard({ job: job({ title: '<script>alert(1)</script><img src=x onerror=alert(2)>' }) });
    expect(screen.getByRole('link', { name: '<script>alert(1)</script><img src=x onerror=alert(2)>' })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('給与の単位・応募経路・掲載元・情報確認日を表示し、記載なしを明示する', () => {
    renderCard({ job: job() });
    expect(screen.getByText('月給')).toBeInTheDocument();
    expect(screen.getByText('30万〜36万円')).toBeInTheDocument();
    expect(screen.getByText('企業へ直接応募')).toBeInTheDocument();
    expect(screen.getByText(/掲載元：デモ企業採用ページ/)).toBeInTheDocument();
    expect(screen.getByText('2026/09/29')).toBeInTheDocument();
    expect(screen.getByText('必要資格：原文に記載なし')).toBeInTheDocument();
  });

  it('絞り込み中の条件をカードの先頭の条件として表示する（最初は3つまで）', () => {
    renderCard({ job: job(), priorityFacts: ['オンコール'] });
    const items = screen.getByRole('list', { name: '主な条件' }).querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toBe('オンコール：原文に記載なし');
  });

  it('PR枠では「PR」と明記し、鮮度の注意を文字で示す', () => {
    renderCard({ job: job({ staleWarning: true }), promoted: true });
    expect(screen.getByText('PR')).toBeInTheDocument();
    expect(screen.getByText('確認から時間が経過')).toBeInTheDocument();
  });
});
