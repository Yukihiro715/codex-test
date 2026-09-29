import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewPolicyViolations, sourceReviewSchema, type SourceReview } from '@worklens/domain';
import { loadFixtureData } from './fixtures';

/**
 * config/source_reviews の審査記録を検査する。ファイル名が _ で始まる記録は記入例（照合の対象外）。
 * 実ソース候補の設定（config/source_registry.example.json）は、常に審査記録の範囲内でなければならない。
 */
const dir = new URL('../../../config/source_reviews/', import.meta.url);
const files = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .sort();
const records = files.map((file) => ({ file, raw: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as unknown }));
const NOW = new Date('2026-09-29T12:00:00Z');

function parsedReviews(): { file: string; review: SourceReview }[] {
  return records.map(({ file, raw }) => ({ file, review: sourceReviewSchema.parse(raw) }));
}

describe('ソース審査記録（config/source_reviews）', () => {
  it('すべての記録がスキーマと整合性の検査を通る', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const { file, raw } of records) {
      const parsed = sourceReviewSchema.safeParse(raw);
      const detail = parsed.success ? '' : parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join(' / ');
      expect(parsed.success, `${file}: ${detail}`).toBe(true);
    }
  });

  it('記録IDは重複せず、ファイル名は対象のソースID', () => {
    const reviews = parsedReviews();
    const ids = reviews.map(({ review }) => review.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { file, review } of reviews) {
      if (!file.startsWith('_')) expect(file).toBe(`${review.sourceId}.json`);
    }
  });

  it('実ソース候補の設定は審査記録の範囲内で、審査記録には対応する設定がある', () => {
    const reviews = new Map(parsedReviews().filter(({ file }) => !file.startsWith('_')).map(({ review }) => [review.sourceId, review] as const));
    const candidates = loadFixtureData().sources.filter((source) => source.kind === 'candidate');
    for (const source of candidates) {
      expect(reviewPolicyViolations(source, reviews.get(source.id) ?? null, NOW), source.id).toEqual([]);
    }
    const candidateIds = new Set(candidates.map((source) => source.id));
    for (const sourceId of reviews.keys()) expect(candidateIds.has(sourceId), `${sourceId} のソース設定がありません`).toBe(true);
  });
});
