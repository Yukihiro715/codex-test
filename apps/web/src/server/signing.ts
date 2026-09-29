import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 の署名（base64url） */
export function hmacSign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** 署名が一致するか（長さの違いも含めて定数時間で比べる） */
export function signatureMatches(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(hmacSign(payload, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
