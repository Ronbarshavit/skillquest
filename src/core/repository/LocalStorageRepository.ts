import type { AppState } from '../model/types';
import type { KeyValueStorage, StateRepository } from './StateRepository';

export const STORAGE_KEY = 'skillquest.state.v1';

function isAppState(x: unknown): x is AppState {
  const s = x as AppState;
  return !!s && s.schemaVersion === 1 && !!s.family && Array.isArray(s.categories) && Array.isArray(s.ledger);
}

/** Stores the whole state document as JSON under one key. */
export class LocalStorageRepository implements StateRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = STORAGE_KEY,
  ) {}

  load(): AppState | null {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isAppState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  save(state: AppState): void {
    this.storage.setItem(this.key, JSON.stringify(state));
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

export class InMemoryRepository implements StateRepository {
  private state: AppState | null = null;
  load() {
    return this.state ? structuredCloneSafe(this.state) : null;
  }
  save(s: AppState) {
    this.state = structuredCloneSafe(s);
  }
  clear() {
    this.state = null;
  }
}

const structuredCloneSafe = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
