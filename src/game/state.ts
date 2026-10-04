import { CHARACTERS, FORMS, type CharId } from '../content/characters';
import { TECHNIQUES } from '../content/techniques';
import { DIRS, Rng } from '../engine/math';
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

/** A plain (non-array, non-null) object. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** A finite number (not NaN / Infinity, not a numeric string). */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Bring a parsed save up to the current format: forward-fill top-level keys and characters added since it was
 * made, merge every character over fresh defaults (fields added to CharState later), and drop ids the game no
 * longer knows (techniques, forms, the active character). Scalars of the wrong type fall back to their defaults.
 * The map id is checked when the save is resumed.
 */
export function repairSave(d: SaveData): SaveData {
  const fresh = newGame();
  const out: SaveData = { ...fresh, ...d };
  for (const k of ['inv', 'flags', 'journal'] as const) if (!isRecord(out[k])) (out as unknown as Record<string, unknown>)[k] = {};
  for (const k of ['journalOrder', 'scans', 'visited', 'regions'] as const) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ['version', 'chapter', 'x', 'y', 'playFrames', 'textSpeed', 'musicVol', 'sfxVol', 'seed'] as const) if (!isNum(out[k])) out[k] = fresh[k];
  if (typeof out.map !== 'string' || !out.map) out.map = fresh.map;
  if (!DIRS.includes(out.dir)) out.dir = fresh.dir;
  const chars = {} as Record<CharId, CharState>;
  for (const id of Object.keys(fresh.chars) as CharId[]) {
    const old = isRecord(d.chars?.[id]) ? d.chars[id] : undefined;
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

  /** False when saves only last for this page session (the browser blocks storage); the title screen warns. */
  get persistent(): boolean {
    return this.storage.persistent !== false;
  }

  /**
   * Persist a game to a slot. The first successful save of a session also asks the browser to keep the site's
   * storage (navigator.storage.persist), so an idle phone does not evict the saves.
   */
  save(slot: number, data: SaveData): boolean {
    const ok = this.storage.set(this.key(slot), JSON.stringify(data));
    if (ok) void this.storage.requestPersistence?.();
    return ok;
  }

  /** The slot as a save code (see encodeSaveCode), or null when it is empty or unreadable. */
  exportCode(slot: number): string | null {
    const d = this.load(slot);
    return d ? encodeSaveCode(d) : null;
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

// ------------------------------------------------------------------------------------------------ save codes

/**
 * Save codes: a whole save as one line of text the player copies out of the browser and pastes back in (a backup
 * that survives cleared site data, or a way to move a file to another device). Layout:
 *
 *   LOS<format>.<CRC-32 of the JSON, 8 hex digits>.<payload>
 *
 * The payload is the save's JSON (characters still at their new-game defaults left out) as UTF-8, LZW-packed and
 * base64url-encoded. Whitespace anywhere in a pasted code is ignored, so a code wrapped by a chat app still works.
 * The format number versions the code layout; the save inside carries its own SaveData `version`.
 */
export const SAVE_CODE_FORMAT = 1;
const SAVE_CODE_RE = /^LOS(\d{1,3})\.([0-9a-f]{8})\.([A-Za-z0-9_-]+)$/i;
/** Hard cap on a decoded save, far above any real one, so a crafted code cannot exhaust memory. */
const SAVE_CODE_MAX_BYTES = 4 << 20;

/** Why a pasted save code was refused. */
export type SaveCodeFailure = 'empty' | 'format' | 'newer' | 'corrupt' | 'checksum' | 'invalid';

/** A save code that cannot be imported; `message` is shown to the player as is, `cause` keeps the low-level detail. */
export class SaveCodeError extends Error {
  constructor(readonly reason: SaveCodeFailure, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SaveCodeError';
  }
}

/** Encode a save as a save code. */
export function encodeSaveCode(d: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(compactSave(d)));
  return `LOS${SAVE_CODE_FORMAT}.${crc32(bytes).toString(16).padStart(8, '0')}.${toBase64Url(lzwPack(bytes))}`;
}

/**
 * Decode and validate a pasted save code and bring the save up to date (repairSave). Throws SaveCodeError for
 * anything that is not a complete, intact code for a save this version can load; never returns partial data.
 */
export function decodeSaveCode(text: string): SaveData {
  const code = text.replace(/\s+/g, '');
  if (!code) throw new SaveCodeError('empty', 'Paste a save code first.');
  const m = SAVE_CODE_RE.exec(code);
  if (!m) throw new SaveCodeError('format', 'That is not a Legacy of Super save code. Codes start with "LOS".');
  const format = parseInt(m[1], 10);
  if (format > SAVE_CODE_FORMAT) throw new SaveCodeError('newer', 'This code was made by a newer version of the game.');
  if (format < 1) throw new SaveCodeError('format', 'That is not a Legacy of Super save code.');
  let bytes: Uint8Array;
  try {
    bytes = lzwUnpack(fromBase64Url(m[3]), SAVE_CODE_MAX_BYTES);
  } catch (err) {
    throw new SaveCodeError('corrupt', 'The code is damaged or cut short. Copy the whole code again.', err);
  }
  if (crc32(bytes) !== parseInt(m[2], 16)) {
    throw new SaveCodeError('checksum', 'The code is damaged or cut short (checksum mismatch). Copy the whole code again.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (err) {
    throw new SaveCodeError('invalid', 'The code does not contain a save.', err);
  }
  return repairSave(checkSaveShape(parsed));
}

/** Deep copy of a save without the characters that still equal a fresh newChar (repairSave restores them). */
function compactSave(d: SaveData): SaveData {
  const out = JSON.parse(JSON.stringify(d)) as SaveData;
  const chars = {} as Record<CharId, CharState>;
  for (const id of Object.keys(out.chars) as CharId[]) {
    const fresh = CHARACTERS[id] ? newChar(id) : null;
    if (!fresh || !sameFields(out.chars[id], fresh)) chars[id] = out.chars[id];
  }
  out.chars = chars;
  return out;
}

/** Same keys with JSON-equal values (character records hold only primitives and string arrays). */
function sameFields(a: object, b: object): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  return ka.length === Object.keys(rb).length && ka.every((k) => k in rb && JSON.stringify(ra[k]) === JSON.stringify(rb[k]));
}

/**
 * Reject a decoded object that is not a save this version can load. Fields added in later SaveData versions may be
 * missing (repairSave forward-fills them), but anything present must have the right type.
 */
function checkSaveShape(v: unknown): SaveData {
  const bad = (what: string): never => {
    throw new SaveCodeError('invalid', `The save inside the code is not valid (${what}).`);
  };
  if (!isRecord(v)) return bad('not a save');
  if (!isNum(v.version) || !Number.isInteger(v.version) || v.version < 1) return bad('version');
  if (v.version > SAVE_VERSION) throw new SaveCodeError('newer', 'This save was made by a newer version of the game.');
  if (!isRecord(v.chars) || !Object.values(v.chars).every((c) => isRecord(c) && validChar(c))) return bad('characters');
  if (!isNum(v.chapter) || !Number.isInteger(v.chapter) || v.chapter < 0 || v.chapter > 99) return bad('chapter');
  if (typeof v.active !== 'string' || !v.active) return bad('active character');
  if (typeof v.map !== 'string' || !v.map) return bad('location');
  for (const k of ['x', 'y', 'playFrames'] as const) if (!isNum(v[k])) return bad(k);
  if (!DIRS.includes(v.dir as Dir)) return bad('facing');
  if (!isRecord(v.inv) || !Object.values(v.inv).every((n) => isNum(n) && n >= 0)) return bad('items');
  if (!isRecord(v.flags) || !Object.values(v.flags).every((f) => isNum(f) || typeof f === 'string' || typeof f === 'boolean')) return bad('flags');
  if (!isRecord(v.journal) || !Object.values(v.journal).every((q) => q === 'active' || q === 'done')) return bad('journal');
  for (const k of ['journalOrder', 'scans', 'visited', 'regions'] as const) {
    if (k in v && !(Array.isArray(v[k]) && (v[k] as unknown[]).every((s) => typeof s === 'string'))) return bad(k);
  }
  for (const k of ['textSpeed', 'musicVol', 'sfxVol', 'seed'] as const) if (k in v && !isNum(v[k])) return bad(k);
  return v as unknown as SaveData;
}

/** Number fields of a character record (CharState and its StatBlock). */
const CHAR_NUMS = ['exp', 'hp', 'ep', 'hpMax', 'epMax', 'str', 'pow', 'end', 'strF', 'powF', 'endF', 'selected'] as const;

/**
 * A character record from a save code: the fields it has (a code may lack ones added later) carry their CharState
 * types, and the level is one the game can reach.
 */
function validChar(c: Record<string, unknown>): boolean {
  if ('level' in c && !(isNum(c.level) && Number.isInteger(c.level) && c.level >= 1 && c.level <= MAX_LEVEL)) return false;
  if ('exp' in c && !(isNum(c.exp) && c.exp >= 0)) return false;
  if (CHAR_NUMS.some((k) => k in c && !isNum(c[k]))) return false;
  if ((['joined', 'charged', 'trophy'] as const).some((k) => k in c && typeof c[k] !== 'boolean')) return false;
  if ('techs' in c && !(Array.isArray(c.techs) && c.techs.every((t) => typeof t === 'string'))) return false;
  if ('form' in c && c.form !== null && typeof c.form !== 'string') return false;
  return !('outfit' in c) || typeof c.outfit === 'string';
}

// ---- byte codecs used by save codes (all synchronous and DOM-free, so they run in tests as in the browser)

let crcTable: Uint32Array | null = null;

/** CRC-32 (IEEE 802.3, as in zip/PNG) of a byte string, unsigned. */
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Base64url without padding. */
function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += B64URL[(n >>> (18 - 6 * k)) & 63];
  }
  return out;
}

/**
 * Inverse of toBase64Url. Strict: throws on characters outside the alphabet, an impossible length or non-zero
 * padding bits, so every text has at most one meaning and any edited character is noticed.
 */
function fromBase64Url(s: string): Uint8Array {
  if (s.length % 4 === 1) throw new Error('base64url length');
  const out = new Uint8Array(Math.floor((s.length * 6) / 8));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (const ch of s) {
    const v = B64URL.indexOf(ch);
    if (v < 0) throw new Error(`base64url character "${ch}"`);
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
  }
  if (acc & ((1 << bits) - 1)) throw new Error('base64url padding bits');
  return out;
}

/** First code after the 256 single-byte codes. */
const LZW_FIRST = 256;
/** Dictionary size limit (16-bit codes); once full the dictionary is frozen. */
const LZW_MAX = 1 << 16;

/** Bits per code while the dictionary's next free code is `next` (9 to 16). */
function lzwWidth(next: number): number {
  return Math.min(16, Math.max(9, 32 - Math.clz32(next)));
}

/** MSB-first bit packer. */
class BitWriter {
  private buf = new Uint8Array(1024);
  private n = 0;
  private acc = 0;
  private bits = 0;

  write(v: number, width: number): void {
    this.acc = (this.acc << width) | v;
    this.bits += width;
    while (this.bits >= 8) {
      this.bits -= 8;
      this.push((this.acc >>> this.bits) & 0xff);
    }
    this.acc &= (1 << this.bits) - 1;
  }

  finish(): Uint8Array {
    if (this.bits > 0) this.push((this.acc << (8 - this.bits)) & 0xff);
    this.bits = 0;
    return this.buf.slice(0, this.n);
  }

  private push(b: number): void {
    if (this.n === this.buf.length) {
      const grown = new Uint8Array(this.buf.length * 2);
      grown.set(this.buf);
      this.buf = grown;
    }
    this.buf[this.n++] = b;
  }
}

/** LZW with growing code width (9-16 bits). The decoder mirrors the width schedule; see lzwUnpack. */
function lzwPack(input: Uint8Array): Uint8Array {
  const out = new BitWriter();
  if (input.length === 0) return out.finish();
  const dict = new Map<number, number>();
  let next = LZW_FIRST;
  let w = input[0];
  for (let i = 1; i < input.length; i++) {
    const c = input[i];
    const key = w * 256 + c;
    const hit = dict.get(key);
    if (hit !== undefined) {
      w = hit;
      continue;
    }
    out.write(w, lzwWidth(next));
    if (next < LZW_MAX) dict.set(key, next++);
    w = c;
  }
  out.write(w, lzwWidth(next));
  return out.finish();
}

/**
 * Inverse of lzwPack. The encoder adds its dictionary entry right after writing a code, the decoder only when it
 * reads the following one, so the decoder reads code k (k >= 1) at the width for one more entry than it holds.
 * Throws on a code that cannot occur in a valid stream or when the output would exceed `maxBytes`.
 */
function lzwUnpack(packed: Uint8Array, maxBytes: number): Uint8Array {
  const prefix = new Int32Array(LZW_MAX);
  const suffix = new Uint8Array(LZW_MAX);
  const head = new Uint8Array(LZW_MAX);
  const len = new Int32Array(LZW_MAX);
  for (let i = 0; i < LZW_FIRST; i++) { prefix[i] = -1; suffix[i] = i; head[i] = i; len[i] = 1; }
  let out = new Uint8Array(Math.min(maxBytes, Math.max(1024, packed.length * 4)));
  let n = 0;
  const totalBits = packed.length * 8;
  let pos = 0;
  let next = LZW_FIRST;
  let prev = -1;
  for (;;) {
    const width = lzwWidth(prev < 0 ? next : next + 1);
    if (totalBits - pos < width) break;
    let code = 0;
    for (let i = 0; i < width; i++, pos++) code = (code << 1) | ((packed[pos >> 3] >> (7 - (pos & 7))) & 1);
    if (prev < 0) {
      if (code >= LZW_FIRST) throw new Error(`LZW: first code ${code}`);
    } else {
      if (code > next || (code === next && next >= LZW_MAX)) throw new Error(`LZW: code ${code} before it exists`);
      if (next < LZW_MAX) {
        prefix[next] = prev;
        suffix[next] = code < next ? head[code] : head[prev];
        head[next] = head[prev];
        len[next] = len[prev] + 1;
        next++;
      }
    }
    const l = len[code];
    if (n + l > maxBytes) throw new Error('LZW: output too large');
    if (n + l > out.length) {
      const grown = new Uint8Array(Math.min(maxBytes, Math.max(out.length * 2, n + l)));
      grown.set(out.subarray(0, n));
      out = grown;
    }
    for (let c = code, i = n + l - 1; c >= 0; c = prefix[c], i--) out[i] = suffix[c];
    n += l;
    prev = code;
  }
  // What is left is the writer's zero padding: less than a byte, all zero.
  const rest = totalBits - pos;
  if (rest >= 8) throw new Error('LZW: trailing data');
  for (; pos < totalBits; pos++) if ((packed[pos >> 3] >> (7 - (pos & 7))) & 1) throw new Error('LZW: padding bits');
  return out.slice(0, n);
}
