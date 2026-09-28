import type { ApplicationRoute, EmploymentType, KnownSalaryUnit } from './types';
import {
  APPLICATION_ROUTES,
  EMPLOYMENT_TYPES,
  FRESHNESS_OPTIONS,
  SALARY_UNITS,
  SORT_OPTIONS,
  applicationRouteLabel,
  employmentTypeLabel,
  salaryUnitLabel,
  type FreshnessValue,
  type SortValue,
} from './labels';
import { FACET_OWNER, facetOptionLabel, facetsForOccupation, findFacet } from './facets';
import { isOccupationSlug, occupationLabel } from './occupations';
import { findPrefectureByName, getPrefectureByCode } from './prefectures';
import { SALARY_INPUT_LIMITS } from './salary';
import { sanitizeFreeText } from './text';

export type RouteFilter = Exclude<ApplicationRoute, 'unknown'>;

/**
 * 検索条件。URLが唯一の状態（フィルター状態はURLに保存し、戻る/進む/再読込で復元する）。
 */
export interface SearchQuery {
  q: string | null;
  /** 勤務地の自由入力（市区町村名など）。都道府県名と一致する場合は pref に正規化する */
  loc: string | null;
  /** 都道府県コード（JIS X 0401） */
  pref: string | null;
  occupation: string | null;
  emp: EmploymentType[];
  salaryUnit: KnownSalaryUnit | null;
  salaryMin: number | null;
  /** 給与条件の指定時、下限の記載がない求人も含める（既定は除外） */
  salaryUnknown: boolean;
  route: RouteFilter[];
  fresh: FreshnessValue | null;
  source: string[];
  /** 職種専用条件（現在の職種に属するキーだけを保持） */
  facets: Record<string, string[]>;
  sort: SortValue;
  page: number;
}

export const DEFAULT_QUERY: SearchQuery = Object.freeze({
  q: null,
  loc: null,
  pref: null,
  occupation: null,
  emp: [],
  salaryUnit: null,
  salaryMin: null,
  salaryUnknown: false,
  route: [],
  fresh: null,
  source: [],
  facets: {},
  sort: 'relevance',
  page: 1,
}) as SearchQuery;

export const PAGE_SIZE = 20;
export const MAX_PAGE = 500;
export const KEYWORD_MAX_LENGTH = 100;
export const LOCATION_MAX_LENGTH = 40;
const SOURCE_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

export interface QueryIssue {
  param: string;
  value: string;
  message: string;
}

export type QueryInput = URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>;

function collect(input: QueryInput): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const push = (key: string, value: string) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => push(key, value));
  } else {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (typeof value === 'string') push(key, value);
      else for (const v of value) push(key, v);
    }
  }
  return map;
}

function splitValues(raw: readonly string[]): string[] {
  return [...new Set(raw.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))];
}

function preview(value: string): string {
  return value.length > 30 ? `${value.slice(0, 30)}…` : value;
}

const SALARY_UNIT_VALUES = new Set<string>(SALARY_UNITS.map((u) => u.value));
const EMPLOYMENT_VALUES = new Set<string>(EMPLOYMENT_TYPES.filter((e) => e.value !== 'other').map((e) => e.value));
const ROUTE_VALUES = new Set<string>(APPLICATION_ROUTES.map((r) => r.value));
const FRESH_VALUES = new Set<string>(FRESHNESS_OPTIONS.map((f) => f.value));
const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((s) => s.value));

export interface ParseOptions {
  /** 既知のソースID（指定時は未知のIDを無視して通知） */
  sourceIds?: ReadonlySet<string>;
}

/**
 * URLのクエリを型検証して SearchQuery にする。
 * 存在しない値・型の合わない値は無視し、issues で利用者に通知する（条件を黙って変えない）。
 */
export function parseSearchQuery(input: QueryInput, options: ParseOptions = {}): { query: SearchQuery; issues: QueryIssue[] } {
  const raw = collect(input);
  const issues: QueryIssue[] = [];
  const query: SearchQuery = { ...DEFAULT_QUERY, emp: [], route: [], source: [], facets: {} };
  const first = (key: string): string | undefined => raw.get(key)?.find((v) => v.trim().length > 0);

  const q = raw.get('q');
  if (q) {
    const text = sanitizeFreeText(q.join(' '), KEYWORD_MAX_LENGTH);
    query.q = text.length > 0 ? text : null;
  }

  const occupation = first('occupation');
  if (occupation !== undefined) {
    if (isOccupationSlug(occupation)) query.occupation = occupation;
    else issues.push({ param: 'occupation', value: preview(occupation), message: '指定された職種が見つからないため、職種の条件を無視しました。' });
  }

  const pref = first('pref');
  if (pref !== undefined) {
    if (getPrefectureByCode(pref)) query.pref = pref;
    else issues.push({ param: 'pref', value: preview(pref), message: '都道府県の指定を読み取れないため無視しました。' });
  }

  const loc = raw.get('loc');
  if (loc) {
    const text = sanitizeFreeText(loc.join(' '), LOCATION_MAX_LENGTH);
    const prefecture = text ? findPrefectureByName(text) : undefined;
    if (prefecture && (query.pref === null || query.pref === prefecture.code)) {
      query.pref = prefecture.code;
    } else if (text) {
      query.loc = text;
    }
  }

  const emp = raw.get('emp');
  if (emp) {
    for (const value of splitValues(emp)) {
      if (EMPLOYMENT_VALUES.has(value)) query.emp.push(value as EmploymentType);
      else issues.push({ param: 'emp', value: preview(value), message: '雇用形態の指定を読み取れないため無視しました。' });
    }
  }

  const unit = first('salaryUnit');
  if (unit !== undefined) {
    const upper = unit.toUpperCase();
    if (SALARY_UNIT_VALUES.has(upper)) query.salaryUnit = upper as KnownSalaryUnit;
    else issues.push({ param: 'salaryUnit', value: preview(unit), message: '給与の単位は時給・日給・月給・年収から選んでください。単位の条件を無視しました。' });
  }

  const salaryMin = first('salaryMin');
  if (salaryMin !== undefined) {
    if (query.salaryUnit === null) {
      issues.push({ param: 'salaryMin', value: preview(salaryMin), message: '給与の単位が指定されていないため、下限額を無視しました。単位を選んでから指定してください。' });
    } else if (!/^\d{1,9}$/.test(salaryMin)) {
      issues.push({ param: 'salaryMin', value: preview(salaryMin), message: '給与の下限額は円単位の整数で指定してください。下限額を無視しました。' });
    } else {
      const amount = Number(salaryMin);
      const limits = SALARY_INPUT_LIMITS[query.salaryUnit];
      if (amount < limits.min || amount > limits.max) {
        issues.push({ param: 'salaryMin', value: preview(salaryMin), message: `${salaryUnitLabel(query.salaryUnit)}の下限額として範囲外のため無視しました。` });
      } else {
        query.salaryMin = amount;
      }
    }
  }

  const salaryUnknown = first('salaryUnknown');
  if (salaryUnknown !== undefined) {
    if (salaryUnknown === 'include' || salaryUnknown === '1' || salaryUnknown === 'true') {
      if (query.salaryUnit !== null) query.salaryUnknown = true;
    } else {
      issues.push({ param: 'salaryUnknown', value: preview(salaryUnknown), message: '給与未記載の扱いを読み取れないため無視しました。' });
    }
  }

  const route = raw.get('route');
  if (route) {
    for (const value of splitValues(route)) {
      if (ROUTE_VALUES.has(value)) query.route.push(value as RouteFilter);
      else issues.push({ param: 'route', value: preview(value), message: '応募経路の指定を読み取れないため無視しました。' });
    }
  }

  const fresh = first('fresh');
  if (fresh !== undefined) {
    if (FRESH_VALUES.has(fresh)) query.fresh = fresh as FreshnessValue;
    else issues.push({ param: 'fresh', value: preview(fresh), message: '最終情報確認の指定を読み取れないため無視しました。' });
  }

  const source = raw.get('source');
  if (source) {
    for (const value of splitValues(source)) {
      const known = SOURCE_ID_PATTERN.test(value) && (!options.sourceIds || options.sourceIds.has(value));
      if (known) query.source.push(value);
      else issues.push({ param: 'source', value: preview(value), message: '指定された掲載元が見つからないため無視しました。' });
    }
  }

  for (const [key, values] of raw) {
    const owner = FACET_OWNER.get(key);
    if (!owner) continue;
    const found = findFacet(key);
    if (!found) continue;
    if (query.occupation !== owner) {
      issues.push({
        param: key,
        value: preview(values.join(',')),
        message: `「${found.facet.label}」は職種「${occupationLabel(owner)}」の専用条件のため、この検索では無視しました。`,
      });
      continue;
    }
    const valid = new Set(found.facet.options.map((o) => o.value));
    const selected: string[] = [];
    for (const value of splitValues(values)) {
      if (valid.has(value)) selected.push(value);
      else issues.push({ param: key, value: preview(value), message: `「${found.facet.label}」の指定を読み取れないため無視しました。` });
    }
    if (selected.length > 0) query.facets[key] = selected;
  }

  const sort = first('sort');
  if (sort !== undefined) {
    if (!SORT_VALUES.has(sort)) {
      issues.push({ param: 'sort', value: preview(sort), message: '並び替えの指定を読み取れないため、おすすめ順にしました。' });
    } else if (sort === 'salary' && query.salaryUnit === null) {
      issues.push({ param: 'sort', value: sort, message: '給与順は給与の単位を選んだときに使えます。おすすめ順にしました。' });
    } else {
      query.sort = sort as SortValue;
    }
  }

  const page = first('page');
  if (page !== undefined) {
    const n = /^\d{1,4}$/.test(page) ? Number(page) : Number.NaN;
    if (Number.isInteger(n) && n >= 1 && n <= MAX_PAGE) query.page = n;
    else issues.push({ param: 'page', value: preview(page), message: 'ページ番号を読み取れないため、1ページ目を表示しました。' });
  }

  return { query, issues };
}

function orderBy<T extends string>(values: readonly T[], order: readonly string[]): T[] {
  return [...values].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib) || a.localeCompare(b);
  });
}

function encodeList(values: readonly string[]): string {
  return values.map((v) => encodeURIComponent(v)).join(',');
}

/** 正規形のクエリ文字列（先頭の ? なし）。既定値は省略する。キャッシュキーとしても使う。 */
export function serializeQuery(query: SearchQuery): string {
  const parts: string[] = [];
  const add = (key: string, value: string) => parts.push(`${key}=${value}`);
  if (query.q) add('q', encodeURIComponent(query.q));
  if (query.loc) add('loc', encodeURIComponent(query.loc));
  if (query.pref) add('pref', query.pref);
  if (query.occupation) add('occupation', query.occupation);
  for (const def of facetsForOccupation(query.occupation)) {
    const values = query.facets[def.key];
    if (values && values.length > 0) add(def.key, encodeList(orderBy(values, def.options.map((o) => o.value))));
  }
  if (query.emp.length > 0) add('emp', encodeList(orderBy(query.emp, EMPLOYMENT_TYPES.map((e) => e.value))));
  if (query.salaryUnit) {
    add('salaryUnit', query.salaryUnit);
    if (query.salaryMin !== null) add('salaryMin', String(query.salaryMin));
    if (query.salaryUnknown) add('salaryUnknown', 'include');
  }
  if (query.route.length > 0) add('route', encodeList(orderBy(query.route, APPLICATION_ROUTES.map((r) => r.value))));
  if (query.fresh) add('fresh', query.fresh);
  if (query.source.length > 0) add('source', encodeList([...query.source].sort()));
  if (query.sort !== 'relevance') add('sort', query.sort);
  if (query.page > 1) add('page', String(query.page));
  return parts.join('&');
}

export function searchHref(query: SearchQuery, pathname = '/jobs'): string {
  const qs = serializeQuery(query);
  return qs ? `${pathname}?${qs}` : pathname;
}

/** 条件を変えたら1ページ目に戻す（page を明示した場合を除く） */
export function withPatch(query: SearchQuery, patch: Partial<SearchQuery>): SearchQuery {
  const next: SearchQuery = { ...query, ...patch };
  if (patch.page === undefined) next.page = 1;
  if (next.salaryUnit === null) {
    next.salaryMin = null;
    next.salaryUnknown = false;
    if (next.sort === 'salary') next.sort = 'relevance';
  }
  return next;
}

/**
 * 職種の変更。前の職種の専用条件だけを解除し、勤務地・雇用形態などの共通条件は保持する。
 * 解除した条件のラベルを返すので、画面で通知する。
 */
export function withOccupation(query: SearchQuery, occupation: string | null): { query: SearchQuery; cleared: string[] } {
  if (query.occupation === occupation) return { query, cleared: [] };
  const cleared = Object.entries(query.facets)
    .filter(([, values]) => values.length > 0)
    .flatMap(([key, values]) => values.map((v) => `${findFacet(key)?.facet.label ?? key}：${facetOptionLabel(key, v)}`));
  return { query: withPatch(query, { occupation, facets: {} }), cleared };
}

/** 職種専用条件の値を置き換える（空配列ならキーごと外す） */
export function withFacetValues(facets: Record<string, string[]>, key: string, values: string[]): Record<string, string[]> {
  const entries = Object.entries(facets).filter(([k]) => k !== key);
  if (values.length > 0) entries.push([key, values]);
  return Object.fromEntries(entries);
}

export function toggleFacetValue(query: SearchQuery, key: string, value: string): SearchQuery {
  const current = query.facets[key] ?? [];
  const nextValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return withPatch(query, { facets: withFacetValues(query.facets, key, nextValues) });
}

export function toggleListValue<K extends 'emp' | 'route' | 'source'>(query: SearchQuery, key: K, value: SearchQuery[K][number]): SearchQuery {
  const current = query[key] as string[];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return withPatch(query, { [key]: next } as Partial<SearchQuery>);
}

/** 条件グループ（緩和提案・不明件数の単位） */
export type ConditionGroup = 'q' | 'loc' | 'pref' | 'occupation' | 'emp' | 'salary' | 'route' | 'fresh' | 'source' | `facet:${string}`;

export function activeGroups(query: SearchQuery): ConditionGroup[] {
  const groups: ConditionGroup[] = [];
  if (query.q) groups.push('q');
  if (query.loc) groups.push('loc');
  if (query.pref) groups.push('pref');
  if (query.occupation) groups.push('occupation');
  for (const def of facetsForOccupation(query.occupation)) {
    if ((query.facets[def.key]?.length ?? 0) > 0) groups.push(`facet:${def.key}`);
  }
  if (query.emp.length > 0) groups.push('emp');
  if (query.salaryUnit) groups.push('salary');
  if (query.route.length > 0) groups.push('route');
  if (query.fresh) groups.push('fresh');
  if (query.source.length > 0) groups.push('source');
  return groups;
}

export function removeGroup(query: SearchQuery, group: ConditionGroup): SearchQuery {
  switch (group) {
    case 'q':
      return withPatch(query, { q: null });
    case 'loc':
      return withPatch(query, { loc: null });
    case 'pref':
      return withPatch(query, { pref: null });
    case 'occupation':
      return withOccupation(query, null).query;
    case 'emp':
      return withPatch(query, { emp: [] });
    case 'salary':
      return withPatch(query, { salaryUnit: null, salaryMin: null, salaryUnknown: false });
    case 'route':
      return withPatch(query, { route: [] });
    case 'fresh':
      return withPatch(query, { fresh: null });
    case 'source':
      return withPatch(query, { source: [] });
    default:
      return withPatch(query, { facets: withFacetValues(query.facets, group.slice('facet:'.length), []) });
  }
}

export function salaryConditionLabel(query: SearchQuery): string | null {
  if (!query.salaryUnit) return null;
  const unit = salaryUnitLabel(query.salaryUnit);
  const base = query.salaryMin !== null ? `${unit}${query.salaryMin.toLocaleString('ja-JP')}円以上` : `${unit}の求人`;
  return query.salaryUnknown ? `${base}（下限の記載なしを含む）` : base;
}

export function groupLabel(query: SearchQuery, group: ConditionGroup, sourceName: (id: string) => string = (id) => id): string {
  switch (group) {
    case 'q':
      return `キーワード「${query.q ?? ''}」`;
    case 'loc':
      return `勤務地「${query.loc ?? ''}」`;
    case 'pref':
      return `都道府県：${getPrefectureByCode(query.pref ?? '')?.name ?? query.pref ?? ''}`;
    case 'occupation':
      return `職種：${occupationLabel(query.occupation ?? '')}`;
    case 'emp':
      return `雇用形態：${query.emp.map(employmentTypeLabel).join('・')}`;
    case 'salary':
      return `給与：${salaryConditionLabel(query) ?? ''}`;
    case 'route':
      return `応募経路：${query.route.map(applicationRouteLabel).join('・')}`;
    case 'fresh':
      return `情報確認：${FRESHNESS_OPTIONS.find((f) => f.value === query.fresh)?.label ?? ''}`;
    case 'source':
      return `掲載元：${query.source.map(sourceName).join('・')}`;
    default: {
      const key = group.slice('facet:'.length);
      const found = findFacet(key);
      const values = (query.facets[key] ?? []).map((v) => facetOptionLabel(key, v));
      return `${found?.facet.label ?? key}：${values.join('・')}`;
    }
  }
}

export interface ActiveCondition {
  id: string;
  group: ConditionGroup;
  label: string;
  /** この条件を外した検索条件 */
  without: SearchQuery;
}

/** 適用中の条件（chips）。1つずつ外せるようにする。 */
export function activeConditions(query: SearchQuery, sourceName: (id: string) => string = (id) => id): ActiveCondition[] {
  const list: ActiveCondition[] = [];
  const single = (group: ConditionGroup) => list.push({ id: group, group, label: groupLabel(query, group, sourceName), without: removeGroup(query, group) });
  if (query.q) single('q');
  if (query.loc) single('loc');
  if (query.pref) single('pref');
  if (query.occupation) single('occupation');
  for (const def of facetsForOccupation(query.occupation)) {
    for (const value of query.facets[def.key] ?? []) {
      list.push({
        id: `facet:${def.key}:${value}`,
        group: `facet:${def.key}`,
        label: `${def.label}：${facetOptionLabel(def.key, value)}`,
        without: toggleFacetValue(query, def.key, value),
      });
    }
  }
  for (const value of query.emp) {
    list.push({ id: `emp:${value}`, group: 'emp', label: employmentTypeLabel(value), without: toggleListValue(query, 'emp', value) });
  }
  if (query.salaryUnit) single('salary');
  for (const value of query.route) {
    list.push({ id: `route:${value}`, group: 'route', label: applicationRouteLabel(value), without: toggleListValue(query, 'route', value) });
  }
  if (query.fresh) single('fresh');
  for (const value of query.source) {
    list.push({ id: `source:${value}`, group: 'source', label: `掲載元：${sourceName(value)}`, without: toggleListValue(query, 'source', value) });
  }
  return list;
}

export function isSameQuery(a: SearchQuery, b: SearchQuery): boolean {
  return serializeQuery(a) === serializeQuery(b);
}

export function hasAnyCondition(query: SearchQuery): boolean {
  return activeGroups(query).length > 0;
}
