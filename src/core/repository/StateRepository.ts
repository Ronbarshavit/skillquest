import type { AppState } from '../model/types';

/** Persistence port. Core depends on this interface only. */
export interface StateRepository {
  load(): AppState | null;
  save(state: AppState): void;
  clear(): void;
}

/** Minimal key/value port (window.localStorage satisfies it) so core needs no DOM types. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
