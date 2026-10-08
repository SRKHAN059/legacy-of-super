import { hexRgb, type Bitmap } from '../../engine/gfx';
import { DIRS, type Dir } from '../../engine/math';
import { POSES, type Pose, type SpriteAnim, type SpriteSet } from '../humanoid';
import {
  FrameSlot, frameIndices, framePixels, lazyDirs, lazyFrames, lookAnims, setSpriteAnims, sheetBlock, type FramePixels,
  type ResolvedAnim, type SheetLook,
} from '../sheets';

// =============================================================================================
// Creatures drawn from LoG2's animal sheet (wolf, squirrel, sparrow, cat, butterfly) and Kame
// House's turtle.
//
// Creature ids live in src/content/creatures.ts and registerCreatures calls; their CreatureSpec
// still sets the hitbox, hurtbox and shadow size (Actor.creatureSize), so swapping the art never
// changes a fight. A creature with a look here is drawn from its block; every other creature keeps
// its procedural body (dinosaurs, snakes, bats, bugs, crabs, robots, drones and blobs have no LoG2
// sheet). Stronger tiers recolour the same block, the way LoG2 itself palette-swaps its wildlife.
//
// Animal blocks only have idle / blink / walk (plus the wolf's run and pounce and the birds' and
// butterfly's flight), so each look also says what its attacks, hurt and knock-out show.
// =============================================================================================

/** One frame of an animation: [animation name, frame index] (the index is clamped to the animation). */
export type CreatureFrame = readonly [anim: string, frame: number];

/**
 * A pixel patch pinned to a feature of the art rather than to the head anchor: it is drawn wherever
 * a frame has the marker colour (e.g. fangs under a cat's nose), relative to that colour's top-most,
 * then left-most pixel. Frames without the colour (the back view) are left alone.
 */
export interface CreatureMark {
  /** Exact sheet colour (pre-recolour, lowercase #rrggbb) the patch is pinned to. */
  at: string;
  /** Character → '#rrggbb'; '.' and ' ' are transparent. */
  palette: Readonly<Record<string, string>>;
  /** Grid per facing as the actor faces; a missing `right` mirrors `left` (and vice versa). */
  rows: Partial<Record<Dir, readonly string[]>>;
  /** Top-left of each facing's grid relative to the marker pixel (mirrored with the grid). */
  offset: Partial<Record<Dir, readonly [number, number]>>;
}

/** How a creature id is drawn from a LoG2 sheet block. */
export interface CreatureLook extends SheetLook {
  /** Animation the idle pose loops (default 'idle', which blinks now and then); hovering flyers loop 'fly'. */
  idle?: string;
  /**
   * What attacks show (punch1, punch2, kick, blast): an animation played from the moment the strike
   * starts, or one held frame. Default: the idle loop.
   */
  attack?: string | CreatureFrame;
  /** Frame held while hurt and knocked out. Default: the blink frame (eyes squeezed shut), else idle. */
  hurt?: CreatureFrame;
  /** Pixels (before scaling) the art floats above the ground row; the actor's shadow stays on the ground. */
  lift?: number;
  /** Feature-pinned patches (fangs, horns...) drawn before scaling. */
  marks?: readonly CreatureMark[];
}

/** A frame reference of a planned creature animation. */
export interface CreatureFrameRef {
  block: string;
  ref: number;
  /** Animation the frame came from (overlays may skip animations). */
  anim: string;
}

/** A planned creature animation: frame refs per facing, playback rate and looping. */
export interface CreatureAnimPlan {
  fps: number;
  loop: boolean;
  dirs: Record<Dir, CreatureFrameRef[]>;
}

/** Everything a creature set is made of, as frame references (pixels come from creatureFramePixels). */
export interface CreaturePlan {
  /** Animations by playback name (the names Actor looks up: idle, blink, walk, run, punch1, hurt...). */
  anims: Record<string, CreatureAnimPlan>;
  /** The still frame of every Pose per facing (scripted poses and sets without a matching animation). */
  stills: Record<Pose, Record<Dir, CreatureFrameRef>>;
}

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

const CREATURE_LOOKS: Record<string, CreatureLook> = {};
const listeners: ((ids: string[]) => void)[] = [];

/**
 * Draw these creature ids from sprite-sheet blocks instead of the procedural creature builder.
 * Only ids that are creatures (CREATURES) use their look; cast ids belong to registerSheetCast.
 * Registering an id twice throws.
 */
export function registerSheetCreatures(looks: Readonly<Record<string, CreatureLook>>): void {
  for (const [id, look] of Object.entries(looks)) {
    if (!look.block) throw new Error(`Sheet creature "${id}" has no block`);
    if (CREATURE_LOOKS[id]) throw new Error(`Duplicate sheet creature id "${id}"`);
  }
  const ids = Object.keys(looks);
  for (const id of ids) CREATURE_LOOKS[id] = looks[id];
  if (ids.length) for (const fn of listeners) fn(ids);
}

/** The sheet look registered for a creature id, if any (its block may still be unbuilt). */
export function sheetCreatureOf(id: string): CreatureLook | undefined {
  return CREATURE_LOOKS[id];
}

/** Every creature id with a sheet look. */
export function sheetCreatureIds(): string[] {
  return Object.keys(CREATURE_LOOKS);
}

/** Subscribe to creature look registrations (the sprite registry drops stale cached sets). */
export function onSheetCreature(fn: (ids: string[]) => void): void {
  listeners.push(fn);
}

// ---------------------------------------------------------------------------------------------
// Playback plan
// ---------------------------------------------------------------------------------------------

/** A one-frame animation holding `f` in every facing. */
function still(f: Record<Dir, CreatureFrameRef>): CreatureAnimPlan {
  const dirs = {} as Record<Dir, CreatureFrameRef[]>;
  for (const d of DIRS) dirs[d] = [f[d]];
  return { fps: 1, loop: false, dirs };
}

/**
 * Resolve a look into animations and still Poses. Blocks whose blink has no back-facing row get
 * the idle back frame instead of the front blink the generic resolver would fall back to (an
 * animal walking away should not flash its face).
 */
export function creaturePlan(look: CreatureLook): CreaturePlan {
  const resolved = lookAnims(look);
  const plan = (name: string, as = name): CreatureAnimPlan => {
    const a: ResolvedAnim | undefined = resolved[name];
    if (!a) throw new Error(`Sheet creature block "${look.block}" has no animation "${name}"`);
    const raw = sheetBlock(a.block)?.anims[name]?.dirs;
    const dirs = {} as Record<Dir, CreatureFrameRef[]>;
    for (const d of DIRS) {
      // A blink missing its front / back row holds the idle frame of that facing (sides mirror fine).
      const borrowIdle = name === 'blink' && (d === 'up' || d === 'down') && !raw?.[d]?.length;
      const src = borrowIdle ? resolved.idle : a;
      const refs = borrowIdle ? src.dirs[d].slice(0, 1) : src.dirs[d];
      dirs[d] = refs.map((ref) => ({ block: src.block, ref, anim: as }));
    }
    return { fps: a.fps, loop: a.loop, dirs };
  };
  const frameOf = ([name, i]: CreatureFrame): Record<Dir, CreatureFrameRef> => {
    const a = plan(name);
    const out = {} as Record<Dir, CreatureFrameRef>;
    for (const d of DIRS) out[d] = a.dirs[d][Math.max(0, Math.min(a.dirs[d].length - 1, i))];
    return out;
  };

  const anims: Record<string, CreatureAnimPlan> = {};
  anims.idle = plan(look.idle ?? 'idle', 'idle');
  if (resolved.blink) anims.blink = plan('blink');
  if (resolved.walk) anims.walk = plan('walk');
  else anims.walk = plan(resolved.run ? 'run' : look.idle ?? 'idle', 'walk');
  if (resolved.run) anims.run = plan('run');
  if (resolved.fly) anims.fly = plan('fly');
  // Charging, guarding and raising keep the idle loop going (animals have no stances).
  for (const name of ['charge', 'guard', 'raise']) anims[name] = anims.idle;
  const attack = look.attack === undefined ? anims.idle : typeof look.attack === 'string' ? plan(look.attack) : still(frameOf(look.attack));
  for (const name of ['punch1', 'punch2', 'punch3', 'blast']) anims[name] = attack;
  const hurt = frameOf(look.hurt ?? [resolved.blink ? 'blink' : look.idle ?? 'idle', 0]);
  anims.hurt = still(hurt);
  anims.ko = anims.hurt;

  const first = (a: CreatureAnimPlan, d: Dir) => a.dirs[d][0];
  const at = (a: CreatureAnimPlan, d: Dir, q: number) => a.dirs[d][Math.floor(a.dirs[d].length * q)];
  const stills = {} as Record<Pose, Record<Dir, CreatureFrameRef>>;
  for (const pose of POSES) {
    const dirs = {} as Record<Dir, CreatureFrameRef>;
    for (const d of DIRS) {
      switch (pose) {
        case 'walk1': dirs[d] = at(anims.walk, d, 0.25); break;
        case 'walk2': dirs[d] = at(anims.walk, d, 0.75); break;
        case 'punch1': case 'punch2': case 'kick': case 'blast': dirs[d] = first(attack, d); break;
        case 'hurt': case 'ko': dirs[d] = hurt[d]; break;
        case 'fly': dirs[d] = first(anims.fly ?? anims.idle, d); break;
        default: dirs[d] = first(anims.idle, d);
      }
    }
    stills[pose] = dirs;
  }
  return { anims, stills };
}

// ---------------------------------------------------------------------------------------------
// Pixels and sprite sets
// ---------------------------------------------------------------------------------------------

/** A mark's grid and top-left offset for a facing, mirroring the opposite side when it has none. */
function markFor(m: CreatureMark, dir: Dir): { rows: readonly string[]; ox: number; oy: number } | null {
  const own = m.rows[dir];
  if (own) {
    const off = m.offset[dir] ?? [0, 0];
    return { rows: own, ox: off[0], oy: off[1] };
  }
  const other: Dir | null = dir === 'left' ? 'right' : dir === 'right' ? 'left' : null;
  const src = other ? m.rows[other] : undefined;
  if (!other || !src) return null;
  const w = Math.max(0, ...src.map((r) => r.length));
  const off = m.offset[other] ?? [0, 0];
  // Mirrored about the marker column: x -> -x, so the grid's left edge moves to -(ox + w - 1).
  return { rows: src.map((r) => r.padEnd(w, '.').split('').reverse().join('')), ox: -off[0] - w + 1, oy: off[1] };
}

/** Paint a look's marks into unscaled frame pixels (in place). */
function paintMarks(look: CreatureLook, f: CreatureFrameRef, dir: Dir, px: FramePixels): void {
  const block = sheetBlock(f.block);
  if (!look.marks?.length || !block) return;
  const n = block.size;
  const grid = frameIndices(f.block, f.ref);
  for (const m of look.marks) {
    const g = markFor(m, dir);
    const idx = block.palette.indexOf(m.at.toLowerCase()) + 1;
    if (!g || idx <= 0) continue;
    const at = grid.indexOf(idx);
    if (at < 0) continue;
    const mx = at % n;
    const my = Math.floor(at / n);
    g.rows.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const col = m.palette[row[gx]];
        if (!col) continue;
        const x = mx + g.ox + gx;
        const y = my + g.oy + gy;
        if (x < 0 || y < 0 || x >= px.w || y >= px.h) continue;
        const [r, gg, b] = hexRgb(col);
        px.data.set([r, gg, b, 255], (y * px.w + x) * 4);
      }
    });
  }
}

/**
 * RGBA pixels of one planned frame: the look's recoloured frame with its marks, lifted off the
 * ground, then scaled (nearest neighbour, like framePixels).
 */
export function creatureFramePixels(look: CreatureLook, f: CreatureFrameRef, dir: Dir): FramePixels {
  const k = look.scale ?? 1;
  if (!look.marks?.length && !look.lift) return framePixels(look, f.ref, dir, f.anim, f.block);
  const base = framePixels({ ...look, scale: 1 }, f.ref, dir, f.anim, f.block);
  paintMarks(look, f, dir, base);
  const n = base.w;
  const lift = Math.max(0, Math.round(look.lift ?? 0));
  const w = Math.max(1, Math.round(n * k));
  const data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) {
    const sy = Math.min(n - 1, Math.floor(y / k)) + lift;
    if (sy >= n) continue;
    for (let x = 0; x < w; x++) {
      const s = (sy * n + Math.min(n - 1, Math.floor(x / k))) * 4;
      data.set(base.data.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  return { w, h: w, data };
}

/** Build a creature's full sprite set (every Pose still plus the playback animations) from its look. */
export function buildSheetCreatureSet(look: CreatureLook): SpriteSet {
  const { anims, stills } = creaturePlan(look);
  const cache = new Map<string, FrameSlot>();
  // Frames are pool slots rendered on first use (see FRAME_POOL_CAP in ../sheets).
  const slot = (f: CreatureFrameRef, dir: Dir): FrameSlot => {
    // Overlay and mark grids depend on the facing (and overlays may skip animations); plain looks
    // share one bitmap per frame.
    const key = look.overlay || look.marks ? `${f.block}#${f.ref}|${dir}|${f.anim}` : `${f.block}#${f.ref}`;
    let s = cache.get(key);
    if (!s) {
      s = new FrameSlot(() => creatureFramePixels(look, f, dir));
      cache.set(key, s);
    }
    return s;
  };
  const set = {} as SpriteSet;
  for (const pose of POSES) set[pose] = lazyDirs((d) => slot(stills[pose][d], d));
  const out: Record<string, SpriteAnim> = {};
  const built = new Map<CreatureAnimPlan, SpriteAnim>();
  for (const [name, a] of Object.entries(anims)) {
    let anim = built.get(a);
    if (!anim) {
      const frames = {} as Record<Dir, Bitmap[]>;
      for (const d of DIRS) frames[d] = lazyFrames(a.dirs[d].map((f) => slot(f, d)));
      anim = { frames, fps: a.fps, loop: a.loop };
      built.set(a, anim);
    }
    out[name] = anim;
  }
  setSpriteAnims(set, out);
  return set;
}

// ---------------------------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------------------------

/** A wolf-block tier: fur ramp (5 shades, darkest to lightest) plus optional outline / inner-ear / eye-glint colours. */
function wolfTier(fur: readonly string[], more: { outline?: string; ears?: readonly string[]; eyes?: string } = {}): CreatureLook {
  return {
    block: 'wolf',
    attack: 'pounce',
    parts: {
      fur,
      ...(more.outline ? { outline: [more.outline] } : {}),
      ...(more.ears ? { ears: more.ears } : {}),
      // The eye glint colour also lights the chest fur, so tiers keep it pale.
      ...(more.eyes ? { eyes: [more.eyes] } : {}),
    },
  };
}

/** A hovering bird from the sparrow block: idles, attacks and flinches on the wing (flyer enemies fly at z 10). */
function flyingBird(feathers: readonly string[], beak: readonly string[], scale?: number): CreatureLook {
  return { block: 'bird', idle: 'fly', attack: 'fly', hurt: ['fly', 0], parts: { feathers, beak }, ...(scale ? { scale } : {}) };
}

/** Sabertooth fangs pinned under the cat block's nose pixel: two in front, one in profile. */
const FANGS: CreatureMark = {
  at: '#424242',
  palette: { W: '#ffffff', w: '#d8d4c8' },
  rows: { down: ['W.W', 'w.w'], left: ['W', 'w'] },
  offset: { down: [-1, 1], left: [1, 1] },
};

/** A sabertooth from the ginger-cat block: fur ramp (outline / stripes, mid, light), muzzle and ear colours, eyes. */
function sabertooth(fur: readonly string[], pink: readonly string[], eyes: readonly string[], scale: number): CreatureLook {
  return { block: 'cat', scale, attack: ['walk', 0], parts: { fur, pink, eyes }, marks: [FANGS] };
}

/** Creature ids drawn from LoG2 sheet blocks; every other creature keeps its procedural body. */
export const CREATURE_SHEET_LOOKS: Readonly<Record<string, CreatureLook>> = {
  // Wolves and hounds: LoG2's blue-grey wolf and palette-swapped tiers. Pounce is the bite lunge.
  wolf: { block: 'wolf', attack: 'pounce' },
  timberWolf: wolfTier(['#3c2414', '#6a4428', '#906848', '#b08a64', '#e0c8a0'], { outline: '#2a1a10' }),
  snowWolf: wolfTier(['#5a78a8', '#8ea0c0', '#c4d0e4', '#e0e8f4', '#ffffff']),
  direWolf: wolfTier(['#1c1824', '#3a3048', '#524462', '#6e5e80', '#a094b4'], {
    outline: '#0c0a10', ears: ['#801828', '#c03040', '#a04038'], eyes: '#ff9090',
  }),
  c10_mutantHound: wolfTier(['#2a0c18', '#4a1a30', '#6a2c44', '#8c4c62', '#b47c8c'], {
    outline: '#140810', ears: ['#6a7020', '#a0b030', '#90a038'], eyes: '#f0f090',
  }),
  c13_cragHound: wolfTier(['#3a3028', '#5e5246', '#857868', '#a89a86', '#d0c4ae'], {
    outline: '#241c16', ears: ['#6a3a20', '#a05a30', '#90583a'],
  }),
  fc_scrapHound: wolfTier(['#2a3038', '#4a525c', '#707880', '#9098a0', '#c0c8d0'], {
    outline: '#181c22', ears: ['#a04818', '#d07030', '#c06838'], eyes: '#ff7070',
  }),
  // Bee, Mr. Satan's dog: white, with brown ears.
  ea_dog: { block: 'wolf', parts: { fur: ['#9c9080', '#c4b8a4', '#e4dccc', '#f4f0e6', '#fffaf2'], outline: ['#5a4a3a'], ears: ['#6a4020', '#a8703c', '#c08850'] } },
  // Birds: the sparrow block, scaled up for the bigger species.
  hawk: flyingBird(['#4a2c14', '#7a4a24', '#8e5e30', '#d8b888'], ['#e0a020', '#f8d048'], 1.5),
  c04_critter: flyingBird(['#b04878', '#e07aa8', '#f8a0c8', '#fff0f8'], ['#3098c0', '#60d8f0'], 1.5),
  c04_puffChick: flyingBird(['#c88aa8', '#e8b0cc', '#f8c8e0', '#fffaf8'], ['#e0b020', '#f0d040']),
  fc_puffbird: flyingBird(['#b05890', '#d880b8', '#f0a0d0', '#fff0f8'], ['#e0a820', '#f0d040'], 1.5),
  // The Emerald Kite is a perched Monster Island escapee (an NPC), so it sits and blinks.
  c13_emeraldKite: { block: 'bird', scale: 1.5, parts: { feathers: ['#1c5040', '#2c7860', '#40a080', '#c8f0d8'], beak: ['#e0b020', '#f8d040'] } },
  // The Glow Moth (an NPC) flutters in place above its shadow.
  c13_glowMoth: { block: 'butterfly', idle: 'fly', scale: 2, lift: 8, parts: { wings: ['#c8a830', '#f0e070', '#fcfcd0'], body: ['#3a5a9a', '#60a0f0'] } },
  // Kame House's Turtle is LoG2's own Umigame.
  ea_turtle: { block: 'turtle' },
  // The ruins' mutant rodent: a mangy grey squirrel; it bites at the top of its bound.
  c00_rat: { block: 'squirrel', scale: 1.5, attack: ['walk', 2], parts: { fur: ['#2e3224', '#6a7058', '#a8b090'] } },
  // Sabertooths: the ginger cat at big-cat size with fangs.
  sabertooth: sabertooth(['#583818', '#c07a28', '#e09838'], ['#e0c090', '#f8e0b0'], ['#806000', '#e0b000', '#f0e0b0', '#ffffff'], 2),
  iceSabertooth: sabertooth(['#3a5078', '#7890b8', '#b0c4e4'], ['#e8f0f8', '#ffffff'], ['#205890', '#40a0f0', '#e0f0ff', '#ffffff'], 2),
  c01_fang: sabertooth(['#402010', '#a85a20', '#c87028'], ['#e0b080', '#f0d8a8'], ['#806000', '#f0e040', '#f0e0b0', '#ffffff'], 2.5),
};

registerSheetCreatures(CREATURE_SHEET_LOOKS);
