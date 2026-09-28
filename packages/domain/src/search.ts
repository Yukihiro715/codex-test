import type { PublicJobSummary } from './types';
import { FRESHNESS_OPTIONS, employmentTypeLabel } from './labels';
import { facetsForOccupation, findFacet } from './facets';
import { getOccupation, occupationLabel } from './occupations';
import { getPrefectureByCode } from './prefectures';
import {
  PAGE_SIZE,
  activeGroups,
  groupLabel,
  removeGroup,
  type ConditionGroup,
  type QueryIssue,
  type SearchQuery,
} from './query';
import { isSalaryFilterable, isSalaryLowerBoundUnknown, matchesSalaryCondition } from './salary';
import { normalizeText, tokenizeKeyword } from './text';
import { hoursBetween, isWithinHours } from './time';

type Verdict = 'match' | 'nomatch' | 'unknown';

interface Condition {
  group: ConditionGroup;
  test: (job: PublicJobSummary) => Verdict;
  /** 不明を条件に含める（給与の「下限の記載なしも含める」）。含めても適合数には数えない */
  includeUnknown: boolean;
  /** 不明で除外した件数を通知する条件 */
  reportUnknown: boolean;
}

export interface SearchContext {
  now: Date;
  pageSize?: number;
  sourceName?: (id: string) => string;
}

export type FacetCounts = Record<string, Record<string, number>>;

export interface Relaxation {
  group: ConditionGroup;
  label: string;
  count: number;
  query: SearchQuery;
}

export interface UnknownNote {
  group: ConditionGroup;
  label: string;
  count: number;
}

export interface SearchOutcome {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  items: PublicJobSummary[];
  facetCounts: FacetCounts;
  relaxations: Relaxation[];
  unknownNotes: UnknownNote[];
  issues: QueryIssue[];
}

function haystackParts(job: PublicJobSummary): { title: string; strong: string; rest: string } {
  const factText = Object.values(job.facts)
    .flatMap((v) => (v === null ? [] : Array.isArray(v) ? v : [String(v)]))
    .join(' ');
  return {
    title: normalizeText(job.title),
    strong: normalizeText(`${occupationLabel(job.occupation)} ${factText} ${job.requiredQualification ?? ''}`),
    rest: normalizeText(
      [
        job.employerName,
        job.workingHours ?? '',
        ...job.locations.map((l) => `${getPrefectureByCode(l.prefectureCode ?? '')?.name ?? ''} ${l.city ?? ''} ${l.displayAddress}`),
        ...job.employmentTypes.map(employmentTypeLabel),
      ].join(' '),
    ),
  };
}

function keywordScore(job: PublicJobSummary, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const parts = haystackParts(job);
  let score = 0;
  for (const token of tokens) {
    if (parts.title.includes(token)) score += 3;
    else if (parts.strong.includes(token)) score += 2;
    else if (parts.rest.includes(token)) score += 1;
    else return -1;
  }
  return score;
}

function buildConditions(query: SearchQuery, now: Date): Condition[] {
  const conditions: Condition[] = [];
  const tokens = query.q ? tokenizeKeyword(query.q) : [];
  if (tokens.length > 0) {
    conditions.push({
      group: 'q',
      test: (job) => (keywordScore(job, tokens) >= 0 ? 'match' : 'nomatch'),
      includeUnknown: false,
      reportUnknown: false,
    });
  }
  if (query.loc) {
    const loc = normalizeText(query.loc);
    conditions.push({
      group: 'loc',
      test: (job) => {
        if (job.locations.length === 0) return 'unknown';
        return job.locations.some((l) =>
          normalizeText(`${getPrefectureByCode(l.prefectureCode ?? '')?.name ?? ''}${l.city ?? ''} ${l.displayAddress}`).includes(loc),
        )
          ? 'match'
          : 'nomatch';
      },
      includeUnknown: false,
      reportUnknown: true,
    });
  }
  if (query.pref) {
    const pref = query.pref;
    conditions.push({
      group: 'pref',
      test: (job) => {
        if (job.locations.length === 0) return 'unknown';
        return job.locations.some((l) => l.prefectureCode === pref) ? 'match' : 'nomatch';
      },
      includeUnknown: false,
      reportUnknown: true,
    });
  }
  if (query.occupation) {
    const occupation = query.occupation;
    conditions.push({
      group: 'occupation',
      test: (job) => (job.occupation === occupation ? 'match' : 'nomatch'),
      includeUnknown: false,
      reportUnknown: false,
    });
  }
  for (const def of facetsForOccupation(query.occupation)) {
    const selected = query.facets[def.key];
    if (!selected || selected.length === 0) continue;
    conditions.push({
      group: `facet:${def.key}`,
      test: (job) => {
        const values = job.facets[def.key];
        if (values === null || values === undefined) return 'unknown';
        return values.some((v) => selected.includes(v)) ? 'match' : 'nomatch';
      },
      includeUnknown: false,
      reportUnknown: true,
    });
  }
  if (query.emp.length > 0) {
    const emp = query.emp;
    conditions.push({
      group: 'emp',
      test: (job) => {
        if (job.employmentTypes.length === 0) return 'unknown';
        return job.employmentTypes.some((e) => emp.includes(e)) ? 'match' : 'nomatch';
      },
      includeUnknown: false,
      reportUnknown: true,
    });
  }
  if (query.salaryUnit) {
    const unit = query.salaryUnit;
    const min = query.salaryMin;
    conditions.push({
      group: 'salary',
      test: (job) => {
        if (matchesSalaryCondition(job.salary, unit, min)) return 'match';
        if (isSalaryLowerBoundUnknown(job.salary, unit)) return 'unknown';
        return 'nomatch';
      },
      includeUnknown: query.salaryUnknown,
      reportUnknown: !query.salaryUnknown,
    });
  }
  if (query.route.length > 0) {
    const route = query.route;
    conditions.push({
      group: 'route',
      test: (job) => {
        if (job.applicationRoute === 'unknown') return 'unknown';
        return route.includes(job.applicationRoute) ? 'match' : 'nomatch';
      },
      includeUnknown: false,
      reportUnknown: true,
    });
  }
  if (query.fresh) {
    const hours = FRESHNESS_OPTIONS.find((f) => f.value === query.fresh)?.hours ?? 0;
    conditions.push({
      group: 'fresh',
      test: (job) => (isWithinHours(job.lastFetchedAt, now, hours) ? 'match' : 'nomatch'),
      includeUnknown: false,
      reportUnknown: false,
    });
  }
  if (query.source.length > 0) {
    const source = query.source;
    conditions.push({
      group: 'source',
      test: (job) => (source.includes(job.sourceId) ? 'match' : 'nomatch'),
      includeUnknown: false,
      reportUnknown: false,
    });
  }
  return conditions;
}

interface Evaluated {
  job: PublicJobSummary;
  verdicts: Map<ConditionGroup, Verdict>;
}

function passes(evaluated: Evaluated, conditions: Condition[], exclude?: (group: ConditionGroup) => boolean): boolean {
  return conditions.every((c) => {
    if (exclude?.(c.group)) return true;
    const verdict = evaluated.verdicts.get(c.group);
    return verdict === 'match' || (verdict === 'unknown' && c.includeUnknown);
  });
}

/** 正確性：比較に使う主要項目のうち、記載が確認できる割合 */
function completeness(job: PublicJobSummary): number {
  const fields = getOccupation(job.occupation)?.compareFields ?? [];
  let known = 0;
  let total = 0;
  const count = (ok: boolean) => {
    total += 1;
    if (ok) known += 1;
  };
  count(isSalaryFilterable(job.salary));
  count(job.employmentTypes.length > 0);
  count(job.locations.length > 0);
  for (const field of fields) {
    const value = job.facts[field];
    count(value !== null && value !== undefined);
  }
  return total === 0 ? 0 : known / total;
}

function postedKey(job: PublicJobSummary): string {
  return job.sourcePostedAt ?? job.firstSeenAt;
}

/**
 * fixture・テスト用のインメモリ検索。M1ではDB/検索エンジン実装に置き換えるが、
 * 条件の意味（不明を適合させない、単位違いを混ぜない等）はこの実装を基準にする。
 */
export function searchJobs(jobs: readonly PublicJobSummary[], query: SearchQuery, ctx: SearchContext): SearchOutcome {
  const pageSize = ctx.pageSize ?? PAGE_SIZE;
  const conditions = buildConditions(query, ctx.now);
  const tokens = query.q ? tokenizeKeyword(query.q) : [];
  const evaluated: Evaluated[] = jobs.map((job) => ({
    job,
    verdicts: new Map(conditions.map((c) => [c.group, c.test(job)])),
  }));

  const matched = evaluated.filter((e) => passes(e, conditions));

  const scored = matched.map((e) => ({
    job: e.job,
    matchScore: [...e.verdicts.values()].filter((v) => v === 'match').length,
    completeness: completeness(e.job),
    freshnessBucket: Math.floor(Math.max(0, hoursBetween(e.job.lastFetchedAt, ctx.now)) / 24),
    keyword: keywordScore(e.job, tokens),
  }));

  type Scored = (typeof scored)[number];
  const byRelevance = (a: Scored, b: Scored) =>
    b.matchScore - a.matchScore ||
    b.completeness - a.completeness ||
    a.freshnessBucket - b.freshnessBucket ||
    b.keyword - a.keyword ||
    b.job.lastFetchedAt.localeCompare(a.job.lastFetchedAt) ||
    a.job.id.localeCompare(b.job.id);

  if (query.sort === 'salary' && query.salaryUnit) {
    const unit = query.salaryUnit;
    const salaryKey = (s: Scored) => (s.job.salary.unit === unit && isSalaryFilterable(s.job.salary) ? (s.job.salary.min ?? -1) : -1);
    scored.sort((a, b) => salaryKey(b) - salaryKey(a) || byRelevance(a, b));
  } else if (query.sort === 'newest') {
    scored.sort((a, b) => postedKey(b.job).localeCompare(postedKey(a.job)) || byRelevance(a, b));
  } else {
    scored.sort(byRelevance);
  }

  const total = scored.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const issues: QueryIssue[] = [];
  let page = query.page;
  if (page > pageCount) {
    issues.push({ param: 'page', value: String(page), message: `ページ番号が範囲外のため、${pageCount}ページ目を表示しています。` });
    page = pageCount;
  }
  const items = scored.slice((page - 1) * pageSize, page * pageSize).map((s) => s.job);

  // 絞り込みの件数（同じグループ内は「いずれか」、他のグループは適用した状態で数える）
  const facetCounts: FacetCounts = {};
  const countBy = (group: string, exclude: (g: ConditionGroup) => boolean, keys: (job: PublicJobSummary) => Iterable<string>) => {
    const counts: Record<string, number> = {};
    for (const e of evaluated) {
      if (!passes(e, conditions, exclude)) continue;
      for (const key of new Set(keys(e.job))) counts[key] = (counts[key] ?? 0) + 1;
    }
    facetCounts[group] = counts;
  };
  countBy('occupation', (g) => g === 'occupation' || g.startsWith('facet:'), (job) => [job.occupation]);
  countBy('pref', (g) => g === 'pref', (job) => job.locations.flatMap((l) => (l.prefectureCode ? [l.prefectureCode] : [])));
  countBy('emp', (g) => g === 'emp', (job) => job.employmentTypes);
  countBy('salaryUnit', (g) => g === 'salary', (job) => (isSalaryFilterable(job.salary) ? [job.salary.unit] : []));
  countBy('route', (g) => g === 'route', (job) => [job.applicationRoute]);
  countBy('fresh', (g) => g === 'fresh', (job) => FRESHNESS_OPTIONS.filter((f) => isWithinHours(job.lastFetchedAt, ctx.now, f.hours)).map((f) => f.value));
  countBy('source', (g) => g === 'source', (job) => [job.sourceId]);
  for (const def of facetsForOccupation(query.occupation)) {
    const group = `facet:${def.key}` as const;
    countBy(group, (g) => g === group, (job) => job.facets[def.key] ?? []);
  }

  const sourceName = ctx.sourceName ?? ((id: string) => id);
  const groups = activeGroups(query);

  const relaxations: Relaxation[] =
    total > 0
      ? []
      : groups
          .map((group) => ({
            group,
            label: `${groupLabel(query, group, sourceName)}を外す`,
            count: evaluated.filter((e) => passes(e, conditions, (g) => g === group || (group === 'occupation' && g.startsWith('facet:')))).length,
            query: removeGroup(query, group),
          }))
          .filter((r) => r.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

  const unknownNotes: UnknownNote[] = conditions
    .filter((c) => c.reportUnknown)
    .map((c) => ({
      group: c.group,
      label: unknownLabel(c.group),
      count: evaluated.filter((e) => e.verdicts.get(c.group) === 'unknown' && passes(e, conditions, (g) => g === c.group)).length,
    }))
    .filter((n) => n.count > 0);

  return { total, page, pageSize, pageCount, items, facetCounts, relaxations, unknownNotes, issues };
}

function unknownLabel(group: ConditionGroup): string {
  switch (group) {
    case 'salary':
      return '給与の下限';
    case 'loc':
    case 'pref':
      return '勤務地';
    case 'emp':
      return '雇用形態';
    case 'route':
      return '応募経路';
    default: {
      if (group.startsWith('facet:')) {
        const key = group.slice('facet:'.length);
        return findFacet(key)?.facet.label ?? key;
      }
      return group;
    }
  }
}

