import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MEMBER_PROVIDERS, type MemberProviderId } from '@/lib/member';
import { MEMBER_COOKIE, MEMBER_REMEMBER_SECONDS, createMemberToken } from '@/server/member-auth';
import { demoMember, readMemberSession } from '@/server/member';
import { getMemberSecret, isMemberDemoLoginEnabled, isMemberLoginAvailable } from '@/server/env';
import { isSameOriginRequest } from '@/server/request-guards';

const MAX_BODY_BYTES = 1024;

const loginSchema = z.object({
  provider: z.enum(MEMBER_PROVIDERS.map((p) => p.id) as [MemberProviderId, ...MemberProviderId[]]),
  remember: z.boolean(),
});

const noStore = { 'Cache-Control': 'no-store' };

/** GET /api/member/session — ログイン中の会員（画面のヘッダー表示用） */
export async function GET() {
  return NextResponse.json({ member: await readMemberSession(), loginAvailable: isMemberLoginAvailable() }, { headers: noStore });
}

/**
 * POST /api/member/session — デモのログイン（外部サービスに接続しない）。本番環境・実データでは使えない。
 * M1 では各社の OAuth/OIDC・メールリンクの認証に置き換える。
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  const secret = getMemberSecret();
  if (!isMemberDemoLoginEnabled() || !secret) {
    return NextResponse.json({ error: 'forbidden', message: 'この環境ではデモのログインを使えません。' }, { status: 403, headers: noStore });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413, headers: noStore });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: noStore });

  const { provider, remember } = parsed.data;
  const response = NextResponse.json({ member: demoMember(provider) }, { headers: noStore });
  response.cookies.set(MEMBER_COOKIE, createMemberToken(secret, { provider, remember }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: new URL(request.url).protocol === 'https:',
    // 保持しない場合はブラウザを閉じると消える Cookie にする
    ...(remember ? { maxAge: MEMBER_REMEMBER_SECONDS } : {}),
  });
  return response;
}

/** DELETE /api/member/session — ログアウト */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  const response = NextResponse.json({ ok: true }, { headers: noStore });
  response.cookies.delete(MEMBER_COOKIE);
  return response;
}
