import { z } from 'zod';
import { isSafeExternalUrl } from './policy';

export const REPORT_TYPES = [
  { value: 'ended', label: '募集が終了している' },
  { value: 'incorrect', label: '掲載されている条件が違う' },
  { value: 'takedown', label: '掲載の停止を希望する' },
  { value: 'personal_info', label: '個人情報が掲載されている' },
  { value: 'other', label: 'その他（求人について）' },
  { value: 'inquiry', label: 'サービスについてのお問い合わせ（個人情報の取扱い・広告掲載を含む）' },
] as const;

export const REPORTER_ROLES = [
  { value: 'job_seeker', label: '求職者' },
  { value: 'employer', label: '掲載企業・団体の担当者' },
  { value: 'other', label: 'その他' },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]['value'];

export const REPORT_DETAILS_MAX = 2000;

/**
 * 対象の求人（IDまたはURL）が必要な申請か。電話窓口を置かないため、このフォームがサービス全般・
 * 個人情報の開示等の問い合わせ窓口も兼ねる（inquiry は対象の求人なしで受け付ける）。
 */
export function reportNeedsTarget(type: ReportType | '' | undefined): boolean {
  return type !== 'inquiry';
}

/**
 * 訂正・削除申請の入力。本人確認書類は求めない。連絡先は返信を希望する場合だけ。
 * website はスパム対策の隠し項目（人は入力しない）。
 */
export const reportInputSchema = z
  .object({
    jobId: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/, '対象の求人IDが正しくありません')
      .nullable()
      .optional(),
    targetUrl: z.string().trim().max(500, 'URLは500文字以内で入力してください').optional(),
    type: z.enum(REPORT_TYPES.map((t) => t.value) as [ReportType, ...ReportType[]], { error: '申請の種類を選んでください' }),
    details: z
      .string()
      .trim()
      .min(1, '内容を入力してください')
      .max(REPORT_DETAILS_MAX, `内容は${REPORT_DETAILS_MAX}文字以内で入力してください`),
    reporterRole: z.enum(['job_seeker', 'employer', 'other']).optional(),
    wantsReply: z.boolean(),
    email: z.string().trim().max(254, 'メールアドレスが長すぎます').optional(),
    name: z.string().trim().max(100, 'お名前は100文字以内で入力してください').optional(),
    website: z.string().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.targetUrl && !isSafeExternalUrl(value.targetUrl)) {
      ctx.addIssue({ code: 'custom', path: ['targetUrl'], message: 'http:// または https:// で始まるURLを入力してください' });
    }
    if (reportNeedsTarget(value.type) && !value.jobId && !value.targetUrl) {
      ctx.addIssue({ code: 'custom', path: ['targetUrl'], message: '対象の求人ページのURLを入力してください' });
    }
    if (value.wantsReply) {
      const email = value.email ?? '';
      if (!z.email().safeParse(email).success) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: '返信先のメールアドレスを正しく入力してください' });
      }
    }
  });

export type ReportInput = z.infer<typeof reportInputSchema>;

/** バリデーションエラーをフィールド別の日本語メッセージにする */
export function reportFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
