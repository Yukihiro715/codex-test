'use client';

import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { REPORT_DETAILS_MAX, REPORT_TYPES, REPORTER_ROLES, reportNeedsTarget, type ReportType } from '@worklens/domain';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/track';

type Status = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'done'; receiptId: string } | { kind: 'error'; message: string };

/**
 * 訂正・削除の申請フォーム（S07）。返信を希望する場合だけ連絡先を入力する。
 * サービス・個人情報の取扱い・広告掲載についての問い合わせ（inquiry）もここで受け付ける。
 */
export function ReportForm({ jobId, jobTitle, defaultUrl = '' }: { jobId: string | null; jobTitle: string | null; defaultUrl?: string }) {
  const [type, setType] = useState<ReportType | ''>('');
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [details, setDetails] = useState('');
  const [role, setRole] = useState('');
  const [wantsReply, setWantsReply] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (status.kind === 'done') {
    return (
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6" role="status" data-testid="report-receipt">
        <p className="flex items-center gap-2 text-lg font-bold">
          <CircleCheck aria-hidden className="size-6 text-primary" />
          申請を受け付けました
        </p>
        <p className="mt-3 text-sm">
          受付番号：<span className="font-mono text-base font-bold" data-testid="receipt-id">{status.receiptId}</span>
        </p>
        <p className="mt-3 text-sm text-muted">
          内容を確認し、必要な対応を行います。自動返信メールは送信していません（デモ環境のため、申請内容は保存・送信されません）。お問い合わせの際は受付番号をお知らせください。
        </p>
      </div>
    );
  }

  const describedBy = (field: string, hint?: string) => [hint, errors[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: string) =>
    errors[field] ? (
      <p id={`${field}-error`} className="mt-1 text-sm font-bold text-danger">
        {errors[field]}
      </p>
    ) : null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!type) nextErrors.type = '申請の種類を選んでください';
    if (!details.trim()) nextErrors.details = '内容を入力してください';
    if (reportNeedsTarget(type) && !jobId && !targetUrl.trim()) nextErrors.targetUrl = '対象の求人ページのURLを入力してください';
    if (wantsReply && !email.trim()) nextErrors.email = '返信先のメールアドレスを入力してください';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(Object.keys(nextErrors)[0] === 'type' ? 'report-type-ended' : `report-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          targetUrl: targetUrl.trim() || undefined,
          type,
          details,
          reporterRole: role || undefined,
          wantsReply,
          email: wantsReply ? email.trim() : undefined,
          name: wantsReply && name.trim() ? name.trim() : undefined,
          website,
        }),
      });
      const data = (await res.json()) as { receiptId?: string; message?: string; fieldErrors?: Record<string, string> };
      if (res.ok && data.receiptId) {
        track('report_submitted', { type: String(type) });
        setStatus({ kind: 'done', receiptId: data.receiptId });
        return;
      }
      if (data.fieldErrors) setErrors(data.fieldErrors);
      setStatus({ kind: 'error', message: data.message ?? '送信できませんでした。時間をおいて再度お試しください。' });
    } catch {
      setStatus({ kind: 'error', message: '通信に失敗しました。接続を確認して再度お試しください。' });
    }
  };

  return (
    <form className="mt-6 space-y-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7" onSubmit={onSubmit} noValidate data-testid="report-form">
      <p className="rounded-xl bg-page p-3 text-xs text-muted">デモ環境のため、申請内容は外部へ送信・保存されません（受付番号の表示までを確認できます）。本人確認書類や、必要以上の個人情報は入力しないでください。</p>
      <div>
        <p className="text-sm font-bold">対象の求人</p>
        {jobId ? (
          <p className="mt-1 rounded-lg bg-page px-3 py-2 text-sm text-wrap-anywhere" data-testid="report-target">
            {jobTitle ?? '指定された求人'}
            <span className="ml-2 font-mono text-xs text-muted">（ID：{jobId}）</span>
          </p>
        ) : null}
        <label htmlFor="report-targetUrl" className="mt-3 block text-sm font-bold">
          対象ページのURL（掲載元のページなど）{jobId || !reportNeedsTarget(type) ? '（任意）' : ''}
        </label>
        <input
          id="report-targetUrl"
          type="url"
          inputMode="url"
          className="field-input mt-1"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://"
          aria-invalid={errors.targetUrl ? true : undefined}
          aria-describedby={describedBy('targetUrl')}
        />
        {fieldError('targetUrl')}
      </div>

      <fieldset aria-describedby={describedBy('type')}>
        <legend className="text-sm font-bold">申請の種類</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {REPORT_TYPES.map((t) => (
            <label key={t.value} className="check-row rounded-lg border border-line px-3">
              <input id={`report-type-${t.value}`} type="radio" name="report-type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        {fieldError('type')}
      </fieldset>

      <div>
        <label htmlFor="report-details" className="block text-sm font-bold">
          内容
        </label>
        <p id="report-details-hint" className="text-xs text-muted">
          どの条件がどのように違うか、お問い合わせの内容など（{REPORT_DETAILS_MAX}文字以内）。機微な個人情報は入力しないでください。
        </p>
        <textarea
          id="report-details"
          className="field-input mt-1 min-h-32"
          maxLength={REPORT_DETAILS_MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          aria-invalid={errors.details ? true : undefined}
          aria-describedby={describedBy('details', 'report-details-hint')}
        />
        <p className="text-right text-xs text-muted">
          {details.length}/{REPORT_DETAILS_MAX}
        </p>
        {fieldError('details')}
      </div>

      <div>
        <label htmlFor="report-role" className="block text-sm font-bold">
          申請者の立場（任意）
        </label>
        <select id="report-role" className="field-input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">選択しない</option>
          {REPORTER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="check-row font-bold">
          <input type="checkbox" checked={wantsReply} onChange={(e) => setWantsReply(e.target.checked)} />
          <span>対応結果の連絡を希望する</span>
        </label>
        {wantsReply ? (
          <div className="mt-2 space-y-3 rounded-xl bg-page p-4">
            <div>
              <label htmlFor="report-email" className="block text-sm font-bold">
                返信先メールアドレス
              </label>
              <input
                id="report-email"
                type="email"
                autoComplete="email"
                className="field-input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy('email')}
              />
              {fieldError('email')}
            </div>
            <div>
              <label htmlFor="report-name" className="block text-sm font-bold">
                お名前（任意）
              </label>
              <input id="report-name" type="text" autoComplete="name" className="field-input mt-1" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        ) : null}
      </div>

      {/* スパム対策の隠し項目（人は入力しない） */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="report-website">ウェブサイト</label>
        <input id="report-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {status.kind === 'error' ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm font-bold text-danger" data-testid="report-error">
          {status.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status.kind === 'submitting'}>
        {status.kind === 'submitting' ? '送信中…' : '申請を送信する'}
      </Button>
    </form>
  );
}
