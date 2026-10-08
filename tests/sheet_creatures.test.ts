import { describe, expect, it } from 'vitest';
import '../src/content';
import { POSES } from '../src/art/humanoid';
import { isSheetCreature, isSheetSprite, sheetCastIds, spriteSet } from '../src/art/registry';
import {
  CREATURE_SHEET_LOOKS, buildSheetCreatureSet, creatureFramePixels, creaturePlan, registerSheetCreatures,
  sheetCreatureIds, sheetCreatureOf, type CreatureLook,
} from '../src/art/sheetcast/creatures';
import { framePixels, sheetBlock, spriteAnims } from '../src/art/sheets';
import { CREATURES } from '../src/content/creatures';
import { DIRS, type Dir } from '../src/engine/math';
import { Actor } from '../src/game/actor';

/** '#rrggbb' of the pixel at index i (RGBA bytes), or null when transparent. */
function hexAt(data: Uint8ClampedArray, i: number): string | null {
  if (!data[i + 3]) return null;
  return `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Every opaque colour of a frame. */
function colours(data: Uint8ClampedArray): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    const c = hexAt(data, i);
    if (c) out.add(c);
  }
  return out;
}

const ids = sheetCreatureIds();

describe('creature looks from the LoG2 animal blocks', () => {
  it('maps the documented creatures onto their blocks', () => {
    const expected: Record<string, string> = {
      wolf: 'wolf', timberWolf: 'wolf', snowWolf: 'wolf', direWolf: 'wolf', c10_mutantHound: 'wolf', c13_cragHound: 'wolf',
      fc_scrapHound: 'wolf', ea_dog: 'wolf', hawk: 'bird', c04_critter: 'bird', c04_puffChick: 'bird', fc_puffbird: 'bird',
      c13_emeraldKite: 'bird', c13_glowMoth: 'butterfly', ea_turtle: 'turtle', c00_rat: 'squirrel', sabertooth: 'cat',
      iceSabertooth: 'cat', c01_fang: 'cat',
    };
    expect(Object.fromEntries(ids.map((id) => [id, sheetCreatureOf(id)?.block]))).toEqual(expected);
  });

  it('only covers real creatures with built blocks, and never registers them as cast', () => {
    const cast = new Set(sheetCastIds());
    for (const id of ids) {
      expect(CREATURES[id], `${id} is not a creature`).toBeTruthy();
      expect(sheetBlock(CREATURE_SHEET_LOOKS[id].block), `${id}: block not built`).toBeTruthy();
      expect(isSheetCreature(id)).toBe(true);
      expect(isSheetSprite(id)).toBe(false);
      expect(cast.has(id)).toBe(false);
    }
  });

  it.each(ids)('%s yields every Pose in every facing plus the playback animations', (id) => {
    const set = spriteSet(id);
    const size = Math.round(32 * (sheetCreatureOf(id)?.scale ?? 1));
    for (const pose of POSES) {
      for (const d of DIRS) {
        expect(set[pose][d], `${id} ${pose} ${d}`).toBeTruthy();
        expect(set[pose][d].width).toBe(size);
        expect(set[pose][d].height).toBe(size);
      }
    }
    const anims = spriteAnims(set);
    for (const name of ['idle', 'walk', 'punch1', 'punch2', 'punch3', 'blast', 'hurt', 'ko', 'charge', 'guard', 'raise']) {
      expect(anims?.[name], `${id} ${name}`).toBeTruthy();
      for (const d of DIRS) expect(anims?.[name].frames[d].length, `${id} ${name} ${d}`).toBeGreaterThan(0);
    }
  });

  it('keeps every unmapped creature on its procedural body', () => {
    const unmapped = Object.keys(CREATURES).filter((id) => !sheetCreatureOf(id));
    expect(unmapped.length).toBeGreaterThan(0);
    for (const id of unmapped) expect(spriteAnims(spriteSet(id)), id).toBeUndefined();
  });

  it('keeps hitboxes and hurtboxes on the creature spec', () => {
    const wolf = new Actor('wolf', 100, 80);
    expect(wolf.creatureSize).toBe(CREATURES.wolf.size);
    expect(wolf.box()).toEqual({ x: 92, y: 72, w: 16, h: 8 });
    const s = CREATURES.wolf.size;
    expect(wolf.body()).toEqual({ x: 100 - s * 0.35, y: 80 - s * 0.7, w: s * 0.7, h: s * 0.7 });
  });
});

describe('creature playback plan', () => {
  it('replaces a blink missing its back row with the idle back frame', () => {
    const plan = creaturePlan(CREATURE_SHEET_LOOKS.wolf);
    expect(sheetBlock('wolf')?.anims.blink.dirs.up).toBeUndefined();
    expect(plan.anims.blink.dirs.up.map((f) => f.ref)).toEqual([plan.anims.idle.dirs.up[0].ref]);
    expect(plan.anims.blink.dirs.down[0].ref).not.toBe(plan.anims.idle.dirs.down[0].ref);
    // Hurt and KO hold the (corrected) blink: eyes shut facing the camera, the plain back view facing away.
    for (const d of DIRS) {
      expect(plan.stills.hurt[d]).toEqual(plan.anims.blink.dirs[d][0]);
      expect(plan.stills.ko[d]).toEqual(plan.anims.blink.dirs[d][0]);
    }
  });

  it('plays the wolf pounce for every attack Pose', () => {
    const plan = creaturePlan(CREATURE_SHEET_LOOKS.timberWolf);
    const pounce = sheetBlock('wolf')?.anims.pounce;
    expect(plan.anims.punch1.dirs.left.map((f) => f.ref)).toEqual(pounce?.dirs.left);
    expect(plan.anims.punch3).toBe(plan.anims.punch1);
    expect(plan.anims.blast).toBe(plan.anims.punch1);
    expect(plan.stills.kick.left).toEqual(plan.anims.punch1.dirs.left[0]);
  });

  it('keeps hovering flyers on the wing: idle, attack and hurt all come from the flight loop', () => {
    const plan = creaturePlan(CREATURE_SHEET_LOOKS.hawk);
    const fly = plan.anims.fly.dirs.down.map((f) => f.ref);
    expect(plan.anims.idle.dirs.down.map((f) => f.ref)).toEqual(fly);
    expect(plan.anims.punch1.dirs.down.map((f) => f.ref)).toEqual(fly);
    expect(fly).toContain(plan.stills.hurt.down.ref);
    // A perched bird (an NPC) sits and blinks instead.
    const perched = creaturePlan(CREATURE_SHEET_LOOKS.c13_emeraldKite);
    expect(perched.anims.idle.dirs.down.map((f) => f.ref)).toEqual(sheetBlock('bird')?.anims.idle.dirs.down);
  });

  it('holds a single frame for frame-style attacks', () => {
    const plan = creaturePlan(CREATURE_SHEET_LOOKS.c00_rat);
    const walk = plan.anims.walk.dirs.left;
    expect(plan.anims.punch1.dirs.left).toEqual([walk[2]]);
    expect(plan.anims.punch1.loop).toBe(false);
  });

  it('rejects looks that name an animation the block lacks', () => {
    expect(() => creaturePlan({ block: 'cat', attack: 'pounce' })).toThrow(/no animation "pounce"/);
  });
});

describe('creature pixels', () => {
  it('recolours tiers through palette parts', () => {
    const plan = creaturePlan(CREATURE_SHEET_LOOKS.timberWolf);
    const native = colours(framePixels({ block: 'wolf' }, plan.anims.idle.dirs.left[0].ref, 'left').data);
    const timber = colours(creatureFramePixels(CREATURE_SHEET_LOOKS.timberWolf, plan.anims.idle.dirs.left[0], 'left').data);
    expect(native.has('#2163ad')).toBe(true);
    expect(timber.has('#2163ad')).toBe(false);
    expect(timber.has('#906848')).toBe(true);
  });

  it('lifts hovering art off the ground row by the scaled lift', () => {
    const look = CREATURE_SHEET_LOOKS.c13_glowMoth;
    const f = creaturePlan(look).anims.idle.dirs.down[0];
    const px = creatureFramePixels(look, f, 'down');
    const k = look.scale ?? 1;
    const lift = (look.lift ?? 0) * k;
    expect(px.w).toBe(32 * k);
    const lowest = (data: Uint8ClampedArray, w: number) => {
      for (let y = w - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) return y;
      return -1;
    };
    const grounded = creatureFramePixels({ ...look, lift: 0 }, f, 'down');
    expect(lowest(grounded.data, grounded.w)).toBe(grounded.w - 1);
    expect(lowest(px.data, px.w)).toBe(px.w - 1 - lift);
  });

  it('pins marks to their marker colour and skips frames without it', () => {
    const look = CREATURE_SHEET_LOOKS.sabertooth;
    const bare: CreatureLook = { ...look, marks: [] };
    const plan = creaturePlan(look);
    const diff = (d: Dir) => {
      const f = plan.stills.idle[d];
      const a = creatureFramePixels(look, f, d).data;
      const b = creatureFramePixels(bare, f, d).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (hexAt(a, i) !== hexAt(b, i)) n++;
      return { n, white: [...colours(a)].includes('#ffffff') };
    };
    expect(diff('down').n).toBeGreaterThan(0);
    expect(diff('left').n).toBeGreaterThan(0);
    expect(diff('right').n).toBe(diff('left').n);
    // The back view has no nose, so no fangs.
    expect(diff('up').n).toBe(0);
  });
});

describe('creature registration and playback', () => {
  it('throws on a duplicate creature id', () => {
    expect(() => registerSheetCreatures({ wolf: { block: 'wolf' } })).toThrow(/Duplicate sheet creature id "wolf"/);
  });

  it('builds a set whose animations hold the same bitmaps as its stills', () => {
    const set = buildSheetCreatureSet(CREATURE_SHEET_LOOKS.wolf);
    const anims = spriteAnims(set);
    expect(anims?.idle.frames.left[0]).toBe(set.idle.left);
    expect(anims?.hurt.frames.down[0]).toBe(set.hurt.down);
    expect(anims?.punch1.frames.right[0]).toBe(set.punch1.right);
  });

  it('plays the pounce while an enemy strikes and holds the flinch while hurt', () => {
    const a = new Actor('direWolf', 0, 0);
    const anims = spriteAnims(a.set);
    if (!anims) throw new Error('direWolf has no animations');
    a.dir = 'left';
    a.pose = 'punch1';
    a.animate();
    expect(anims.punch1.frames.left).toContain(a.frame());
    a.pose = 'hurt';
    a.animate();
    expect(a.frame()).toBe(anims.hurt.frames.left[0]);
    a.pose = 'ko';
    expect(a.frame()).toBe(anims.ko.frames.left[0]);
  });

  it('never flashes a front-facing blink while idling with its back turned', () => {
    const a = new Actor('wolf', 0, 0);
    const anims = spriteAnims(a.set);
    if (!anims) throw new Error('wolf has no animations');
    a.dir = 'up';
    for (let t = 0; t < 600; t++) {
      a.animate();
      expect(a.frame()).toBe(anims.idle.frames.up[0]);
    }
  });
});
