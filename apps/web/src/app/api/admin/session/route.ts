import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminToken } from '@/server/admin-auth';
import { getAdminSecret, isAdminDemoLoginEnabled } from '@/server/env';
import { isSameOriginRequest } from '@/server/request-guards';

function safeNext(value: FormDataEntryValue | null | undefined): string {
  const text = typeof value === 'string' ? value : '';
  return /^\/admin(\/[a-z0-9_\-/]*)?$/i.test(text) && !text.includes('//') ? text : '/admin/sources';
}

/** POST /api/admin/session — デモ管理者ログイン（本番環境では使えない） */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const secret = getAdminSecret();
  if (!isAdminDemoLoginEnabled() || !secret) {
    return NextResponse.json({ error: 'forbidden', message: 'この環境ではデモ管理者ログインを使えません。' }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const response = NextResponse.redirect(new URL(safeNext(form?.get('next')), request.url), 303);
  response.cookies.set(ADMIN_COOKIE, createAdminToken(secret), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    secure: new URL(request.url).protocol === 'https:',
  });
  return response;
}
