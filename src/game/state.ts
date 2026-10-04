import { CHARACTERS, FORMS, type CharId } from '../content/characters';
import { TECHNIQUES } from '../content/techniques';
import { Rng } from '../engine/math';
import type { Dir } from '../engine/math';
import { EXP_TABLE, levelForExp, levelUp, rollToLevel, MAX_LEVEL, type LevelUpResult, type StatBlock } from './leveling';
import type { Storage } from './storage';

/** Runtime + saved state for one playable character. */
export interface CharState extends StatBlock {
  id: CharId;
  joined: boolean;
  exp: number;
  hp: number;
  ep: number;
  /** Learned ki technique ids, in L-cycle order. */
  techs: string[];
  /** Index into techs; techs.length = the Z (transform) slot. */
  selected: number;
  /** Charged melee learned (Roshi). */
  charged: boolean;
  /** Current Z form id, or null if the character cannot transform yet. */
  form: string | null;
  /** Trophy collected from the character's level-50 gate. */
  trophy: boolean;
  /** Outfit sprite override (story costume changes). */
  outfit?: string;
}

/** Journal quest status. */
export type QuestStatus = 'active' | 'done';

/** Everything persisted in a save slot. */
export interface SaveData {
  version: number;
  chapter: number;
  active: CharId;
  chars: Record<CharId, CharState>;
  inv: Record<string, number>;
  flags: Record<string, number | string | boolean>;
  journal: Record<string, QuestStatus>;
  /** Order quests were added (journal display order). */
  journalOrder: string[];
  map: string;
  x: number;
  y: number;
  dir: Dir;
  playFrames: number;
  /** Scouter database entries. */
  scans: string[];
  /** Visited map ids (for the regional map). */
  visited: string[];
  /** Unlocked world-map landing spots. */
  regions: string[];
  /** Options. */
  textSpeed: number;
  musicVol: number;
  sfxVol: number;
  /** RNG seed so level-up rolls are reproducible within a session. */
  seed: number;
}

export const SAVE_VERSION = 1;
export const SAVE_SLOTS = 3;

/** Player options, remembered across sessions outside the save slots. */
export type Options = Pick<SaveData, 'textSpeed' | 'musicVol' | 'sfxVol'>;

/** Build a fresh level-1 character. */
export function newChar(id: CharId): CharState {
  const d = CHARACTERS[id];
  return {
    id, joined: false, level: 1, exp: 0,
    hpMax: d.base.hp, hp: d.base.hp, epMax: d.base.ep, ep: d.base.ep,
    str: d.base.str, pow: d.base.pow, end: d.base.end, strF: 0, powF: 0, endF: 0,
    techs: id === 'satan' ? ['victoryPose'] : ['kiBlast'], selected: 0, charged: false, form: null, trophy: false,
  };
}

/** A brand-new game. */
export function newGame(): SaveData {
  const chars = {} as Record<CharId, CharState>;
  for (const id of Object.keys(CHARACTERS) as CharId[]) chars[id] = newChar(id);
  return {
    version: SAVE_VERSION, chapter: 0, active: 'trunks', chars, inv: {}, flags: {}, journal: {}, journalOrder: [],
    map: 'future_ruins_1', x: 0, y: 0, dir: 'down', playFrames: 0, scans: [], visited: [], regions: [],
    textSpeed: 2, musicVol: 0.55, sfxVol: 0.7, seed: (Math.random() * 0xffffffff) >>> 0,
  };
}

/**
 * Game state wrapper with typed helpers for flags, inventory, EXP and party management.
 * Holds the RNG used for level-ups.
 */
export class GameState {
  data: SaveData;
  rng: Rng;

  constructor(data: SaveData = newGame()) {
    this.data = data;
    this.rng = new Rng(data.seed ^ data.playFrames);
  }

  /** Active character state. */
  get hero(): CharState {
    return this.data.chars[this.data.active];
  }

  char(id: CharId): CharState {
    return this.data.chars[id];
  }

  // ---- flags ----
  flag(name: string): boolean {
    const v = this.data.flags[name];
    return v !== undefined && v !== false && v !== 0 && v !== '';
  }

  get(name: string): number | string | boolean | undefined {
    return this.data.flags[name];
  }

  set(name: string, v: number | string | boolean = true): void {
    this.data.flags[name] = v;
  }

  clear(name: string): void {
    delete this.data.flags[name];
  }

  /** Evaluate a condition string: "flag", "!flag", "a&b", "chapter>=3", "has:item". */
  check(cond: string | undefined): boolean {
    if (!cond) return true;
    return cond.split('&').every((raw) => {
      const c = raw.trim();
      if (c.startsWith('!')) return !this.check(c.slice(1));
      const m = /^chapter\s*(>=|<=|==|>|<)\s*(\d+)$/.exec(c);
      if (m) {
        const n = parseInt(m[2], 10);
        const ch = this.data.chapter;
        switch (m[1]) {
          case '>=': return ch >= n;
          case '<=': return ch <= n;
          case '==': return ch === n;
          case '>': return ch > n;
          default: return ch < n;
        }
      }
      if (c.startsWith('has:')) return this.count(c.slice(4)) > 0;
      if (c.startsWith('char:')) return this.data.active === c.slice(5);
      if (c.startsWith('quest:')) return this.data.journal[c.slice(6)] === 'active';
      if (c.startsWith('done:')) return this.data.journal[c.slice(5)] === 'done';
      return this.flag(c);
    });
  }

  // ---- inventory ----
  count(item: string): number {
    return this.data.inv[item] ?? 0;
  }

  /** Add items, clamped to `max`. Returns how many were actually added. */
  give(item: string, qty: number, max = 99): number {
    const before = this.count(item);
    const after = Math.min(max, before + qty);
    this.data.inv[item] = after;
    return after - before;
  }

  /** Remove items. Returns false (and removes nothing) if there are not enough. */
  take(item: string, qty = 1): boolean {
    if (this.count(item) < qty) return false;
    this.data.inv[item] = this.count(item) - qty;
    if (this.data.inv[item] <= 0) delete this.data.inv[item];
    return true;
  }

  // ---- journal ----
  addQuest(id: string): boolean {
    if (this.data.journal[id]) return false;
    this.data.journal[id] = 'active';
    this.data.journalOrder.push(id);
    return true;
  }

  completeQuest(id: string): boolean {
    if (this.data.journal[id] === 'done') return false;
    if (!this.data.journal[id]) this.data.journalOrder.push(id);
    this.data.journal[id] = 'done';
    return true;
  }

  // ---- party ----
  /** Join a character at a level, rolling stats LoG2-style. Existing progress is kept if higher. */
  join(id: CharId, level: number): void {
    const c = this.char(id);
    if (c.level < level) {
      rollToLevel(c, CHARACTERS[id].growth, level, this.rng);
      c.exp = Math.max(c.exp, expFloorFor(level));
    }
    c.joined = true;
    c.hp = c.hpMax;
    c.ep = c.epMax;
  }

  /** Characters that can be switched to at a save point. */
  get party(): CharState[] {
    return (Object.values(this.data.chars) as CharState[]).filter((c) => c.joined && c.id !== 'android17' && c.id !== 'frieza');
  }

  /** Give EXP to a character; returns each level-up that happened. */
  gainExp(id: CharId, amount: number): LevelUpResult[] {
    const c = this.char(id);
    const ups: LevelUpResult[] = [];
    if (c.level >= MAX_LEVEL) return ups;
    c.exp += Math.max(0, Math.floor(amount));
    const target = levelForExp(c.exp);
    while (c.level < target) {
      ups.push(levelUp(c, CHARACTERS[id].growth, this.rng));
      c.hp = c.hpMax;
      c.ep = c.epMax;
    }
    return ups;
  }

  /** Learn a technique if not known. Returns true if newly learned. */
  learn(id: CharId, tech: string): boolean {
    const c = this.char(id);
    if (c.techs.includes(tech)) return false;
    c.techs.push(tech);
    return true;
  }
}

/** Minimum total EXP for a level (used when a character joins at level N). */
function expFloorFor(level: number): number {
  return level <= 1 ? 0 : EXP_TABLE[level] ?? 0;
}

/**
 * Bring a parsed save up to the current format: forward-fill top-level keys and characters added since it was
 * made, merge every character over fresh defaults (fields added to CharState later), and drop ids the game no
 * longer knows (techniques, forms, the active character). The map id is checked when the save is resumed.
 */
export function repairSave(d: SaveData): SaveData {
  const fresh = newGame();
  const out: SaveData = { ...fresh, ...d };
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  for (const k of ['inv', 'flags', 'journal'] as const) if (!isObj(out[k])) (out as unknown as Record<string, unknown>)[k] = {};
  for (const k of ['journalOrder', 'scans', 'visited', 'regions'] as const) if (!Array.isArray(out[k])) out[k] = [];
  const chars = {} as Record<CharId, CharState>;
  for (const id of Object.keys(fresh.chars) as CharId[]) {
    const old = isObj(d.chars?.[id]) ? d.chars[id] : undefined;
    const c: CharState = { ...fresh.chars[id], ...(old ?? {}), id };
    c.techs = Array.isArray(c.techs) ? c.techs.filter((t) => typeof t === 'string' && !!TECHNIQUES[t]) : [...fresh.chars[id].techs];
    if (c.form !== null && !FORMS[c.form]) c.form = null;
    const slots = c.techs.length + (c.form ? 1 : 0);
    if (typeof c.selected !== 'number' || !Number.isInteger(c.selected) || c.selected < 0 || c.selected >= Math.max(1, slots)) c.selected = 0;
    for (const k of ['level', 'exp', 'hp', 'hpMax', 'ep', 'epMax', 'str', 'pow', 'end', 'strF', 'powF', 'endF'] as const) {
      if (typeof c[k] !== 'number' || !Number.isFinite(c[k])) c[k] = fresh.chars[id][k];
    }
    chars[id] = c;
  }
  out.chars = chars;
  if (!CHARACTERS[out.active]) out.active = (Object.values(chars).find((c) => c.joined)?.id ?? 'goku');
  return out;
}

/** Serialise / deserialise save slots. */
export class SaveService {
  constructor(private readonly storage: Storage, private readonly prefix = 'legacyOfSuper.slot') {}

  private key(slot: number): string {
    return `${this.prefix}${slot}`;
  }

  private get optionsKey(): string {
    return `${this.prefix}.options`;
  }

  /** Last options chosen in any menu, or null if none were stored (or they are unreadable). */
  loadOptions(): Options | null {
    const raw = this.storage.get(this.optionsKey);
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as Partial<Options>;
      const num = (v: unknown, lo: number, hi: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
      return { textSpeed: Math.round(num(o.textSpeed, 1, 4, 2)), musicVol: num(o.musicVol, 0, 1, 0.55), sfxVol: num(o.sfxVol, 0, 1, 0.7) };
    } catch {
      return null;
    }
  }

  /** Remember options for the next session. */
  saveOptions(o: Options): void {
    this.storage.set(this.optionsKey, JSON.stringify({ textSpeed: o.textSpeed, musicVol: o.musicVol, sfxVol: o.sfxVol }));
  }

  /** Persist a game to a slot. */
  save(slot: number, data: SaveData): boolean {
    return this.storage.set(this.key(slot), JSON.stringify(data));
  }

  /** Load a slot, or null if empty / corrupt / from a newer version. */
  load(slot: number): SaveData | null {
    const raw = this.storage.get(this.key(slot));
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as SaveData;
      if (typeof d.version !== 'number' || d.version > SAVE_VERSION || !d.chars) {
        console.warn('[save] unsupported save in slot', slot);
        return null;
      }
      return repairSave(d);
    } catch (err) {
      console.warn('[save] corrupt slot', slot, err);
      return null;
    }
  }

  /** Erase a slot. */
  erase(slot: number): void {
    this.storage.remove(this.key(slot));
  }

  /** Summary rows for the file-select screen. */
  summaries(): Array<{ slot: number; data: SaveData | null }> {
    return Array.from({ length: SAVE_SLOTS }, (_, slot) => ({ slot, data: this.load(slot) }));
  }
}
