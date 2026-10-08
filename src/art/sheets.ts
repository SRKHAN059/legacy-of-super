import { hexRgb, makeBitmap, type Bitmap } from '../engine/gfx';
import { DIRS, type Dir } from '../engine/math';
import { POSES, type Pose, type SpriteAnim, type SpriteAnims, type SpriteSet } from './humanoid';
import { SHEET_BLOCKS } from './sheets.gen';

// ---------------------------------------------------------------------------------------------
// Generated data shapes (written by tools/sprites/build.mjs into ./sheets.gen.ts)
// ---------------------------------------------------------------------------------------------

/** One animation of a sheet block: frame refs per facing (a negative ref `~id` is frame `id` mirrored). */
export interface SheetAnimData {
  fps: number;
  loop: boolean;
  dirs: Partial<Record<Dir, number[]>>;
}

/** A block of LoG2 sheet cells (one character / form), palette-indexed and run-length encoded. */
export interface SheetBlockData {
  /** Who the block is in LoG2. */
  name: string;
  /** Source sheet file in assets/sprites. */
  sheet: string;
  /** Frame width and height in pixels. */
  size: number;
  /** Frame row of the block's ground line before alignment (feet are moved to the frame's last row). */
  ground: number;
  /** The spec pinned the ground row ("baseline"), e.g. for characters who float above the ground. */
  pinnedGround: boolean;
  /** Colours by palette index - 1 (index 0 is transparent). */
  palette: string[];
  /** Exact sheet colours of each body part, darkest to lightest. */
  parts: Partial<Record<string, string[]>>;
  /** base64 frames: [x, y, w, h] bounding box, then RLE palette indices. */
  frames: string[];
  /** Head anchor per frame, flattened [x0, y0, x1, y1, ...]. */
  anchors: number[];
  anims: Record<string, SheetAnimData>;
}

// ---------------------------------------------------------------------------------------------
// Looks: how a cast id is drawn from a block
// ---------------------------------------------------------------------------------------------

/** Small pixel-art patch drawn on every frame relative to the frame's head anchor (hair, hats, scars...). */
export interface SheetOverlay {
  /** Character → '#rrggbb'. '.' and ' ' are transparent. */
  palette: Readonly<Record<string, string>>;
  /**
   * Pixel grid per facing (as the actor faces, after any mirroring). A missing `right` is the
   * mirror of `left` and vice versa; a missing `up` / `down` is not drawn.
   */
  rows: Partial<Record<Dir, readonly string[]>>;
  /**
   * Top-left of the grid relative to the head anchor (x = centre column of the head, y = its top
   * row). Defaults to the grid centred over the anchor with its top on the anchor row.
   */
  offset?: Partial<Record<Dir, readonly [number, number]>>;
  /** Sheet colours (pre-recolour, e.g. the block's original hair) made transparent before drawing. */
  erase?: readonly string[];
  /** Only erase within this many rows from the head anchor downward (default: the whole frame). */
  eraseDepth?: number;
  /** Animations left untouched (e.g. teleport dissolves or lying-down frames). */
  skipAnims?: readonly string[];
}

/** Extra animation source for a look: another block's animations (all it has that the main block lacks, or exactly `anims`). */
export interface SheetExtra {
  block: string;
  /** Take exactly these animations, replacing the main block's of the same name. */
  anims?: readonly string[];
}

/** How a cast id is built from a sheet block. */
export interface SheetLook {
  /** Block id (see tools/sprites/specs). */
  block: string;
  /** Exact sheet colour → new colour (applied before caching, so one block serves many characters). */
  recolor?: Readonly<Record<string, string>>;
  /**
   * Part recolour: each named palette part's colours (darkest → lightest) map onto these colours
   * by relative position, so a 4-shade outfit can take a 3-shade replacement.
   */
  parts?: Readonly<Partial<Record<string, readonly string[]>>>;
  overlay?: SheetOverlay;
  /** More animations from other blocks of the same character (e.g. poses the mapper split off). */
  extra?: readonly SheetExtra[];
  /** Uniform nearest-neighbour scale for big characters (1 = 32px frames). */
  scale?: number;
}

/** Pixels of one rendered frame. */
export interface FramePixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

// ---------------------------------------------------------------------------------------------
// Registry of sheet-backed cast ids
// ---------------------------------------------------------------------------------------------

const SHEET_CAST: Record<string, SheetLook> = {};
/** Ids registered as defaults (src/art/sheetcast.ts): content may replace these with its own look. */
const DEFAULT_CAST = new Set<string>();
const castListeners: ((ids: string[]) => void)[] = [];

/** Options for registerSheetCast. */
export interface SheetCastOptions {
  /**
   * Register as defaults: ids that already have a look are left alone, and a later plain
   * registration of the same id replaces the default instead of throwing. Used by the built-in
   * LoG2 wiring so content files can re-dress a character regardless of module load order.
   */
  defaults?: boolean;
}

/**
 * Draw these cast ids from sprite-sheet blocks instead of the procedural humanoid builder.
 * `spriteSet(id)` consults this table first. Registering an id twice throws, except over a
 * default look (see SheetCastOptions.defaults), which the new look replaces.
 */
export function registerSheetCast(looks: Readonly<Record<string, SheetLook>>, opts: SheetCastOptions = {}): void {
  for (const id of Object.keys(looks)) {
    if (!looks[id].block) throw new Error(`Sheet cast "${id}" has no block`);
    if (!opts.defaults && SHEET_CAST[id] && !DEFAULT_CAST.has(id)) throw new Error(`Duplicate sheet cast id "${id}"`);
  }
  const ids: string[] = [];
  for (const [id, look] of Object.entries(looks)) {
    if (opts.defaults) {
      if (SHEET_CAST[id]) continue;
      DEFAULT_CAST.add(id);
    } else DEFAULT_CAST.delete(id);
    SHEET_CAST[id] = look;
    ids.push(id);
  }
  if (ids.length) for (const fn of castListeners) fn(ids);
}

/** True when a cast id's look is the built-in default wiring (not replaced by content). */
export function isDefaultSheetCast(id: string): boolean {
  return DEFAULT_CAST.has(id);
}

/** The sheet look registered for a cast id, if any. */
export function sheetCastOf(id: string): SheetLook | undefined {
  return SHEET_CAST[id];
}

/** Every cast id drawn from a sheet. */
export function sheetCastIds(): string[] {
  return Object.keys(SHEET_CAST);
}

/** Subscribe to sheet cast registrations (the sprite registry drops stale cached sets). */
export function onSheetCast(fn: (ids: string[]) => void): void {
  castListeners.push(fn);
}

/** Block data by id, or undefined when no spec built it. */
export function sheetBlock(id: string): SheetBlockData | undefined {
  return SHEET_BLOCKS[id];
}

/** Every built block id. */
export function sheetBlockIds(): string[] {
  return Object.keys(SHEET_BLOCKS);
}

function blockOf(id: string): SheetBlockData {
  const b = SHEET_BLOCKS[id];
  if (!b) throw new Error(`Unknown sprite-sheet block "${id}" (no spec in tools/sprites/specs built it)`);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Frame codec
// ---------------------------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Decode standard base64 to bytes (DOM-free; atob is not available in every test runtime). */
export function base64Bytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_INDEX[clean.charCodeAt(i)];
    if (v < 0) throw new Error('Invalid base64 in sprite data');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

/**
 * Decode an RLE frame into a size×size grid of palette indices (0 = transparent).
 * Format: [x, y, w, h] bounding box, then tokens: byte < 0x80 is one pixel of that index,
 * byte >= 0x80 is a run of (byte - 0x80 + 2) pixels of the index in the next byte.
 */
export function decodeIndices(bytes: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  const x0 = bytes[0];
  const y0 = bytes[1];
  const w = bytes[2];
  const h = bytes[3];
  const total = w * h;
  let p = 0;
  const put = (v: number) => {
    const x = x0 + (p % w);
    const y = y0 + Math.floor(p / w);
    if (x < size && y < size) out[y * size + x] = v;
    p++;
  };
  for (let i = 4; i < bytes.length && p < total;) {
    const b = bytes[i++];
    if (b < 0x80) put(b);
    else {
      const v = bytes[i++];
      for (let n = b - 0x80 + 2; n > 0 && p < total; n--) put(v);
    }
  }
  return out;
}

const indexCache = new Map<string, Uint8Array>();

/** Palette-index grid of a block frame (cached; mirrored refs are flipped copies). */
export function frameIndices(blockId: string, ref: number): Uint8Array {
  const key = `${blockId}#${ref}`;
  const hit = indexCache.get(key);
  if (hit) return hit;
  const b = blockOf(blockId);
  const id = ref < 0 ? ~ref : ref;
  const src = b.frames[id];
  if (src === undefined) throw new Error(`Block "${blockId}" has no frame ${id}`);
  let grid = decodeIndices(base64Bytes(src), b.size);
  if (ref < 0) {
    const n = b.size;
    const flipped = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) flipped[y * n + (n - 1 - x)] = grid[y * n + x];
    grid = flipped;
  }
  indexCache.set(key, grid);
  return grid;
}

/** Head anchor [x, y] of a frame ref (mirrored for negative refs). */
export function frameAnchor(blockId: string, ref: number): [number, number] {
  const b = blockOf(blockId);
  const id = ref < 0 ? ~ref : ref;
  const x = b.anchors[id * 2];
  const y = b.anchors[id * 2 + 1];
  return ref < 0 ? [b.size - 1 - x, y] : [x, y];
}

// ---------------------------------------------------------------------------------------------
// Animation resolution
// ---------------------------------------------------------------------------------------------

/** An animation with refs for all four facings. */
export interface ResolvedAnim {
  /** Block whose frames the refs index. */
  block: string;
  fps: number;
  loop: boolean;
  dirs: Record<Dir, number[]>;
}

const FALLBACK: Record<Dir, readonly Dir[]> = {
  down: ['down', 'up', 'left', 'right'],
  up: ['up', 'down', 'left', 'right'],
  left: ['left', 'right', 'down', 'up'],
  right: ['right', 'left', 'down', 'up'],
};

/** Fill an animation's missing facings: the opposite side mirrored, else the nearest facing it has. */
function fillDirs(a: SheetAnimData): Record<Dir, number[]> {
  const out = {} as Record<Dir, number[]>;
  for (const d of DIRS) {
    for (const f of FALLBACK[d]) {
      const refs = a.dirs[f];
      if (!refs?.length) continue;
      const mirror = (d === 'left' && f === 'right') || (d === 'right' && f === 'left');
      out[d] = mirror ? refs.map((r) => ~r) : refs.slice();
      break;
    }
  }
  return out;
}

/** Every animation of one block with all four facings filled (blocks used as extras may lack idle). */
export function resolveAnims(blockId: string): Record<string, ResolvedAnim> {
  const b = blockOf(blockId);
  const out: Record<string, ResolvedAnim> = {};
  for (const [name, a] of Object.entries(b.anims)) {
    const dirs = fillDirs(a);
    if (DIRS.every((d) => dirs[d]?.length)) out[name] = { block: blockId, fps: a.fps, loop: a.loop, dirs };
  }
  return out;
}

/**
 * Every animation of a look: its block's, plus those of its `extra` blocks (an extra fills in
 * animations the main block lacks; animations it names explicitly replace the main block's).
 */
export function lookAnims(look: SheetLook): Record<string, ResolvedAnim> {
  const out = resolveAnims(look.block);
  for (const ex of look.extra ?? []) {
    const more = resolveAnims(ex.block);
    for (const [name, a] of Object.entries(more)) {
      if (ex.anims ? ex.anims.includes(name) : !out[name]) out[name] = a;
    }
    for (const name of ex.anims ?? []) if (!more[name]) throw new Error(`Block "${ex.block}" has no animation "${name}"`);
  }
  if (!out.idle) throw new Error(`Block "${look.block}" has no idle animation`);
  return out;
}

/** Which frame of an animation a still Pose uses. */
type FramePick = 'first' | 'last' | 'key' | 'q1' | 'q3';

/** Still-pose sources, in preference order: animation name and which of its frames. */
const POSE_SOURCES: Record<Pose, readonly (readonly [string, FramePick])[]> = {
  idle: [['idle', 'first']],
  walk1: [['walk', 'q1'], ['run', 'q1']],
  walk2: [['walk', 'q3'], ['run', 'q3']],
  punch1: [['punch1', 'key']],
  punch2: [['punch2', 'key'], ['punch1', 'key']],
  kick: [['kick', 'key'], ['punch3', 'key'], ['punch2', 'key']],
  blast: [['blast', 'key'], ['beam', 'key'], ['punch1', 'key']],
  charge: [['charge', 'first'], ['guard', 'first']],
  hurt: [['hurt', 'first']],
  ko: [['ko', 'last'], ['hurt', 'last']],
  raise: [['raise', 'last'], ['charge', 'first']],
  fly: [['fly', 'first'], ['idle', 'first']],
  guard: [['guard', 'first'], ['charge', 'first']],
};

function pickIndex(n: number, pick: FramePick): number {
  switch (pick) {
    case 'first': return 0;
    case 'last': return n - 1;
    // Attack strings run wind-up, hit, follow-through, recover: the hit is the second frame of short strings.
    case 'key': return Math.min(n - 1, Math.max(1, Math.floor((n - 1) / 2)));
    case 'q1': return Math.floor(n / 4);
    case 'q3': return Math.floor((3 * n) / 4);
  }
}

/** The animation and frame ref each still Pose uses, per facing. */
export function poseRefs(anims: Readonly<Record<string, ResolvedAnim>>): Record<Pose, Record<Dir, { anim: string; ref: number }>> {
  const out = {} as Record<Pose, Record<Dir, { anim: string; ref: number }>>;
  for (const pose of POSES) {
    const src = POSE_SOURCES[pose].find(([name]) => anims[name]) ?? (['idle', 'first'] as const);
    const a = anims[src[0]];
    const dirs = {} as Record<Dir, { anim: string; ref: number }>;
    for (const d of DIRS) dirs[d] = { anim: src[0], ref: a.dirs[d][pickIndex(a.dirs[d].length, src[1])] };
    out[pose] = dirs;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------------------------

/** Final colour of every palette index for a look (index 0 = transparent = null). */
export function lookPalette(look: SheetLook, blockId = look.block): (readonly [number, number, number] | null)[] {
  const b = blockOf(blockId);
  const map = new Map<string, string>();
  for (const [part, to] of Object.entries(look.parts ?? {})) {
    const from = b.parts[part];
    if (!from?.length || !to?.length) continue;
    from.forEach((c, i) => {
      const j = from.length === 1 ? to.length - 1 : Math.round((i * (to.length - 1)) / (from.length - 1));
      map.set(c, to[j]);
    });
  }
  for (const [from, to] of Object.entries(look.recolor ?? {})) map.set(from.toLowerCase(), to);
  return [null, ...b.palette.map((c) => hexRgb(map.get(c) ?? c))];
}

/** Overlay grid for a facing (mirroring the other side when needed) with its top-left offset from the anchor. */
function overlayFor(o: SheetOverlay, dir: Dir): { rows: readonly string[]; ox: number; oy: number } | null {
  const own = o.rows[dir];
  const other: Dir | null = dir === 'left' ? 'right' : dir === 'right' ? 'left' : null;
  if (own) {
    const w = Math.max(0, ...own.map((r) => r.length));
    const off = o.offset?.[dir];
    return { rows: own, ox: off ? off[0] : -Math.floor(w / 2), oy: off ? off[1] : 0 };
  }
  const src = other ? o.rows[other] : undefined;
  if (!other || !src) return null;
  const w = Math.max(0, ...src.map((r) => r.length));
  const rows = src.map((r) => r.padEnd(w, '.').split('').reverse().join(''));
  const off = o.offset?.[other] ?? [-Math.floor(w / 2), 0];
  // Mirroring about the (mirrored) anchor column: x -> -x, so the grid's left edge moves to -(ox + w - 1).
  return { rows, ox: -off[0] - w + 1, oy: off[1] };
}

/**
 * Render one frame of a look as RGBA pixels: decode (and mirror), erase, recolour, overlay, scale.
 * `dir` is the facing the actor shows (selects the overlay grid); `anim` lets overlays skip animations.
 */
export function framePixels(look: SheetLook, ref: number, dir: Dir, anim = '', blockId = look.block): FramePixels {
  const b = blockOf(blockId);
  const n = b.size;
  const grid = frameIndices(blockId, ref);
  const pal = lookPalette(look, blockId);
  const o = look.overlay && !look.overlay.skipAnims?.includes(anim) ? look.overlay : null;
  const [ax, ay] = frameAnchor(blockId, ref);
  let erase: Set<number> | null = null;
  if (o?.erase?.length) {
    erase = new Set();
    for (const c of o.erase) {
      const i = b.palette.indexOf(c.toLowerCase());
      if (i >= 0) erase.add(i + 1);
    }
  }
  const base = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = grid[y * n + x];
      if (!v) continue;
      if (erase?.has(v) && (o?.eraseDepth === undefined || y < ay + o.eraseDepth)) continue;
      const rgb = pal[v];
      if (!rgb) continue;
      const i = (y * n + x) * 4;
      base[i] = rgb[0];
      base[i + 1] = rgb[1];
      base[i + 2] = rgb[2];
      base[i + 3] = 255;
    }
  }
  if (o) {
    const g = overlayFor(o, dir);
    if (g) {
      g.rows.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          const ch = row[gx];
          if (ch === '.' || ch === ' ') continue;
          const col = o.palette[ch];
          if (!col) continue;
          const x = ax + g.ox + gx;
          const y = ay + g.oy + gy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const [r, gg, bb] = hexRgb(col);
          const i = (y * n + x) * 4;
          base[i] = r;
          base[i + 1] = gg;
          base[i + 2] = bb;
          base[i + 3] = 255;
        }
      });
    }
  }
  const k = look.scale ?? 1;
  if (k === 1) return { w: n, h: n, data: base };
  const w = Math.max(1, Math.round(n * k));
  const data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) {
    const sy = Math.min(n - 1, Math.floor(y / k));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(n - 1, Math.floor(x / k));
      const s = (sy * n + sx) * 4;
      const d = (y * w + x) * 4;
      data[d] = base[s];
      data[d + 1] = base[s + 1];
      data[d + 2] = base[s + 2];
      data[d + 3] = base[s + 3];
    }
  }
  return { w, h: w, data };
}

function toBitmap(px: FramePixels): Bitmap {
  const { bmp, ctx } = makeBitmap(px.w, px.h);
  const img = ctx.createImageData(px.w, px.h);
  img.data.set(px.data);
  ctx.putImageData(img, 0, 0);
  return bmp;
}

// ---------------------------------------------------------------------------------------------
// Frame pool: sheet frames become canvases only while they are in use
// ---------------------------------------------------------------------------------------------

/**
 * Most sheet canvases a page keeps alive at once. Browsers cap the image resources a page may
 * hold (Chromium drops every canvas's pixels, the screen included, a little past 8,000), and the
 * full cast spans ~27,000 frames, so sheet frames are rendered on first use and the least recently
 * used ones are released past this budget (rebuilt from the block data if they are needed again).
 * A field scene uses a few hundred frames; the budget leaves room for tiles, portraits and the
 * procedural sprites.
 */
export const FRAME_POOL_CAP = 2048;

/** One sheet frame: how to render it, and its canvas while the pool holds it. */
export class FrameSlot {
  bmp: Bitmap | null = null;
  constructor(readonly render: () => FramePixels) {}
}

/** Live slots, least recently used first (a Set iterates in insertion order). */
const framePool = new Set<FrameSlot>();

/** The canvas of a frame slot, rendering it (and releasing the least recently used slot) if needed. */
export function slotBitmap(slot: FrameSlot): Bitmap {
  if (slot.bmp) {
    framePool.delete(slot);
    framePool.add(slot);
    return slot.bmp;
  }
  const bmp = toBitmap(slot.render());
  slot.bmp = bmp;
  framePool.add(slot);
  while (framePool.size > FRAME_POOL_CAP) {
    const oldest = framePool.values().next().value as FrameSlot;
    framePool.delete(oldest);
    oldest.bmp = null;
  }
  return bmp;
}

/** Number of sheet frames currently rendered as canvases (diagnostics and tests). */
export function liveFrameCount(): number {
  return framePool.size;
}

/** Bitmap array whose elements render on access (plain reads: `a[i]`, `a.length`, iteration). */
export function lazyFrames(slots: readonly FrameSlot[]): Bitmap[] {
  const out: Bitmap[] = [];
  slots.forEach((slot, i) => {
    Object.defineProperty(out, i, { get: () => slotBitmap(slot), enumerable: true });
  });
  return out;
}

/** Facing → bitmap record whose entries render on access. */
export function lazyDirs(slotOf: (d: Dir) => FrameSlot): Record<Dir, Bitmap> {
  const out = {} as Record<Dir, Bitmap>;
  for (const d of DIRS) {
    const slot = slotOf(d);
    Object.defineProperty(out, d, { get: () => slotBitmap(slot), enumerable: true });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Sprite sets
// ---------------------------------------------------------------------------------------------

const animsOfSet = new WeakMap<SpriteSet, SpriteAnims>();

/** Multi-frame animations of a sprite set, or undefined for procedural / creature sets. */
export function spriteAnims(set: SpriteSet): SpriteAnims | undefined {
  return animsOfSet.get(set);
}

/** Attach animations to a sprite set (used by the sheet builder and by transforms such as scaling). */
export function setSpriteAnims(set: SpriteSet, anims: SpriteAnims): void {
  animsOfSet.set(set, anims);
}

/** Build a full sprite set (every Pose still plus every animation) for a sheet look. */
export function buildSheetSet(look: SheetLook): SpriteSet {
  const resolved = lookAnims(look);
  const cache = new Map<string, FrameSlot>();
  // Frames are shared between animations; the overlay grid depends on the facing, so with an
  // overlay one frame can render differently per facing (and not at all for skipped animations).
  // Each frame is a pool slot: its canvas exists only while the frame is in use (see FRAME_POOL_CAP).
  const slot = (block: string, ref: number, dir: Dir, anim: string): FrameSlot => {
    const skip = look.overlay?.skipAnims?.includes(anim) ?? false;
    const key = `${block}#${ref}|${look.overlay && !skip ? dir : skip ? 'skip' : ''}`;
    let s = cache.get(key);
    if (!s) {
      s = new FrameSlot(() => framePixels(look, ref, dir, anim, block));
      cache.set(key, s);
    }
    return s;
  };
  const anims: Record<string, SpriteAnim> = {};
  for (const [name, a] of Object.entries(resolved)) {
    const frames = {} as Record<Dir, Bitmap[]>;
    for (const d of DIRS) frames[d] = lazyFrames(a.dirs[d].map((r) => slot(a.block, r, d, name)));
    anims[name] = { frames, fps: a.fps, loop: a.loop };
  }
  const set = {} as SpriteSet;
  const refs = poseRefs(resolved);
  for (const pose of POSES) {
    set[pose] = lazyDirs((d) => {
      const { anim, ref } = refs[pose][d];
      return slot(resolved[anim].block, ref, d, anim);
    });
  }
  setSpriteAnims(set, anims);
  return set;
}

// ---------------------------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------------------------

/** Animations each Pose plays, in preference order (the combo finisher 'kick' is the third string). */
export const POSE_ANIMS: Readonly<Record<Pose, readonly string[]>> = {
  idle: ['idle'],
  walk1: [],
  walk2: [],
  punch1: ['punch1'],
  punch2: ['punch2'],
  kick: ['punch3', 'kick'],
  blast: ['blast'],
  charge: ['charge'],
  hurt: ['hurt'],
  ko: ['ko'],
  raise: ['raise'],
  fly: ['fly'],
  guard: ['guard'],
};

/** Ticks per second of the game loop. */
export const TICKS_PER_SECOND = 60;

/** Frame index of an animation `t` ticks after it started. */
export function animIndex(anim: Pick<SpriteAnim, 'fps' | 'loop'>, count: number, t: number): number {
  if (count <= 1) return 0;
  const i = Math.floor((Math.max(0, t) * anim.fps) / TICKS_PER_SECOND);
  return anim.loop ? i % count : Math.min(count - 1, i);
}
