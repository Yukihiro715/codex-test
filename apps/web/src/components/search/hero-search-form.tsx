import { Search } from 'lucide-react';
import { PREFECTURES } from '@worklens/domain';
import { cn } from '@/lib/utils';

/**
 * 「職種・キーワード」「勤務地」の2入力＋検索ボタン。JavaScriptなしでも /jobs へ送信できる。
 * 勤務地は都道府県・市区町村名のテキスト（位置情報の許可は求めない）。
 */
export function HeroSearchForm({ occupation, className, idPrefix = 'hero' }: { occupation?: string; className?: string; idPrefix?: string }) {
  return (
    <form
      action="/jobs"
      method="get"
      role="search"
      aria-label="求人を検索"
      className={cn(
        'grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[0_8px_20px_rgba(20,45,69,0.03)] sm:grid-cols-[1.5fr_1fr_auto] sm:items-end sm:p-[18px]',
        className,
      )}
    >
      {occupation ? <input type="hidden" name="occupation" value={occupation} /> : null}
      <div>
        <label htmlFor={`${idPrefix}-q`} className="mb-1 block text-xs font-bold text-muted">
          職種・キーワード
        </label>
        <input id={`${idPrefix}-q`} name="q" type="search" autoComplete="off" maxLength={100} placeholder="職種、資格、企業名など" className="field-input h-12" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-loc`} className="mb-1 block text-xs font-bold text-muted">
          勤務地
        </label>
        <input
          id={`${idPrefix}-loc`}
          name="loc"
          type="text"
          autoComplete="off"
          maxLength={40}
          list={`${idPrefix}-loc-options`}
          placeholder="都道府県・市区町村"
          className="field-input h-12"
        />
        <datalist id={`${idPrefix}-loc-options`}>
          {PREFECTURES.map((p) => (
            <option key={p.code} value={p.name} />
          ))}
        </datalist>
      </div>
      <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-6 font-bold text-white hover:bg-primary-hover">
        <Search aria-hidden className="size-5" />
        求人を探す
      </button>
    </form>
  );
}
