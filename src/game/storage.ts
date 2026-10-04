/** Key-value persistence abstraction so save logic can be unit tested without a browser. */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/** localStorage-backed storage; every access is guarded because private mode / blocked storage throws. */
export class BrowserStorage implements Storage {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      console.warn('[storage] read failed', key, err);
      return null;
    }
  }

  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn('[storage] write failed', key, err);
      return false;
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn('[storage] remove failed', key, err);
    }
  }
}

/** In-memory storage for tests. */
export class MemoryStorage implements Storage {
  private readonly m = new Map<string, string>();

  get(key: string): string | null {
    return this.m.get(key) ?? null;
  }

  set(key: string, value: string): boolean {
    this.m.set(key, value);
    return true;
  }

  remove(key: string): void {
    this.m.delete(key);
  }
}
