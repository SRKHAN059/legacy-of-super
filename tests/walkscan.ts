import { STORY_GATES } from '../src/content/chapters/common';
import { CREATURES } from '../src/content/creatures';
import { MAPS, resolveMap } from '../src/content/registry';
import { SPOTS } from '../src/content/world';
import { TILE } from '../src/engine/constants';
import { overlaps, type Rect } from '../src/engine/math';
import type { CollisionMap, CornerSlide } from '../src/game/collision';
import type { MapDef } from '../src/game/mapdef';
import { GameState } from '../src/game/state';
import { MapInstance } from '../src/game/world';

/**
 * Wedge scan (critic round 3, gap 5): can the player's feet box get stuck anywhere a player can get to?
 *
 * Positions are the feet box's top-left corner on the whole-pixel lattice. A lattice position is free when the box
 * there overlaps no solid pixel: tiles and the solid rects of props, objects and gates rasterised so that a
 * whole-pixel box is free on the lattice exactly when `CollisionMap.blocked` says so. Prefix sums make each test
 * O(1), so a breadth-first walk over every free position of every map is cheap.
 *
 * Per map and collision variant (`VARIANTS`, and the story's own layouts: `scanStory`) the scan finds:
 *   - arrivals: every place the game drops the player onto the map (warp and flight destinations, world-map landing
 *     spots, and the far end of every neighbour's edge exit, for each free position along that edge; the ones that
 *     are out in the variant), each of which must be a free box (the game never moves a player out of a wall), unless
 *     it is a story gate that stands only while the player cannot be beyond it (`rescued`);
 *   - the reachable set: the free positions connected to an arrival by one-pixel steps;
 *   - pockets: an arrival whose reachable part of the map has no way off it (no warp, edge exit, flight circle or world
 *     sign) while the map has one, or only one through a gap exactly as wide as the feet box (`roomy`);
 *   - snags: a reachable position where a held straight direction makes no progress although a step that way is
 *     free after sliding at most `NUDGE` px sideways (the player's corner assist must find it; a lane barely wider
 *     than the box beside a cliff once stalled the hero for good);
 *   - knock-back: from reachable positions hugging an obstacle, the player's real knock-back (`Player.onHurt`, decaying
 *     through `CollisionMap.move`) from eight directions ends on a free box that is still reachable and from which a
 *     held direction moves the hero again;
 *   - unreachable things to use ('open' only): chests, signs, save points, flight circles, world signs, NPCs with
 *     something to say, pickups and triggers no reachable position can touch (or face, for the ones used with A), or
 *     only past such a gap.
 */

/** Player feet box (Actor default for humanoid sprites; every playable character is one). */
export const FEET = { w: 10, h: 6 };
/** Farthest sideways slide of the corner assist the snag check expects to be taken (CollisionMap's NUDGE). */
const NUDGE = 4;
/** Player knock-back: speed on the hit and per-frame decay (Player.onHurt / Player.update). */
const KNOCK = 2.4;
const KNOCK_DECAY = 0.78;
/** Spacing (px) of the obstacle-hugging positions the knock-back check starts from (under a feet box apart). */
const KNOCK_GRID = 8;

/** Which collision a map is scanned with. */
export type WalkVariant = 'start' | 'open' | 'story';

/**
 * 'start': a new game's state (gates shut, story props as at the first visit). 'open': every coloured gate broken and
 * story gate open, every breakable smashed, and every flagged prop in its flag-set state (shown props on, hidden ones
 * off): the most of the map a player ever walks. 'story' (`scanStory`): a state of the story run, for the props,
 * barriers and flight circles that stand only part of the game (a prop shown from one flag and hidden by a later one
 * is in neither of the other two).
 */
export const VARIANTS: WalkVariant[] = ['start', 'open'];

/** A map's collision rasterised onto the feet-box lattice. */
export class WalkGrid {
  readonly id: string;
  readonly def: MapDef;
  readonly map: MapInstance;
  readonly col: CollisionMap;
  /** The state the map is laid out with ('start' and 'story': 'open' shows everything). */
  private readonly state: GameState | null;
  /** Lattice size: feet-box top-left positions inside the map. */
  readonly W: number;
  readonly H: number;
  private readonly pw: number;
  private readonly ph: number;
  /** Prefix sums of solid pixels, (pw + 1) x (ph + 1). */
  private readonly sum: Int32Array;

  /**
   * A registered map by id, or a map definition of its own (the scan's own fixtures), laid out as `variant` says;
   * 'story' takes the state to lay it out with (`storyLayout`).
   */
  constructor(source: string | MapDef, variant: WalkVariant, story?: GameState) {
    const def = typeof source === 'string' ? resolveMap(source) : source;
    if (!def) throw new Error(`walk scan: no map ${String(source)}`);
    if (variant === 'story' && !story) throw new Error(`walk scan: ${def.id} laid out for a story state without one`);
    this.id = def.id;
    this.def = def;
    // 'open' answers every story condition with yes (flagged props shown, hidden ones gone, chests and flight circles
    // out, story gates open) and has every coloured gate broken; chests stay shut (they are things to reach).
    const open = { check: () => true, flag: (k: string) => k.startsWith('gate:') || k.startsWith('broke:') } as unknown as GameState;
    const st = variant === 'open' ? open : variant === 'story' && story ? story : new GameState();
    this.state = variant === 'open' ? null : st;
    this.map = new MapInstance(def, st);
    if (variant === 'open') {
      for (const o of this.map.objects) if (o.def.type === 'breakable' && !o.gone) this.map.removeObject(o);
    }
    this.col = this.map.col;
    this.pw = this.map.pw;
    this.ph = this.map.ph;
    this.W = this.pw - FEET.w + 1;
    this.H = this.ph - FEET.h + 1;
    const solid = new Uint8Array(this.pw * this.ph);
    for (let ty = 0; ty < this.map.rows; ty++) {
      for (let tx = 0; tx < this.map.cols; tx++) {
        if (!this.col.tileSolid(tx, ty)) continue;
        for (let y = ty * TILE; y < (ty + 1) * TILE; y++) solid.fill(1, y * this.pw + tx * TILE, y * this.pw + (tx + 1) * TILE);
      }
    }
    // A whole-pixel box overlaps a rect exactly when it covers a pixel the rect reaches into (strict overlap).
    for (const r of this.col.solidRects()) {
      if (r.w <= 0 || r.h <= 0) continue;
      const x0 = Math.max(0, Math.floor(r.x));
      const x1 = Math.min(this.pw, Math.ceil(r.x + r.w));
      const y0 = Math.max(0, Math.floor(r.y));
      const y1 = Math.min(this.ph, Math.ceil(r.y + r.h));
      for (let y = y0; y < y1; y++) if (x1 > x0) solid.fill(1, y * this.pw + x0, y * this.pw + x1);
    }
    const S = this.pw + 1;
    this.sum = new Int32Array(S * (this.ph + 1));
    for (let y = 0; y < this.ph; y++) {
      let row = 0;
      for (let x = 0; x < this.pw; x++) {
        row += solid[y * this.pw + x];
        this.sum[(y + 1) * S + x + 1] = this.sum[y * S + x + 1] + row;
      }
    }
  }

  /** Whether something with these conditions is out in this variant ('open': everything is). */
  shows(showIf?: string, hideIf?: string): boolean {
    if (!this.state) return true;
    return this.state.check(showIf) && !(hideIf && this.state.check(hideIf));
  }

  /** Solid pixels in [x0, x1) x [y0, y1) (clamped to the map). */
  private solidIn(x0: number, y0: number, x1: number, y1: number): number {
    const S = this.pw + 1;
    return this.sum[y1 * S + x1] - this.sum[y0 * S + x1] - this.sum[y1 * S + x0] + this.sum[y0 * S + x0];
  }

  /**
   * True when the feet box with its top-left at lattice (x, y) is inside the map and overlaps nothing solid; with
   * `slack`, a box one pixel wider and taller (the feet box with room to spare on both axes) must be.
   */
  free(x: number, y: number, slack = 0): boolean {
    if (x < 0 || y < 0 || x + slack >= this.W || y + slack >= this.H) return false;
    return this.solidIn(x, y, x + FEET.w + slack, y + FEET.h + slack) === 0;
  }

  /** Lattice index of a position. */
  key(x: number, y: number): number {
    return y * this.W + x;
  }

  /** Free lattice positions (with `slack`, see `free`) connected to `seeds` by one-pixel steps (1 = reached). */
  flood(seeds: number[], slack = 0): Uint8Array {
    const seen = new Uint8Array(this.W * this.H);
    let q: number[] = [];
    for (const k of seeds) if (!seen[k]) { seen[k] = 1; q.push(k); }
    while (q.length) {
      const next: number[] = [];
      for (const k of q) {
        const x = k % this.W;
        const y = (k - x) / this.W;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!this.free(nx, ny, slack)) continue;
          const nk = this.key(nx, ny);
          if (seen[nk]) continue;
          seen[nk] = 1;
          next.push(nk);
        }
      }
      q = next;
    }
    return seen;
  }

  /**
   * The feet-box positions a player gets to without squeezing through a gap exactly as wide (or tall) as the feet
   * box, from `seeds` (feet-box positions): the slack box's reach, each slack position standing for the four feet-box
   * positions inside it.
   */
  roomy(seeds: number[]): Uint8Array {
    const start: number[] = [];
    for (const k of seeds) {
      const x = k % this.W;
      const y = (k - x) / this.W;
      for (const [sx, sy] of [[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]]) if (this.free(sx, sy, 1)) start.push(this.key(sx, sy));
    }
    const wide = this.flood(start, 1);
    const out = new Uint8Array(this.W * this.H);
    for (let k = 0; k < wide.length; k++) {
      if (!wide[k]) continue;
      out[k] = 1;
      out[k + 1] = 1;
      out[k + this.W] = 1;
      out[k + this.W + 1] = 1;
    }
    return out;
  }

  /** Free lattice positions around a real feet box's top-left (its whole-pixel neighbours), as keys. */
  near(bx: number, by: number): number[] {
    const out: number[] = [];
    for (const y of new Set([Math.floor(by), Math.ceil(by)])) {
      for (const x of new Set([Math.floor(bx), Math.ceil(bx)])) if (this.free(x, y)) out.push(this.key(x, y));
    }
    return out;
  }
}

/** Feet box of a player standing with their feet at (px, py) (Actor.box). */
export function feetAt(px: number, py: number): Rect {
  return { x: px - FEET.w / 2, y: py - FEET.h, w: FEET.w, h: FEET.h };
}

/** The A-button reach (Player.front(14, 16)) of a player whose feet box sits at lattice (x, y), facing each way. */
function fronts(x: number, y: number): Rect[] {
  const px = x + FEET.w / 2;
  const py = y + FEET.h;
  const midY = py - 12;
  return [
    { x: px + 4, y: midY - 8, w: 14, h: 16 },
    { x: px - 4 - 14, y: midY - 8, w: 14, h: 16 },
    { x: px - 8, y: py - 6, w: 16, h: 14 },
    { x: px - 8, y: py - 20 - 14, w: 16, h: 14 },
  ];
}

/** One place the game puts the player on a map. */
export interface Arrival {
  /** Feet position in world pixels. */
  px: number;
  py: number;
  /** The map it comes from (null: the world map), and a description for messages. */
  src: string | null;
  from: string;
}

/** Feet position of a tile placement (Game.startField: tile centre, feet near its bottom edge). */
const tileFeet = (tx: number, ty: number): { px: number; py: number } => ({ px: tx * TILE + 8, py: ty * TILE + 14 });

/**
 * Every arrival onto `id`: warps and flight circles of every map that lead here, landing spots, and for each
 * neighbour's edge exit the arrival of a player walking off each free position of that edge (Game.edgeExit keeps the
 * coordinate along the edge, plus the exit's offset). `grids` supplies the neighbours' lattices (same variant).
 */
export function arrivals(id: string, grids: (mapId: string) => WalkGrid): Arrival[] {
  const out: Arrival[] = [];
  for (const s of Object.values(SPOTS)) if (s.map === id && !s.toWorld) out.push({ ...tileFeet(s.tx, s.ty), src: null, from: `landing spot ${s.id}` });
  const def = resolveMap(id);
  if (!def) return out;
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  for (const src of Object.keys(MAPS)) {
    const m = resolveMap(src);
    if (!m) continue;
    const leads = (m.warps ?? []).some((w) => w.to === id) || (m.objects ?? []).some((o) => o.type === 'flight' && o.to === id)
      || Object.values(m.exits ?? {}).some((ex) => ex?.to === id);
    if (!leads) continue;
    // Only the ones that are out in this variant (a flight circle that appears once the rubble on its landing
    // circle is gone does not land on the rubble).
    const g = grids(src);
    for (const w of m.warps ?? []) if (w.to === id && g.shows(w.showIf, w.hideIf)) out.push({ ...tileFeet(w.tx, w.ty), src, from: `warp from ${src} (${w.x},${w.y})` });
    for (const o of m.objects ?? []) {
      if (o.type === 'flight' && o.to === id && g.shows(o.showIf)) out.push({ ...tileFeet(o.tx, o.ty), src, from: `flight circle on ${src} (${o.x},${o.y})` });
    }
    for (const [side, ex] of Object.entries(m.exits ?? {})) {
      if (!ex || ex.to !== id || !g.shows(ex.showIf, ex.hideIf)) continue;
      const offset = ex.offset ?? 0;
      // The edge strip a player walks off from (Field.checkWarps: the box within 1 px of the edge, pushing out).
      const along = side === 'north' || side === 'south' ? g.W : g.H;
      for (let a = 0; a < along; a++) {
        const [bx, by] = side === 'north' ? [a, 0] : side === 'south' ? [a, g.H - 1] : side === 'west' ? [0, a] : [g.W - 1, a];
        if (!g.free(bx, by)) continue;
        // Feet position on the source map, then Game.edgeExit's tile arithmetic.
        const sx = (bx + FEET.w / 2) / TILE;
        const sy = (by + FEET.h) / TILE;
        let tx = sx - 0.5;
        let ty = sy - 0.875;
        if (side === 'north') { ty = rows - 1.2; tx = Math.min(cols - 1, Math.max(0, tx + offset)); }
        if (side === 'south') { ty = 0.2; tx = Math.min(cols - 1, Math.max(0, tx + offset)); }
        if (side === 'west') { tx = cols - 1.2; ty = Math.min(rows - 1, Math.max(0, ty + offset)); }
        if (side === 'east') { tx = 0.2; ty = Math.min(rows - 1, Math.max(0, ty + offset)); }
        out.push({ ...tileFeet(tx, ty), src, from: `${side} edge of ${src} at ${side === 'north' || side === 'south' ? 'x' : 'y'}=${a}` });
      }
    }
  }
  return out;
}

/** What the scan found on one map in one variant. */
export interface WalkReport {
  map: string;
  variant: WalkVariant;
  arrivals: number;
  /** Reachable lattice positions. */
  reachable: number;
  /** Problems, one line each (empty = no trap). */
  problems: string[];
  /** The story state a 'story' scan laid the map out with (`scanStory`). */
  label?: string;
}

/** Things a player uses on a map, as the rect to touch (`touch`) or to face with A (`face`). */
function usables(g: WalkGrid): Array<{ what: string; rect: Rect; touch: boolean; face: boolean }> {
  const out: Array<{ what: string; rect: Rect; touch: boolean; face: boolean }> = [];
  for (const o of g.map.objects) {
    const d = o.def;
    if (o.gone || d.type === 'breakable' || d.type === 'bag') continue;
    out.push({ what: `${d.type} at ${d.x},${d.y}`, rect: o.rect, touch: d.type === 'flight', face: true });
  }
  for (const n of g.def.npcs ?? []) {
    if (!n.talk) continue;
    const x = n.x * TILE + 8;
    const y = n.y * TILE + 14;
    const s = CREATURES[n.sprite]?.size ?? 0;
    // Actor.body / Actor.box (a creature's box widens with its size).
    const body = s ? { x: x - s * 0.35, y: y - s * 0.7, w: s * 0.7, h: s * 0.7 } : { x: x - 7, y: y - 26, w: 14, h: 26 };
    out.push({ what: `npc ${n.id}`, rect: body, touch: false, face: true });
  }
  for (const p of g.def.pickups ?? []) {
    const x = p.x * TILE + 8;
    const y = p.y * TILE + 12;
    // Visible pickups are walked over (Field.updatePickups); hidden ones are found facing them with A (within 14 px).
    out.push(p.hidden
      ? { what: `hidden pickup ${p.id}`, rect: { x: x - 10, y: y - 10, w: 20, h: 20 }, touch: false, face: true }
      : { what: `pickup ${p.id}`, rect: { x: x - 6, y: y - 8, w: 12, h: 12 }, touch: true, face: false });
  }
  for (const t of g.def.triggers ?? []) {
    out.push({ what: `${t.onAction ? 'action ' : ''}trigger ${t.id}`, rect: { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE }, touch: true, face: !!t.onAction });
  }
  return out;
}

/** Ways off a map that a reachable position can take (warps, edge exits, flight circles, world signs). */
function exitsOf(g: WalkGrid): Array<{ what: string; at: (x: number, y: number) => boolean }> {
  const out: Array<{ what: string; at: (x: number, y: number) => boolean }> = [];
  const box = (x: number, y: number): Rect => ({ x, y, w: FEET.w, h: FEET.h });
  for (const w of g.def.warps ?? []) {
    const r = { x: w.x * TILE, y: w.y * TILE, w: w.w * TILE, h: w.h * TILE };
    out.push({ what: `warp to ${w.to}`, at: (x, y) => overlaps(box(x, y), r) });
  }
  const ex = g.def.exits ?? {};
  if (ex.north) out.push({ what: 'north edge', at: (_x, y) => y <= 1 });
  if (ex.south) out.push({ what: 'south edge', at: (_x, y) => y + FEET.h >= g.map.ph - 1 });
  if (ex.west) out.push({ what: 'west edge', at: (x) => x <= 1 });
  if (ex.east) out.push({ what: 'east edge', at: (x) => x + FEET.w >= g.map.pw - 1 });
  for (const o of g.map.objects) {
    if (o.def.type === 'flight') out.push({ what: 'flight circle', at: (x, y) => overlaps(box(x, y), o.rect) || fronts(x, y).some((f) => overlaps(f, o.rect)) });
    if (o.def.type === 'worldSign') out.push({ what: 'world sign', at: (x, y) => fronts(x, y).some((f) => overlaps(f, o.rect)) });
  }
  return out;
}

/** True when some reached lattice position within `r` (grown by `pad`) satisfies `ok`. */
function anyReached(g: WalkGrid, seen: Uint8Array, r: Rect, pad: number, ok: (x: number, y: number) => boolean): boolean {
  const x0 = Math.max(0, Math.floor(r.x - pad - FEET.w));
  const x1 = Math.min(g.W - 1, Math.ceil(r.x + r.w + pad));
  const y0 = Math.max(0, Math.floor(r.y - pad - FEET.h));
  const y1 = Math.min(g.H - 1, Math.ceil(r.y + r.h + pad));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (seen[g.key(x, y)] && ok(x, y)) return true;
  return false;
}

/** Straight steps: d-pad directions as unit vectors. */
const STRAIGHT: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * A step from lattice (x, y) along (dx, dy) that is free after a sideways slide of at most NUDGE px, every position of
 * the slide free too and a pixel to spare beyond its far side (the corner assist's promise: it never slides flush
 * against a wall, see CollisionMap.nudge), or null when the step is open straight away or not within reach.
 */
function nudgeable(g: WalkGrid, x: number, y: number, dx: number, dy: number): number | null {
  if (g.free(x + dx, y + dy)) return null;
  for (let o = 1; o <= NUDGE; o++) {
    for (const s of [1, -1]) {
      const ox = dy !== 0 ? s : 0;
      const oy = dx !== 0 ? s : 0;
      let clear = true;
      for (let i = 1; i <= o + 1 && clear; i++) clear = g.free(x + ox * i, y + oy * i);
      if (clear && g.free(x + ox * o + dx, y + oy * o + dy) && g.free(x + ox * (o + 1) + dx, y + oy * (o + 1) + dy)) return s * o;
    }
  }
  return null;
}

/**
 * True when an arrival lands in a story gate that stands while the player is on its far side: a game resumed beyond
 * the gate (its `rescue` maps) opens it on entering the map, so walking back through never meets it standing.
 */
function rescued(g: WalkGrid, a: Arrival, b: Rect): boolean {
  let gated = false;
  for (const r of g.col.solidRects()) {
    if (!overlaps(b, r)) continue;
    const gate = r.tag?.startsWith('gate:') ? STORY_GATES.find((s) => `gate:${s.id}` === r.tag && s.map === g.id) : undefined;
    if (!gate || !a.src || !gate.rescue.includes(a.src)) return false;
    gated = true;
  }
  if (!gated) return false;
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - 0.001) / TILE);
  const y0 = Math.floor(b.y / TILE);
  const y1 = Math.floor((b.y + b.h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (g.col.tileSolid(tx, ty)) return false;
  return true;
}

/** Scan one registered map in one variant. `grids` caches lattices per map (neighbours give the edge arrivals). */
export function scanMap(id: string, variant: WalkVariant, grids: (mapId: string) => WalkGrid): WalkReport {
  return scanGrid(grids(id), variant, arrivals(id, grids));
}

/**
 * Scan a map's lattice from the given arrivals. `slide` is the corner slide a held direction gets (the player's
 * assist; the scan's own test shows the snag check catching the probe that once stalled the hero).
 */
export function scanGrid(g: WalkGrid, variant: WalkVariant, arr: Arrival[], slide: CornerSlide = 'assist'): WalkReport {
  const id = g.id;
  const problems: string[] = [];
  // Arrivals: a real feet box the game drops the player into must be free.
  const seeds: number[] = [];
  const seedOf = new Map<number, Arrival>();
  const inside = new Map<string, string[]>();
  for (const a of arr) {
    const b = feetAt(a.px, a.py);
    const ks = g.near(b.x, b.y);
    if (rescued(g, a, b)) continue;
    if (g.col.blocked(b) || !ks.length) {
      const where = `(${(a.px / TILE).toFixed(2)},${(a.py / TILE).toFixed(2)})`;
      const k = a.from.replace(/ at [xy]=\d+$/, '');
      (inside.get(k) ?? inside.set(k, []).get(k))?.push(where);
      continue;
    }
    for (const k of ks) { seeds.push(k); if (!seedOf.has(k)) seedOf.set(k, a); }
  }
  for (const [from, at] of inside) problems.push(`arrival inside a wall: ${from} lands at ${at.length > 3 ? `${at.slice(0, 3).join(' ')} and ${at.length - 3} more` : at.join(' ')}`);
  const seen = g.flood(seeds);
  let reachable = 0;
  for (let i = 0; i < seen.length; i++) reachable += seen[i];

  // Pockets: every arrival's part of the map must have a way off it when the map has one, reached without squeezing
  // through a gap exactly the feet box's size (a held direction cannot line the hero up with one: see nudgeable).
  const exits = exitsOf(g);
  const exitAt = (part: Uint8Array): boolean => {
    for (let k = 0; k < part.length; k++) {
      if (!part[k]) continue;
      const x = k % g.W;
      const y = (k - x) / g.W;
      if (exits.some((e) => e.at(x, y))) return true;
    }
    return false;
  };
  if (exits.length) {
    const done = new Uint8Array(g.W * g.H);
    for (const k0 of seeds) {
      if (done[k0]) continue;
      const part = g.flood([k0]);
      for (let k = 0; k < part.length; k++) if (part[k]) done[k] = 1;
      if (exitAt(g.roomy([k0]))) continue;
      const from = seedOf.get(k0)?.from ?? 'an arrival';
      problems.push(exitAt(part)
        ? `tight gap: ${from} leaves the map only through a gap exactly as wide as the feet box`
        : `pocket: ${from} lands where no warp, edge exit, flight circle or world sign can be reached`);
    }
  }

  // Snags: a held straight direction toward a step free within the nudge's slide must move the hero.
  const snags: string[] = [];
  let snagTile = '';
  for (let k = 0; k < seen.length && snags.length < 6; k++) {
    if (!seen[k]) continue;
    const x = k % g.W;
    const y = (k - x) / g.W;
    for (const [dx, dy] of STRAIGHT) {
      if (nudgeable(g, x, y, dx, dy) === null) continue;
      const r = g.col.move({ x, y, w: FEET.w, h: FEET.h }, dx, dy, false, slide);
      if (r.dx !== 0 || r.dy !== 0) continue;
      snagTile ||= `tile ${Math.floor((x + FEET.w / 2) / TILE)},${Math.floor((y + FEET.h - 1) / TILE)}`;
      snags.push(`(${x},${y}) heading ${dx ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north'}`);
    }
  }
  if (snags.length) problems.push(`snag (${snagTile}): holding a direction stalls with the feet box at ${snags.join(', ')}`);

  // Knock-back from obstacle-hugging positions must end free, reachable and able to move on.
  const knocks: string[] = [];
  for (let y = 0; y < g.H && knocks.length < 6; y += KNOCK_GRID) {
    for (let x = 0; x < g.W && knocks.length < 6; x += KNOCK_GRID) {
      if (!seen[g.key(x, y)]) continue;
      if (g.free(x - 2, y) && g.free(x + 2, y) && g.free(x, y - 2) && g.free(x, y + 2)) continue;
      for (let a = 0; a < 8; a++) {
        let bx = x;
        let by = y;
        let kx = Math.cos((a * Math.PI) / 4) * KNOCK;
        let ky = Math.sin((a * Math.PI) / 4) * KNOCK;
        for (let t = 0; t < 120 && (kx || ky); t++) {
          const r = g.col.move({ x: bx, y: by, w: FEET.w, h: FEET.h }, kx, ky);
          bx += r.dx;
          by += r.dy;
          kx *= KNOCK_DECAY;
          ky *= KNOCK_DECAY;
          if (Math.abs(kx) < 0.1) kx = 0;
          if (Math.abs(ky) < 0.1) ky = 0;
        }
        const box = { x: bx, y: by, w: FEET.w, h: FEET.h };
        const why = g.col.blocked(box) ? 'inside a wall'
          : !g.near(bx, by).some((k) => seen[k]) ? 'off the reachable map'
            : STRAIGHT.every(([dx, dy]) => { const r = g.col.move(box, dx, dy, false, slide); return r.dx === 0 && r.dy === 0; }) ? 'unable to move' : '';
        if (why) knocks.push(`from (${x},${y}) knocked ${a * 45}deg ends ${why} at (${bx.toFixed(1)},${by.toFixed(1)})`);
      }
    }
  }
  if (knocks.length) problems.push(`knock-back: ${knocks.join('; ')}`);

  // Things to use that no reachable position touches or faces (or only past a gap exactly the feet box's size).
  if (variant === 'open' && seeds.length) {
    const roomy = g.roomy(seeds);
    const box = (x: number, y: number): Rect => ({ x, y, w: FEET.w, h: FEET.h });
    for (const u of usables(g)) {
      const use = (x: number, y: number): boolean => (u.touch && overlaps(box(x, y), u.rect)) || (u.face && fronts(x, y).some((f) => overlaps(f, u.rect)));
      if (anyReached(g, roomy, u.rect, 40, use)) continue;
      problems.push(anyReached(g, seen, u.rect, 40, use) ? `tight gap: ${u.what} is reached only through a gap exactly as wide as the feet box` : `unreachable: ${u.what}`);
    }
  }
  return { map: id, variant, arrivals: arr.length, reachable, problems };
}

/** Lattices per variant (and story state), built on demand and kept for the neighbours' edge arrivals. */
export function gridCache(variant: WalkVariant, story?: GameState): (mapId: string) => WalkGrid {
  const cache = new Map<string, WalkGrid>();
  return (mapId: string) => {
    let g = cache.get(mapId);
    if (!g) { g = new WalkGrid(mapId, variant, story); cache.set(mapId, g); }
    return g;
  };
}

/**
 * A story state as the scan lays maps out with it: its flags as they are, but every chest shut and every breakable
 * whole, as in 'start' (opening or smashing one only frees ground, and 'open' scans every map with all of them gone).
 * The fingerprints of the maps' layouts (`layoutKey`) then change only with the story.
 */
export function storyLayout(save: string): GameState {
  const st = new GameState(JSON.parse(save) as ConstructorParameters<typeof GameState>[0]);
  for (const k of Object.keys(st.data.flags)) if (k.startsWith('chest:') || k.startsWith('broke:')) delete st.data.flags[k];
  return st;
}

/** Fingerprint of a map's collision as laid out: its solid rects, and which of its flight circles are out. */
function layoutKey(m: MapInstance): string {
  const rects = m.col.solidRects().map((r) => `${r.x},${r.y},${r.w},${r.h}`).sort();
  const circles = m.objects.filter((o) => o.def.type === 'flight' && !o.gone).map((o) => `${o.def.x},${o.def.y}`);
  return `${rects.join(';')}|${circles.join(';')}`;
}

/**
 * The scan in the layouts the story gives each map (`storyLayout`): every map in every state of `states` (a label and
 * a `JSON.stringify(state.data)` each, e.g. the recorded story run's), once per layout that is neither a new game's nor
 * one an earlier state gave it. Arrivals honour the state (a door or edge exit shown only later is not one yet); a
 * region the story walls off is a pocket only when someone can arrive in it. Things to use are left to 'open': a story
 * prop may stand in front of a chest for a chapter.
 */
export function scanStory(states: Array<{ label: string; save: string }>, ids: string[] = Object.keys(MAPS)): WalkReport[] {
  const fresh = new GameState();
  const seen = new Map<string, Set<string>>();
  for (const id of ids) {
    const def = resolveMap(id);
    if (def) seen.set(id, new Set([layoutKey(new MapInstance(def, fresh))]));
  }
  const out: WalkReport[] = [];
  for (const { label, save } of states) {
    const st = storyLayout(save);
    const grids = gridCache('story', st);
    for (const id of ids) {
      const def = resolveMap(id);
      const keys = seen.get(id);
      if (!def || !keys) continue;
      const key = layoutKey(new MapInstance(def, st));
      if (keys.has(key)) continue;
      keys.add(key);
      const r = scanGrid(grids(id), 'story', arrivals(id, grids));
      out.push({ ...r, label });
    }
  }
  return out;
}
