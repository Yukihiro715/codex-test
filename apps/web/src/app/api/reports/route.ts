import { NextResponse } from 'next/server';
import { reportFieldErrors, reportInputSchema } from '@worklens/domain';
import { getConfig, getNow } from '@/server/env';
import { createReceiptId, recordReport } from '@/server/events';
import { RateLimiter, clientKey, isSameOriginRequest } from '@/server/request-guards';

const MAX_BODY_BYTES = 16 * 1024;
let limiter: RateLimiter | undefined;

function getLimiter(): RateLimiter {
  const config = getConfig();
  limiter ??= new RateLimiter(config.REPORT_RATE_LIMIT, config.REPORT_RATE_WINDOW_SECONDS * 1000);
  return limiter;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/**
 * POST /api/reports — 訂正・削除の申請。
 * CSRF（同一オリジン）・レート制限・入力検査・スパム対策（隠し項目）を行い、受付番号を返す。
 * 申請内容・連絡先はログやanalyticsに出さない（受付番号と種別だけを記録）。
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: 'forbidden', message: '不正なリクエストです。ページを再読み込みしてからお試しください。' }, 403);
  }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'unsupported_media_type', message: '送信形式が正しくありません。' }, 415);
  }
  const retryAfter = getLimiter().hit(clientKey(request, 'reports'));
  if (retryAfter !== null) {
    return json(
      { error: 'rate_limited', message: `短時間に多くの申請がありました。${Math.ceil(retryAfter / 60)}分ほど時間をおいてから再度お試しください。` },
      429,
      { 'Retry-After': String(retryAfter) },
    );
  }
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'too_large', message: '入力内容が長すぎます。' }, 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'too_large', message: '入力内容が長すぎます。' }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid_json', message: '送信内容を読み取れませんでした。' }, 400);
  }
  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid', message: '入力内容を確認してください。', fieldErrors: reportFieldErrors(parsed.error) }, 400);
  }
  const now = getNow();
  const receiptId = createReceiptId(now);
  // 隠し項目に入力がある場合は機械的な送信とみなし、保存しない（応答は通常と同じにする）
  if (!parsed.data.website) {
    recordReport({ receiptId, at: now.toISOString(), type: parsed.data.type, jobId: parsed.data.jobId ?? null, wantsReply: parsed.data.wantsReply });
    console.info(`[report] received ${receiptId} type=${parsed.data.type}`);
  }
  return json({ receiptId, status: 'received', autoReplySent: false }, 201);
}
