import type { Metadata } from 'next';
import { ReportForm } from '@/components/report/report-form';
import { getRepository, getRequestContext } from '@/server/repository';

export const metadata: Metadata = {
  title: '掲載情報の訂正・削除の申請・お問い合わせ',
  robots: { index: false, follow: true },
};

export default async function ReportPage({ searchParams }: PageProps<'/report'>) {
  const sp = await searchParams;
  const jobIdParam = typeof sp.jobId === 'string' && /^[a-z0-9-]{1,80}$/.test(sp.jobId) ? sp.jobId : null;
  let target: { jobId: string; title: string | null; sourceUrl: string | null } | null = null;
  if (jobIdParam) {
    const [item] = await getRepository().lookup([jobIdParam], await getRequestContext());
    // 公開中の求人だけタイトル・掲載元URLを自動入力する（非公開の内容は再表示しない）
    const title = item?.status === 'public' ? `${item.job.title}（${item.job.employerName}）` : item?.status === 'expired' ? item.title : null;
    target = { jobId: jobIdParam, title, sourceUrl: item?.status === 'public' ? item.job.sourceUrl : null };
  }
  return (
    <div className="page-container pb-10 pt-4 lg:pt-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[28px] font-extrabold leading-snug lg:text-[32px]">掲載情報の訂正・削除の申請・お問い合わせ</h1>
        <p className="mt-2 text-sm text-muted">
          掲載内容の誤り、募集終了、掲載停止のご希望、個人情報に関するご連絡を受け付けます。内容を確認し、必要な対応を行います（すべての申請で削除をお約束するものではありません）。本人確認書類の提出は不要です。
        </p>
        <p className="mt-2 text-sm text-muted">
          サービスや個人情報の取扱い（開示・訂正・利用停止などのご請求を含む）についてのお問い合わせも、このフォームで受け付けます。「申請の種類」で「サービスについてのお問い合わせ」を選んでください。
        </p>
        <ReportForm jobId={target?.jobId ?? null} jobTitle={target?.title ?? null} defaultUrl={target?.sourceUrl ?? ''} />
      </div>
    </div>
  );
}
