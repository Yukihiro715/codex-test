'use client';

import { useId, useState } from 'react';
import {
  APPLICATION_ROUTES,
  EMPLOYMENT_TYPES,
  FRESHNESS_OPTIONS,
  OCCUPATIONS,
  PREFECTURES,
  SALARY_INPUT_LIMITS,
  SALARY_UNITS,
  facetsForOccupation,
  salaryUnitLabel,
  toggleFacetValue,
  toggleListValue,
  withOccupation,
  withPatch,
  type FacetCounts,
  type KnownSalaryUnit,
  type SearchQuery,
} from '@worklens/domain';
import { cn } from '@/lib/utils';

export interface FilterChangeMeta {
  /** 職種の変更で解除した専用条件（通知に使う） */
  cleared?: string[];
  previousOccupation?: string | null;
}

interface FilterPanelProps {
  query: SearchQuery;
  counts: FacetCounts;
  sources: { id: string; name: string }[];
  onChange: (next: SearchQuery, meta?: FilterChangeMeta) => void;
  /** idの重複を避けるための接頭辞（PCのパネルとスマホのシートで別にする） */
  idPrefix: string;
}

function Count({ value }: { value: number | undefined }) {
  return <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-xs tabular-nums text-muted">{value ?? 0}件</span>;
}

function Group({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  const hintId = useId();
  return (
    <fieldset className="border-t border-line-soft py-4 first:border-t-0 first:pt-0" aria-describedby={hint ? hintId : undefined}>
      <legend className="float-left mb-1 w-full text-sm font-bold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="clear-both mb-1 text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

/**
 * 絞り込み条件。共通条件（職種・勤務地・雇用形態・給与・応募経路・最終情報確認・掲載元）と職種専用条件。
 * 件数は同じグループ内を「いずれか」として数えた値。
 */
export function FilterPanel({ query, counts, sources, onChange, idPrefix }: FilterPanelProps) {
  const facets = facetsForOccupation(query.occupation);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="text-ink">
      <div className="border-b border-line-soft pb-4">
        <label htmlFor={id('occupation')} className="mb-1 block text-sm font-bold">
          職種
        </label>
        <select
          id={id('occupation')}
          className="field-input"
          value={query.occupation ?? ''}
          onChange={(e) => {
            const { query: next, cleared } = withOccupation(query, e.target.value || null);
            onChange(next, { cleared, previousOccupation: query.occupation });
          }}
        >
          <option value="">すべての職種</option>
          {OCCUPATIONS.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}（{counts.occupation?.[o.slug] ?? 0}件）
            </option>
          ))}
        </select>
        {query.occupation && facets.length === 0 ? <p className="mt-2 text-xs text-muted">この職種は共通条件で絞り込めます。</p> : null}
      </div>

      {facets.length > 0 ? (
        <div className="mt-4 rounded-xl bg-[#f7f9fb] p-3" data-testid="occupation-filters">
          <p className="mb-2 text-xs font-bold text-primary">職種専用の条件</p>
          {facets.map((def) => {
            const selected = query.facets[def.key] ?? [];
            return (
              <Group key={def.key} legend={def.label} hint={def.hint}>
                {def.options.map((option) => (
                  <label key={option.value} className="check-row">
                    <input
                      type="checkbox"
                      name={`${idPrefix}-${def.key}`}
                      value={option.value}
                      checked={selected.includes(option.value)}
                      onChange={() => onChange(toggleFacetValue(query, def.key, option.value))}
                    />
                    <span>{option.label}</span>
                    <Count value={counts[`facet:${def.key}`]?.[option.value]} />
                  </label>
                ))}
              </Group>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4">
        <Group legend="勤務地（都道府県）">
          <label htmlFor={id('pref')} className="sr-only">
            都道府県
          </label>
          <select
            id={id('pref')}
            className="field-input"
            value={query.pref ?? ''}
            onChange={(e) => onChange(withPatch(query, { pref: e.target.value || null }))}
          >
            <option value="">指定なし</option>
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}（{counts.pref?.[p.code] ?? 0}件）
              </option>
            ))}
          </select>
        </Group>

        <Group legend="雇用形態">
          {EMPLOYMENT_TYPES.filter((e) => e.value !== 'other').map((e) => (
            <label key={e.value} className="check-row">
              <input type="checkbox" checked={query.emp.includes(e.value)} onChange={() => onChange(toggleListValue(query, 'emp', e.value))} />
              <span>{e.label}</span>
              <Count value={counts.emp?.[e.value]} />
            </label>
          ))}
        </Group>

        <SalaryGroup key={`${query.salaryUnit}-${query.salaryMin}`} query={query} counts={counts} onChange={onChange} idPrefix={idPrefix} />

        <Group legend="応募経路">
          {APPLICATION_ROUTES.map((r) => (
            <label key={r.value} className="check-row">
              <input type="checkbox" checked={query.route.includes(r.value)} onChange={() => onChange(toggleListValue(query, 'route', r.value))} />
              <span>{r.label}</span>
              <Count value={counts.route?.[r.value]} />
            </label>
          ))}
        </Group>

        <Group legend="最終情報確認" hint="当サービスが掲載元の情報を確認した日時です（日本時間・現在から遡った時間）。">
          <label className="check-row">
            <input type="radio" name={id('fresh')} checked={query.fresh === null} onChange={() => onChange(withPatch(query, { fresh: null }))} />
            <span>指定なし</span>
          </label>
          {FRESHNESS_OPTIONS.map((f) => (
            <label key={f.value} className="check-row">
              <input type="radio" name={id('fresh')} checked={query.fresh === f.value} onChange={() => onChange(withPatch(query, { fresh: f.value }))} />
              <span>{f.label}</span>
              <Count value={counts.fresh?.[f.value]} />
            </label>
          ))}
        </Group>

        {sources.length > 0 ? (
          <Group legend="掲載元">
            {sources.map((s) => (
              <label key={s.id} className="check-row">
                <input type="checkbox" checked={query.source.includes(s.id)} onChange={() => onChange(toggleListValue(query, 'source', s.id))} />
                <span className="text-wrap-anywhere">{s.name}</span>
                <Count value={counts.source?.[s.id]} />
              </label>
            ))}
          </Group>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">記載のない条件を「条件に合う」とは判定しません。</p>
    </div>
  );
}

function SalaryGroup({
  query,
  counts,
  onChange,
  idPrefix,
}: {
  query: SearchQuery;
  counts: FacetCounts;
  onChange: FilterPanelProps['onChange'];
  idPrefix: string;
}) {
  const [draftMin, setDraftMin] = useState(query.salaryMin !== null ? String(query.salaryMin) : '');
  const [error, setError] = useState<string | null>(null);
  const unitId = `${idPrefix}-salary-unit`;
  const minId = `${idPrefix}-salary-min`;
  const errorId = `${idPrefix}-salary-error`;
  const hintId = `${idPrefix}-salary-hint`;
  const unit = query.salaryUnit;

  const commitMin = () => {
    if (!unit) return;
    const text = draftMin.replace(/[,，\s円]/g, '').normalize('NFKC');
    if (text === '') {
      setError(null);
      if (query.salaryMin !== null) onChange(withPatch(query, { salaryMin: null }));
      return;
    }
    const limits = SALARY_INPUT_LIMITS[unit];
    const amount = Number(text);
    if (!/^\d+$/.test(text) || amount < limits.min || amount > limits.max) {
      setError(`${salaryUnitLabel(unit)}の下限は${limits.max.toLocaleString('ja-JP')}円以下の整数（円単位）で入力してください。`);
      return;
    }
    setError(null);
    if (amount !== query.salaryMin) onChange(withPatch(query, { salaryMin: amount }));
  };

  const unitMeta = SALARY_UNITS.find((u) => u.value === unit);

  return (
    <fieldset className="border-t border-line-soft py-4">
      <legend className="float-left mb-1 w-full text-sm font-bold">給与</legend>
      <p id={hintId} className="clear-both mb-2 text-xs leading-relaxed text-muted">
        時給・日給・月給・年収を選んでから下限額を入力します。単位が違う求人は同じ条件で比べません。
      </p>
      <label htmlFor={unitId} className="mb-1 block text-xs font-bold">
        給与の単位
      </label>
      <select
        id={unitId}
        className="field-input"
        value={unit ?? ''}
        onChange={(e) => {
          const nextUnit = (e.target.value || null) as KnownSalaryUnit | null;
          // 単位を変えたら下限額はリセット（月給の金額を時給に流用しない）
          onChange(withPatch(query, { salaryUnit: nextUnit, salaryMin: null }));
        }}
      >
        <option value="">指定なし</option>
        {SALARY_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}（{counts.salaryUnit?.[u.value] ?? 0}件）
          </option>
        ))}
      </select>
      <label htmlFor={minId} className="mb-1 mt-3 block text-xs font-bold">
        下限額（円）
      </label>
      <div className="flex gap-2">
        <input
          id={minId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="field-input"
          disabled={!unit}
          placeholder={unitMeta ? unitMeta.placeholder : '先に単位を選択'}
          value={draftMin}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(' ')}
          onChange={(e) => setDraftMin(e.target.value)}
          onBlur={commitMin}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitMin();
            }
          }}
        />
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] border border-line bg-surface px-3 text-sm font-bold hover:border-primary hover:text-primary disabled:opacity-50"
          disabled={!unit}
          onClick={commitMin}
        >
          適用
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <label className={cn('check-row mt-1', !unit && 'opacity-50')}>
        <input
          type="checkbox"
          disabled={!unit}
          checked={query.salaryUnknown}
          onChange={(e) => onChange(withPatch(query, { salaryUnknown: e.target.checked }))}
        />
        <span>給与の下限が記載されていない求人も含める</span>
      </label>
    </fieldset>
  );
}
