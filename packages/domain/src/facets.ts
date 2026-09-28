import type { EmploymentType, FacetMap, FactMap, FacetValues } from './types';
import { normalizeText } from './text';

export interface FacetOption {
  value: string;
  label: string;
}

export interface FacetDeriveInput {
  facts: FactMap;
  employmentTypes: EmploymentType[];
}

/**
 * 職種専用の絞り込み条件。
 * - key はURLパラメーター名（職種間で重複させない）
 * - derive は原文の記載だけから判定し、判定できなければ null（不明）を返す
 * - 不明の求人は、どの選択肢にも適合させない
 */
export interface FacetDefinition {
  key: string;
  label: string;
  /** カード・比較・詳細で原文を表示する項目名。雇用形態から導く条件は null */
  factLabel: string | null;
  options: FacetOption[];
  /** 条件に表示する補足 */
  hint?: string;
  derive: (input: FacetDeriveInput) => FacetValues;
}

function factText(facts: FactMap, label: string): string | null {
  const value = facts[label];
  if (value === null || value === undefined) return null;
  const text = Array.isArray(value) ? value.join(' / ') : String(value);
  const normalized = normalizeText(text);
  return normalized.length > 0 ? normalized : null;
}

function nonEmpty(values: string[]): FacetValues {
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : null;
}

/**
 * 「なし」「あり」を明記している場合だけ yes/no にする。
 * 両方を含む条件付きの記載（例：なし・ただし繁忙期あり）は不明として扱う。
 */
function yesNo(text: string | null): FacetValues {
  if (text === null) return null;
  const saysNo = /(なし|無し|ありません|不要)/.test(text);
  const saysYes = /(あり|有り|ある|[0-9]+回|専従|必要)/.test(text.replace(/ありません/g, ''));
  if (saysNo && saysYes) return null;
  if (saysNo) return ['no'];
  if (saysYes) return ['yes'];
  return null;
}

const YES_NO = (yes: string, no: string): FacetOption[] => [
  { value: 'no', label: no },
  { value: 'yes', label: yes },
];

const driverFacets: FacetDefinition[] = [
  {
    key: 'license',
    label: '必要免許',
    factLabel: '必要免許',
    options: [
      { value: 'ordinary', label: '普通免許' },
      { value: 'semi_medium', label: '準中型免許' },
      { value: 'medium', label: '中型免許' },
      { value: 'large', label: '大型免許' },
    ],
    hint: '求人に記載された必要免許で絞り込みます',
    derive: ({ facts }) => {
      const text = factText(facts, '必要免許');
      if (text === null) return null;
      const values: string[] = [];
      if (text.includes('準中型')) values.push('semi_medium');
      if (text.replace(/準中型/g, '').includes('中型')) values.push('medium');
      if (text.includes('大型')) values.push('large');
      if (text.includes('普通')) values.push('ordinary');
      return nonEmpty(values);
    },
  },
  {
    key: 'vehicle',
    label: '車両',
    factLabel: '車両',
    options: [
      { value: 'light', label: '軽自動車・バン' },
      { value: 't2', label: '2t車' },
      { value: 't4', label: '4t車' },
      { value: 'large', label: '大型車（10t等）' },
      { value: 'trailer', label: 'トレーラー' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '車両');
      if (text === null) return null;
      const values: string[] = [];
      if (/軽/.test(text)) values.push('light');
      if (/(^|[^0-9])2(t|トン)/.test(text)) values.push('t2');
      if (/(^|[^0-9])4(t|トン)/.test(text)) values.push('t4');
      if (/10(t|トン)|大型/.test(text)) values.push('large');
      if (/トレーラー/.test(text)) values.push('trailer');
      return nonEmpty(values);
    },
  },
  {
    key: 'range',
    label: '配送範囲',
    factLabel: '配送範囲',
    options: [
      { value: 'local', label: '地場・近距離' },
      { value: 'middle', label: '中距離' },
      { value: 'long', label: '長距離' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '配送範囲');
      if (text === null) return null;
      const values: string[] = [];
      if (/地場|近距離|市内/.test(text)) values.push('local');
      if (/中距離/.test(text)) values.push('middle');
      if (/長距離/.test(text)) values.push('long');
      return nonEmpty(values);
    },
  },
  {
    key: 'manualLoading',
    label: '手積み',
    factLabel: '手積み',
    options: YES_NO('手積みあり', '手積みなし（明記あり）'),
    hint: '記載のない求人は「なし」に含めません',
    derive: ({ facts }) => yesNo(factText(facts, '手積み')),
  },
  {
    key: 'home',
    label: '帰宅頻度',
    factLabel: '帰宅頻度',
    options: [
      { value: 'daily', label: '毎日帰宅（明記あり）' },
      { value: 'weekly', label: '週単位で帰宅' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '帰宅頻度');
      if (text === null) return null;
      if (/毎日/.test(text)) return ['daily'];
      if (/週/.test(text)) return ['weekly'];
      return null;
    },
  },
];

const manufacturingFacets: FacetDefinition[] = [
  {
    key: 'shift',
    label: 'シフト',
    factLabel: 'シフト',
    options: [
      { value: 'day', label: '日勤' },
      { value: 'rotating', label: '交替制（2交替・3交替）' },
      { value: 'night', label: '夜勤' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, 'シフト');
      if (text === null) return null;
      if (/交替|交代/.test(text)) return ['rotating'];
      const values: string[] = [];
      if (/日勤/.test(text)) values.push('day');
      if (/夜勤/.test(text)) values.push('night');
      return nonEmpty(values);
    },
  },
  {
    key: 'dorm',
    label: '寮',
    factLabel: '寮',
    options: YES_NO('寮あり', '寮なし'),
    derive: ({ facts }) => {
      const text = factText(facts, '寮');
      if (text === null) return null;
      if (/^(あり|有り)/.test(text)) return ['yes'];
      if (/^(なし|無し)/.test(text)) return ['no'];
      return null;
    },
  },
  {
    key: 'task',
    label: '作業内容',
    factLabel: '作業内容',
    options: [
      { value: 'assembly', label: '組立' },
      { value: 'picking', label: 'ピッキング・仕分け' },
      { value: 'inspection', label: '検査・検品' },
      { value: 'packing', label: '梱包' },
      { value: 'line', label: 'ライン作業' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '作業内容');
      if (text === null) return null;
      const values: string[] = [];
      if (/組立|組み立て/.test(text)) values.push('assembly');
      if (/ピッキング|仕分/.test(text)) values.push('picking');
      if (/検査|検品/.test(text)) values.push('inspection');
      if (/梱包/.test(text)) values.push('packing');
      if (/ライン/.test(text)) values.push('line');
      return nonEmpty(values);
    },
  },
  {
    key: 'heavy',
    label: '重量物',
    factLabel: '重量物',
    options: YES_NO('重量物あり', '重量物なし（明記あり）'),
    derive: ({ facts }) => yesNo(factText(facts, '重量物')),
  },
  {
    key: 'hire',
    label: '直接雇用／派遣',
    factLabel: null,
    options: [
      { value: 'direct', label: '直接雇用' },
      { value: 'dispatch', label: '派遣' },
    ],
    hint: '雇用形態の記載から判定します',
    derive: ({ employmentTypes }) => {
      const values: string[] = [];
      for (const type of employmentTypes) {
        if (type === 'dispatch') values.push('dispatch');
        else if (type === 'fulltime' || type === 'contract' || type === 'parttime') values.push('direct');
      }
      return nonEmpty(values);
    },
  },
];

const nurseFacets: FacetDefinition[] = [
  {
    key: 'facility',
    label: '施設形態',
    factLabel: '施設形態',
    options: [
      { value: 'hospital', label: '病院' },
      { value: 'clinic', label: 'クリニック' },
      { value: 'visiting', label: '訪問看護' },
      { value: 'care_facility', label: '介護施設' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '施設形態');
      if (text === null) return null;
      const values: string[] = [];
      if (/病院/.test(text)) values.push('hospital');
      if (/クリニック|診療所/.test(text)) values.push('clinic');
      if (/訪問看護/.test(text)) values.push('visiting');
      if (/介護|老人|特養|グループホーム/.test(text)) values.push('care_facility');
      return nonEmpty(values);
    },
  },
  {
    key: 'lpn',
    label: '必要資格',
    factLabel: '必要資格',
    options: [{ value: 'ok', label: '准看護師も応募可（明記あり）' }],
    hint: '「看護師または准看護師」など、准看護師の記載がある求人だけを表示します',
    derive: ({ facts }) => {
      const text = factText(facts, '必要資格');
      if (text === null) return null;
      if (/准看護師(は)?不可/.test(text)) return ['no'];
      if (/准看護師/.test(text)) return ['ok'];
      if (/正看護師/.test(text)) return ['no'];
      return null;
    },
  },
  {
    key: 'night',
    label: '夜勤',
    factLabel: '夜勤',
    options: YES_NO('夜勤あり', '夜勤なし（明記あり）'),
    derive: ({ facts }) => yesNo(factText(facts, '夜勤')),
  },
  {
    key: 'onCall',
    label: 'オンコール',
    factLabel: 'オンコール',
    options: YES_NO('オンコールあり', 'オンコールなし（明記あり）'),
    hint: '記載のない求人は「なし」に含めません',
    derive: ({ facts }) => yesNo(factText(facts, 'オンコール')),
  },
  {
    key: 'dept',
    label: '診療科',
    factLabel: '診療科',
    options: [
      { value: 'internal', label: '内科' },
      { value: 'surgery', label: '外科' },
      { value: 'orthopedics', label: '整形外科' },
      { value: 'pediatrics', label: '小児科' },
      { value: 'psychiatry', label: '精神科' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '診療科');
      if (text === null) return null;
      const values: string[] = [];
      if (/内科/.test(text)) values.push('internal');
      if (/整形外科/.test(text)) values.push('orthopedics');
      if (/(^|[^整形])外科/.test(text)) values.push('surgery');
      if (/小児/.test(text)) values.push('pediatrics');
      if (/精神/.test(text)) values.push('psychiatry');
      return nonEmpty(values);
    },
  },
];

const TECH_TOKENS: readonly { value: string; label: string; pattern: RegExp }[] = [
  { value: 'typescript', label: 'TypeScript', pattern: /typescript/ },
  { value: 'javascript', label: 'JavaScript', pattern: /javascript/ },
  { value: 'react', label: 'React', pattern: /react/ },
  { value: 'nextjs', label: 'Next.js', pattern: /next\.?js/ },
  { value: 'python', label: 'Python', pattern: /python/ },
  { value: 'go', label: 'Go', pattern: /(^|[^a-z])go([^a-z]|$)|golang/ },
  { value: 'java', label: 'Java', pattern: /java(?!script)/ },
  { value: 'sql', label: 'SQL', pattern: /(^|[^a-z])sql|postgresql|mysql/ },
  { value: 'aws', label: 'AWS', pattern: /aws/ },
  { value: 'kubernetes', label: 'Kubernetes', pattern: /kubernetes|k8s/ },
  { value: 'terraform', label: 'Terraform', pattern: /terraform/ },
];

const engineerFacets: FacetDefinition[] = [
  {
    key: 'tech',
    label: '技術',
    factLabel: '技術',
    options: TECH_TOKENS.map(({ value, label }) => ({ value, label })),
    hint: '選んだ技術のいずれかを含む求人',
    derive: ({ facts }) => {
      const text = factText(facts, '技術');
      if (text === null) return null;
      return nonEmpty(TECH_TOKENS.filter((t) => t.pattern.test(text)).map((t) => t.value));
    },
  },
  {
    key: 'office',
    label: '出社頻度',
    factLabel: '出社頻度',
    options: [
      { value: 'remote', label: 'フルリモート' },
      { value: 'hybrid', label: '一部出社（週1〜4日・月数回）' },
      { value: 'onsite', label: '出社（週5日）' },
    ],
    hint: '完全在宅と一部在宅を区別します',
    derive: ({ facts }) => {
      const text = factText(facts, '出社頻度');
      if (text === null) return null;
      if (/フルリモート|完全在宅|フル在宅|出社なし/.test(text)) return ['remote'];
      if (/週5|常駐|毎日出社/.test(text)) return ['onsite'];
      if (/週[1-4]|月[0-9]/.test(text)) return ['hybrid'];
      return null;
    },
  },
  {
    key: 'workStyle',
    label: '業務形態',
    factLabel: '業務形態',
    options: [
      { value: 'in_house', label: '自社開発・自社サービス' },
      { value: 'contract_dev', label: '受託開発' },
      { value: 'corporate_it', label: '社内IT' },
      { value: 'ses', label: 'SES' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '業務形態');
      if (text === null) return null;
      const values: string[] = [];
      if (/自社開発|自社サービス/.test(text)) values.push('in_house');
      if (/受託/.test(text)) values.push('contract_dev');
      if (/社内it|社内se|情報システム/.test(text)) values.push('corporate_it');
      if (/ses/.test(text)) values.push('ses');
      return nonEmpty(values);
    },
  },
  {
    key: 'phase',
    label: '担当工程',
    factLabel: '担当工程',
    options: [
      { value: 'requirements', label: '要件定義' },
      { value: 'design', label: '設計' },
      { value: 'implementation', label: '実装' },
      { value: 'testing', label: 'テスト' },
      { value: 'operation', label: '運用・保守' },
    ],
    derive: ({ facts }) => {
      const text = factText(facts, '担当工程');
      if (text === null) return null;
      const values: string[] = [];
      if (/要件定義/.test(text)) values.push('requirements');
      if (/設計/.test(text)) values.push('design');
      if (/実装|開発/.test(text)) values.push('implementation');
      if (/テスト/.test(text)) values.push('testing');
      if (/運用|保守/.test(text)) values.push('operation');
      return nonEmpty(values);
    },
  },
  {
    key: 'contract',
    label: '雇用／業務委託',
    factLabel: null,
    options: [
      { value: 'employee', label: '雇用（正社員・契約社員など）' },
      { value: 'freelance', label: '業務委託' },
    ],
    hint: '雇用形態の記載から判定します',
    derive: ({ employmentTypes }) => {
      const values: string[] = [];
      for (const type of employmentTypes) {
        if (type === 'freelance') values.push('freelance');
        else if (type !== 'other') values.push('employee');
      }
      return nonEmpty(values);
    },
  },
];

/** 高度な比較条件を先行して作る4職種。その他の職種は共通条件のみ。 */
export const SPECIALIZED_FACETS: Readonly<Record<string, readonly FacetDefinition[]>> = {
  driver: driverFacets,
  manufacturing: manufacturingFacets,
  nurse: nurseFacets,
  engineer: engineerFacets,
};

export function facetsForOccupation(slug: string | null | undefined): readonly FacetDefinition[] {
  if (!slug) return [];
  return SPECIALIZED_FACETS[slug] ?? [];
}

/** すべての職種専用条件のキー → 所属する職種 */
export const FACET_OWNER: ReadonlyMap<string, string> = new Map(
  Object.entries(SPECIALIZED_FACETS).flatMap(([slug, defs]) => defs.map((d) => [d.key, slug] as const)),
);

export function findFacet(key: string): { occupation: string; facet: FacetDefinition } | undefined {
  const occupation = FACET_OWNER.get(key);
  if (!occupation) return undefined;
  const facet = SPECIALIZED_FACETS[occupation]?.find((d) => d.key === key);
  return facet ? { occupation, facet } : undefined;
}

export function facetOptionLabel(key: string, value: string): string {
  return findFacet(key)?.facet.options.find((o) => o.value === value)?.label ?? value;
}

/** 原文の事実条件から、その職種の絞り込みコードを導く */
export function deriveFacets(occupation: string, input: FacetDeriveInput): FacetMap {
  const result: FacetMap = {};
  for (const def of facetsForOccupation(occupation)) {
    result[def.key] = def.derive(input);
  }
  return result;
}
