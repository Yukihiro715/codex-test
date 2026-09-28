import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, resolveAdminSecret, verifyAdminToken } from './server/admin-auth';

/**
 * 管理画面・管理APIの入口での認可（SEC04）。未ログインならAPIは401、画面はログインへ。
 * ページとAPIの内部でも同じ検証を行い、ここだけに依存しない。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin/login' || pathname === '/api/admin/session') return NextResponse.next();
  const ok = verifyAdminToken(
    request.cookies.get(ADMIN_COOKIE)?.value,
    resolveAdminSecret({ ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET, APP_ENV: process.env.APP_ENV }),
  );
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized', message: '管理者としてログインしてください。' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
