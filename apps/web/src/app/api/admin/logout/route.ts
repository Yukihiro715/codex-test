import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/server/admin-auth';
import { isSameOriginRequest } from '@/server/request-guards';

/** POST /api/admin/logout */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const response = NextResponse.redirect(new URL('/admin/login', request.url), 303);
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
