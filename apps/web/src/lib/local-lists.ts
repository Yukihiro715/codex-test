'use client';

import { useSyncExternalStore } from 'react';
import { COMPARE_LIMIT } from '@worklens/domain';

/**
 * 保存・比較は端末のlocalStorageにjob IDだけを保存する（アカウント不要・追跡推薦なし）。
 * localStorageが使えない環境ではメモリ内に保持し、画面で案内する。
 */
const ID_PATTERN = /^[a-z0-9-]{1,80}$/;
const EMPTY: readonly string[] = Object.freeze([]);

export interface ListStore {
  getSnapshot: () => readonly string[];
  getServerSnapshot: () => readonly string[];
  subscribe: (listener: () => void) => () => void;
  set: (ids: readonly string[]) => void;
  isPersistent: () => boolean;
}

export function createListStore(key: string, max: number): ListStore {
  let snapshot: readonly string[] | null = null;
  let memoryOnly = false;
  const listeners = new Set<() => void>();

  const parse = (raw: string | null): readonly string[] => {
    if (!raw) return EMPTY;
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) return EMPTY;
      const ids = value.filter((v): v is string => typeof v === 'string' && ID_PATTERN.test(v));
      return Object.freeze([...new Set(ids)].slice(0, max));
    } catch {
      return EMPTY;
    }
  };

  const read = (): readonly string[] => {
    if (snapshot) return snapshot;
    try {
      snapshot = parse(window.localStorage.getItem(key));
    } catch {
      memoryOnly = true;
      snapshot = EMPTY;
    }
    return snapshot;
  };

  const notify = () => listeners.forEach((l) => l());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    snapshot = null;
    notify();
  };

  return {
    getSnapshot: read,
    getServerSnapshot: () => EMPTY,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    set(ids) {
      const next = Object.freeze([...new Set(ids.filter((id) => ID_PATTERN.test(id)))].slice(0, max));
      snapshot = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        memoryOnly = false;
      } catch {
        memoryOnly = true;
      }
      notify();
    },
    isPersistent() {
      read();
      return !memoryOnly;
    },
  };
}

export const savedStore = createListStore('worklens:saved:v1', 200);
export const compareStore = createListStore('worklens:compare:v1', COMPARE_LIMIT);

export function useSavedIds(): readonly string[] {
  return useSyncExternalStore(savedStore.subscribe, savedStore.getSnapshot, savedStore.getServerSnapshot);
}

export function useCompareIds(): readonly string[] {
  return useSyncExternalStore(compareStore.subscribe, compareStore.getSnapshot, compareStore.getServerSnapshot);
}

/** 保存の切り替え。保存順（配列の順序）を保つ。戻り値は切り替え後の状態 */
export function toggleSaved(id: string): boolean {
  const current = savedStore.getSnapshot();
  if (current.includes(id)) {
    savedStore.set(current.filter((v) => v !== id));
    return false;
  }
  savedStore.set([...current, id]);
  return true;
}

export function removeSaved(id: string): void {
  savedStore.set(savedStore.getSnapshot().filter((v) => v !== id));
}

export type CompareAddResult = 'added' | 'removed' | 'full';

/** 比較の切り替え。上限に達しているときは既存を消さずに 'full' を返す（UI07） */
export function toggleCompare(id: string): CompareAddResult {
  const current = compareStore.getSnapshot();
  if (current.includes(id)) {
    compareStore.set(current.filter((v) => v !== id));
    return 'removed';
  }
  if (current.length >= COMPARE_LIMIT) return 'full';
  compareStore.set([...current, id]);
  return 'added';
}

export function removeFromCompare(id: string): void {
  compareStore.set(compareStore.getSnapshot().filter((v) => v !== id));
}

export function setCompareIds(ids: readonly string[]): void {
  compareStore.set(ids.slice(0, COMPARE_LIMIT));
}

export function clearCompare(): void {
  compareStore.set([]);
}
