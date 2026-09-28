import { describe, expect, it } from 'vitest';
import { RateLimiter, clientKey, isSameOriginRequest } from './request-guards';

const req = (headers: Record<string, string>) => new Request('http://localhost:3000/api/reports', { method: 'POST', headers });

describe('CSRF対策（同一オリジンのみ）', () => {
  it('Originが同じホストなら許可、違えば拒否', () => {
    expect(isSameOriginRequest(req({ host: 'localhost:3000', origin: 'http://localhost:3000' }))).toBe(true);
    expect(isSameOriginRequest(req({ host: 'localhost:3000', origin: 'https://evil.example' }))).toBe(false);
    expect(isSameOriginRequest(req({ host: 'localhost:3000', origin: 'null' }))).toBe(false);
  });

  it('Originがない場合は Sec-Fetch-Site=same-origin のときだけ許可', () => {
    expect(isSameOriginRequest(req({ host: 'localhost:3000' }))).toBe(false);
    expect(isSameOriginRequest(req({ host: 'localhost:3000', 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginRequest(req({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });
});

describe('レート制限（OPS03）', () => {
  it('窓の中で上限を超えると再試行までの秒数を返し、窓を過ぎると回復する', () => {
    const limiter = new RateLimiter(2, 60_000);
    const t0 = 1_000_000;
    expect(limiter.hit('a', t0)).toBeNull();
    expect(limiter.hit('a', t0 + 1000)).toBeNull();
    expect(limiter.hit('a', t0 + 2000)).toBe(58);
    expect(limiter.hit('b', t0 + 2000)).toBeNull();
    expect(limiter.hit('a', t0 + 60_001)).toBeNull();
  });

  it('クライアント識別子は生のIPを含まないハッシュ', () => {
    const key = clientKey(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'ua' }), 'reports');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203.0.113.7');
    expect(clientKey(req({ 'x-forwarded-for': '203.0.113.8', 'user-agent': 'ua' }), 'reports')).not.toBe(key);
  });
});
