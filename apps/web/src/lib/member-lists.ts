'use client';

import { useSyncExternalStore } from 'react';
import { createListStore } from './local-lists';

/**
 * 会員機能のデモで使うブラウザ内の保存領域（M0）。サーバーには送らない。
 * 本実装（M1）では会員ごとにDBへ保存し、ログインした端末どうしで同期する。
 */

/** 最近見た求人（新しい順、最大50件）。会員がログイン中で、履歴を残す設定のときだけ記録する */
export const historyStore = createListStore('worklens:history:v1', 50);

export interface SavedSearch {
  /** 正規形の検索条件（/jobs? の後ろ。page を除く） */
  query: string;
  savedAt: string;
  /** 新着求人をメールで受け取る */
  alert: boolean;
}

export const SAVED_SEARCH_LIMIT = 20;

export interface MemberPrefs {
  /** 閲覧履歴を残す */
  history: boolean;
  /** 保存した検索条件の新着求人メール */
  newJobsMail: boolean;
  /** おすすめ求人のメール */
  recommendMail: boolean;
  /** サービスからのお知らせ */
  newsMail: boolean;
}

export const DEFAULT_MEMBER_PREFS: MemberPrefs = Object.freeze({ history: true, newJobsMail: true, recommendMail: true, newsMail: true });

interface JsonStore<T> {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  set: (value: T) => void;
  clear: () => void;
}

function createJsonStore<T>(key: string, parse: (value: unknown) => T, empty: T): JsonStore<T> {
  let snapshot: T | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const read = (): T => {
    if (snapshot !== null) return snapshot;
    try {
      const raw = window.localStorage.getItem(key);
      snapshot = raw ? parse(JSON.parse(raw)) : empty;
    } catch {
      snapshot = empty;
    }
    return snapshot;
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    snapshot = null;
    notify();
  };
  return {
    getSnapshot: read,
    getServerSnapshot: () => empty,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    set(value) {
      snapshot = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // 保存できない環境ではこの画面を開いている間だけ保持する
      }
      notify();
    },
    clear() {
      snapshot = empty;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // 何もしない
      }
      notify();
    },
  };
}

const QUERY_PATTERN = /^[A-Za-z0-9_\-.,%=&~+*]{0,500}$/;
const EMPTY_SEARCHES: readonly SavedSearch[] = Object.freeze([]);

function parseSavedSearches(value: unknown): readonly SavedSearch[] {
  if (!Array.isArray(value)) return EMPTY_SEARCHES;
  const seen = new Set<string>();
  const list: SavedSearch[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { query, savedAt, alert } = item as Record<string, unknown>;
    if (typeof query !== 'string' || !QUERY_PATTERN.test(query) || seen.has(query)) continue;
    if (typeof savedAt !== 'string' || Number.isNaN(new Date(savedAt).getTime())) continue;
    seen.add(query);
    list.push({ query, savedAt, alert: alert === true });
  }
  return Object.freeze(list.slice(0, SAVED_SEARCH_LIMIT));
}

function parsePrefs(value: unknown): MemberPrefs {
  if (!value || typeof value !== 'object') return DEFAULT_MEMBER_PREFS;
  const v = value as Record<string, unknown>;
  const pick = (key: keyof MemberPrefs) => (typeof v[key] === 'boolean' ? (v[key] as boolean) : DEFAULT_MEMBER_PREFS[key]);
  return Object.freeze({ history: pick('history'), newJobsMail: pick('newJobsMail'), recommendMail: pick('recommendMail'), newsMail: pick('newsMail') });
}

const PREFS_KEY = 'worklens:member-prefs:v1';

export const savedSearchStore = createJsonStore<readonly SavedSearch[]>('worklens:saved-searches:v1', parseSavedSearches, EMPTY_SEARCHES);
export const memberPrefsStore = createJsonStore<MemberPrefs>(PREFS_KEY, parsePrefs, DEFAULT_MEMBER_PREFS);

export function useSavedSearches(): readonly SavedSearch[] {
  return useSyncExternalStore(savedSearchStore.subscribe, savedSearchStore.getSnapshot, savedSearchStore.getServerSnapshot);
}

export function useMemberPrefs(): MemberPrefs {
  return useSyncExternalStore(memberPrefsStore.subscribe, memberPrefsStore.getSnapshot, memberPrefsStore.getServerSnapshot);
}

export function useHistoryIds(): readonly string[] {
  return useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);
}

/** 検索条件を保存する（新しい順）。同じ条件はすでに保存済みとして扱う */
export function saveSearch(query: string, now: Date = new Date()): 'added' | 'exists' | 'full' | 'invalid' {
  if (!QUERY_PATTERN.test(query)) return 'invalid';
  const current = savedSearchStore.getSnapshot();
  if (current.some((s) => s.query === query)) return 'exists';
  if (current.length >= SAVED_SEARCH_LIMIT) return 'full';
  const prefs = memberPrefsStore.getSnapshot();
  savedSearchStore.set(Object.freeze([{ query, savedAt: now.toISOString(), alert: prefs.newJobsMail }, ...current]));
  return 'added';
}

export function removeSavedSearch(query: string): void {
  savedSearchStore.set(Object.freeze(savedSearchStore.getSnapshot().filter((s) => s.query !== query)));
}

export function setSavedSearchAlert(query: string, alert: boolean): void {
  savedSearchStore.set(Object.freeze(savedSearchStore.getSnapshot().map((s) => (s.query === query ? { ...s, alert } : s))));
}

/** 会員登録のときのメール配信の選択を記録する（この端末で初めてのときだけ。以後はマイページの設定を優先） */
export function initMemberPrefs({ mailOptIn }: { mailOptIn: boolean }): void {
  let stored = false;
  try {
    stored = window.localStorage.getItem(PREFS_KEY) !== null;
  } catch {
    stored = false;
  }
  if (stored) return;
  memberPrefsStore.set(Object.freeze({ ...DEFAULT_MEMBER_PREFS, newJobsMail: mailOptIn, recommendMail: mailOptIn }));
}

export function updateMemberPrefs(patch: Partial<MemberPrefs>): void {
  memberPrefsStore.set(Object.freeze({ ...memberPrefsStore.getSnapshot(), ...patch }));
}

/** 最近見た求人に追加する（先頭が最新） */
export function recordHistory(jobId: string): void {
  const current = historyStore.getSnapshot();
  if (current[0] === jobId) return;
  historyStore.set([jobId, ...current.filter((id) => id !== jobId)]);
}

/** 退会時：会員機能で保存した情報を消す（この端末の「保存した求人」は会員登録と関係なく残す） */
export function clearMemberData(): void {
  historyStore.set([]);
  savedSearchStore.clear();
  memberPrefsStore.clear();
}
