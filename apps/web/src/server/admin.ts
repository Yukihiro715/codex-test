import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, verifyAdminToken } from './admin-auth';
import { getAdminSecret } from './env';
import { DEMO_STATE_COOKIE, decodeDemoState, encodeDemoState, type DemoState } from './demo-state';

/** 管理ページのサーバー側認可。proxyに加えて各ページでも検証する（多層防御） */
export async function requireAdminPage(nextPath: string): Promise<void> {
  const jar = await cookies();
  if (!verifyAdminToken(jar.get(ADMIN_COOKIE)?.value, getAdminSecret())) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export function isAdminRequest(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  return verifyAdminToken(token ? decodeURIComponent(token) : undefined, getAdminSecret());
}

export async function readDemoState(): Promise<DemoState> {
  const jar = await cookies();
  return decodeDemoState(jar.get(DEMO_STATE_COOKIE)?.value);
}

export async function writeDemoState(state: DemoState): Promise<void> {
  const jar = await cookies();
  jar.set(DEMO_STATE_COOKIE, encodeDemoState(state), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
