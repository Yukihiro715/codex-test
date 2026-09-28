import { beforeEach, describe, expect, it } from 'vitest';
import { clearCompare, compareStore, removeSaved, savedStore, toggleCompare, toggleSaved } from './local-lists';

describe('端末内の保存・比較（localStorage、IDのみ）', () => {
  beforeEach(() => {
    window.localStorage.clear();
    savedStore.set([]);
    clearCompare();
  });

  it('比較は3件まで。4件目は既存を消さずに full を返す（UI07）', () => {
    expect(toggleCompare('a-1')).toBe('added');
    expect(toggleCompare('b-2')).toBe('added');
    expect(toggleCompare('c-3')).toBe('added');
    expect(toggleCompare('d-4')).toBe('full');
    expect(compareStore.getSnapshot()).toEqual(['a-1', 'b-2', 'c-3']);
    expect(toggleCompare('b-2')).toBe('removed');
    expect(compareStore.getSnapshot()).toEqual(['a-1', 'c-3']);
  });

  it('保存は保存順を保ち、localStorageにはIDだけを書く（UI08）', () => {
    expect(toggleSaved('job-1')).toBe(true);
    expect(toggleSaved('job-2')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('worklens:saved:v1') ?? '[]')).toEqual(['job-1', 'job-2']);
    expect(toggleSaved('job-1')).toBe(false);
    removeSaved('job-2');
    expect(savedStore.getSnapshot()).toEqual([]);
  });

  it('保存領域の不正な値（ID以外）は読み込まない', () => {
    savedStore.set(['ok-1', '<script>', 'x'.repeat(100)]);
    expect(savedStore.getSnapshot()).toEqual(['ok-1']);
  });
});
