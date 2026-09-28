import { createHash } from 'node:crypto';

/**
 * CSRF対策：状態を変えるPOSTは同一オリジンからのものだけ受け付ける。
 * Origin（なければ Sec-Fetch-Site）を検査し、どちらもない場合は拒否する。
 */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

/** レート制限・重複判定のためのクライアント識別子。生のIPは保持せずハッシュ化する。 */
export function clientKey(request: Request, salt: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  const ua = request.headers.get('user-agent') ?? '';
  return createHash('sha256').update(`${salt}:${ip}:${ua}`).digest('hex').slice(0, 32);
}

interface Bucket {
  hits: number[];
}

/** 単一プロセス用の固定窓レート制限（M0）。M1ではRedis等の共有ストアに置き換える。 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** 許可されれば null、超過なら再試行までの秒数 */
  hit(key: string, nowMs: number = Date.now()): number | null {
    const bucket = this.buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => nowMs - t < this.windowMs);
    if (bucket.hits.length >= this.limit) {
      const oldest = bucket.hits[0] ?? nowMs;
      this.buckets.set(key, bucket);
      return Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
    }
    bucket.hits.push(nowMs);
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.prune(nowMs);
    return null;
  }

  private prune(nowMs: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every((t) => nowMs - t >= this.windowMs)) this.buckets.delete(key);
    }
  }
}
