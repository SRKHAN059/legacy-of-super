/** Key-value persistence abstraction so save logic can be unit tested without a browser. */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /**
   * False when writes only last for this page session (browser storage blocked, e.g. some private modes).
   * Omitted means durable.
   */
  readonly persistent?: boolean;
  /** Ask the host to exempt this site's storage from automatic eviction. Never rejects. */
  requestPersistence?(): Promise<boolean>;
}

/** The Web Storage object (`localStorage`); named this way because this module's `Storage` shadows the DOM type. */
type WebStorage = Window['localStorage'];

/** The parts of `navigator.storage` used to ask for durable storage. */
export interface StorageManagerLike {
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
}

/** Where BrowserStorage gets localStorage and the StorageManager from; injectable for tests. */
export interface StorageHost {
  /** Reading this may throw (blocked cookies / site data). */
  readonly localStorage: WebStorage;
  readonly storageManager?: StorageManagerLike;
}

/** The live browser globals; each access is lazy so a blocked localStorage only throws inside the probe. */
function browserHost(): StorageHost {
  return {
    get localStorage(): WebStorage {
      return window.localStorage;
    },
    get storageManager(): StorageManagerLike | undefined {
      return typeof navigator !== 'undefined' ? navigator.storage : undefined;
    },
  };
}

const PROBE_KEY = 'legacyOfSuper.probe';

/**
 * localStorage-backed storage; every access is guarded because private mode / blocked storage throws. When
 * localStorage refuses writes (blocked outright, a zero quota in some private modes, or a full quota), writes go to
 * an in-memory layer for the session and `persistent` is false, so the game keeps working and the title screen can
 * warn the player. Saves already in a localStorage that can still be read stay visible beneath that layer.
 */
export class BrowserStorage implements Storage {
  readonly persistent: boolean;
  /** localStorage when it can at least be read, else null. */
  private readonly ls: WebStorage | null;
  /** Session-only writes while localStorage refuses them; null marks a key removed this session. */
  private readonly session = new Map<string, string | null>();
  private persistAsked: Promise<boolean> | null = null;

  constructor(private readonly host: StorageHost = browserHost()) {
    const { ls, writable } = BrowserStorage.probe(host);
    this.ls = ls;
    this.persistent = writable;
    if (!writable) console.warn(`[storage] localStorage ${ls ? 'is read-only' : 'unavailable'}; saves last for this session only`);
  }

  /** Whether localStorage can be read and whether it can be written. */
  private static probe(host: StorageHost): { ls: WebStorage | null; writable: boolean } {
    let ls: WebStorage;
    try {
      ls = host.localStorage;
      ls.getItem(PROBE_KEY);
    } catch (err) {
      console.warn('[storage] localStorage blocked', err);
      return { ls: null, writable: false };
    }
    try {
      ls.setItem(PROBE_KEY, '1');
      ls.removeItem(PROBE_KEY);
      return { ls, writable: true };
    } catch (err) {
      console.warn('[storage] localStorage refuses writes', err);
      return { ls, writable: false };
    }
  }

  get(key: string): string | null {
    if (this.session.has(key)) return this.session.get(key) ?? null;
    if (!this.ls) return null;
    try {
      return this.ls.getItem(key);
    } catch (err) {
      console.warn('[storage] read failed', key, err);
      return null;
    }
  }

  set(key: string, value: string): boolean {
    if (!this.persistent || !this.ls) {
      this.session.set(key, value);
      return true;
    }
    try {
      this.ls.setItem(key, value);
      return true;
    } catch (err) {
      console.warn('[storage] write failed', key, err);
      return false;
    }
  }

  remove(key: string): void {
    // Removing frees space, so it can succeed even while writes are refused: a deleted file stays deleted.
    if (!this.persistent) this.session.set(key, null);
    if (!this.ls) return;
    try {
      this.ls.removeItem(key);
    } catch (err) {
      console.warn('[storage] remove failed', key, err);
    }
  }

  /**
   * Ask the browser to keep this site's data (Safari otherwise wipes script-written storage after 7 days without
   * a visit). Asked at most once per session and skipped when already granted, so browsers that show a prompt
   * (Firefox) ask once. Resolves to whether storage is persisted; never rejects.
   */
  requestPersistence(): Promise<boolean> {
    this.persistAsked ??= this.askPersistence();
    return this.persistAsked;
  }

  private async askPersistence(): Promise<boolean> {
    if (!this.persistent) return false;
    const sm = this.host.storageManager;
    if (!sm || typeof sm.persist !== 'function') return false;
    try {
      if (typeof sm.persisted === 'function' && (await sm.persisted())) return true;
      const granted = await sm.persist();
      console.info(`[storage] persistent storage ${granted ? 'granted' : 'not granted'}`);
      return granted;
    } catch (err) {
      console.warn('[storage] persist request failed', err);
      return false;
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
