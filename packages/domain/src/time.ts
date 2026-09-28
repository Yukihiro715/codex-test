/**
 * 時刻はUTC（ISO 8601）で保存し、表示は日本時間（JST）。
 * 期間の境界は「現在時刻から◯時間以内（境界を含む）」で統一する。
 */
const HOUR_MS = 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 例：2026/09/29（JST） */
export function formatDateJst(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** 例：2026/09/29 09:00（JST） */
export function formatDateTimeJst(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function hoursBetween(fromIso: string, now: Date): number {
  return (now.getTime() - new Date(fromIso).getTime()) / HOUR_MS;
}

/** now から hours 時間以内（境界を含む）か */
export function isWithinHours(iso: string, now: Date, hours: number): boolean {
  return hoursBetween(iso, now) <= hours;
}

/** 情報確認からこの時間を超えたら、カード・詳細で鮮度の注意を表示する（自社の仮設定） */
export const STALE_WARNING_AFTER_HOURS = 72;

/** 日付文字列（YYYY-MM-DD またはISO）が有効か */
export function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
