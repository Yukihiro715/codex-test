/**
 * 日本語テキストの正規化。検索・条件判定で共通に使う。
 * NFKCで全角英数・半角カナを揃え、英字は小文字にする。
 */
export function normalizeText(input: string): string {
  return input.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** キーワードを空白（全角/半角）で分割。重複と空要素を除く。 */
export function tokenizeKeyword(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return [...new Set(normalized.split(' ').filter(Boolean))];
}

/** 文字列に語が含まれるか（NFKC・小文字化済みで比較） */
export function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/** 制御文字を除去し、長さを制限する（URL・フォーム入力の防御用） */
export function sanitizeFreeText(input: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}
