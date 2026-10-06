import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/content/enemies';
import { MAPS, resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { CAST } from '../../src/content/cast';
import { MAIN_ROSTER, type CharId } from '../../src/content/characters';
import {
  BLACK_SEEN, BUU_ASLEEP, EARTH_RESTORED, EA_ASIDES, EA_TALK, MAFUBA_TAUGHT, YAJI_GIFTS, YAJI_HELD, YAJI_MAX_GIFTS, YAJI_QUIT, byStory, reactionFor, satanHome, talkLines,
  type StoryKey, type Talk,
} from '../../src/content/world/earthA/npcs';
import type { Line } from '../../src/ui/dialogue';
import { TILE } from '../../src/engine/constants';
import type { Button } from '../../src/engine/input';
import type { MapDef } from '../../src/game/mapdef';
import { parseGrid } from '../../src/game/world';
import { GameState } from '../../src/game/state';
import { Rng } from '../../src/engine/math';
import { CREATURES } from '../../src/content/creatures';
import { scanRecord } from '../../src/content/scans';
import { clearZone, formStats, mobRatio, type ZoneClear } from '../fairbot';
import { Sim } from '../sim';

/** World builder A: Mt. Paozu, Satan City, Kame House and The Lookout hubs. */
const EARTH_A = [
  'paozu_valley', 'paozu_home', 'paozu_house', 'gohan_house', 'paozu_forest', 'paozu_peaks',
  'satan_plaza', 'satan_mansion', 'satan_mansion_in', 'satan_shop', 'satan_dojo',
  'kame_island', 'kame_house_in', 'kame_reef', 'korin_base', 'korin_tower', 'lookout', 'lookout_palace_in',
];

/** Post-game chapter: chapter overlays are mostly gated off, so traversal tests stay deterministic. */
const QUIET = 15;

function def(id: string): MapDef {
  const m = resolveMap(id);
  if (!m) throw new Error(`missing map ${id}`);
  return m;
}

function setup(sim: Sim, chapter: number, level = 20): void {
  sim.game.state.data.chapter = chapter;
  sim.game.state.join('goku', level);
  sim.game.state.data.active = 'goku';
}

/** True when the player's feet box overlaps something solid. */
function stuck(sim: Sim): boolean {
  const f = sim.game.field;
  if (!f) return true;
  return f.col.blocked(f.player.box());
}

/** Tick until map `id` is showing and faded in. */
async function waitForMap(sim: Sim, id: string, max = 300): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await sim.tick(1);
    const f = sim.game.field;
    if (f?.def.id === id && f.fade === 0) return true;
  }
  return false;
}

/** Run an engine promise (map change, edge exit) while ticking the sim so its fades can progress. */
async function drive(sim: Sim, p: Promise<unknown>, max = 600): Promise<void> {
  let done = false;
  void p.then(() => { done = true; });
  for (let i = 0; i < max && !done; i++) await sim.tick(1);
  expect(done, 'engine transition finished').toBe(true);
  await sim.tick(2);
}

/** Stand on a tile and hold a direction until the map changes (real edge-exit walking). */
async function walkOff(sim: Sim, map: string, x: number, y: number, dir: Button, expectTo: string): Promise<void> {
  sim.start(map, x, y);
  await sim.tick(40);
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  f.player.x = x * TILE + 8;
  f.player.y = y * TILE + 14;
  sim.input.inject(dir, true);
  let ok = false;
  for (let i = 0; i < 400 && !ok; i++) {
    await sim.tick(1);
    ok = sim.game.field?.def.id === expectTo;
  }
  sim.input.inject(dir, false);
  expect(ok, `${map} (${x},${y}) ${dir} -> ${expectTo}`).toBe(true);
  expect(await waitForMap(sim, expectTo)).toBe(true);
  await sim.tick(5);
  expect(stuck(sim), `${map} -> ${expectTo} arrival blocked`).toBe(false);
}

describe('world earthA: every map loads', () => {
  for (const id of EARTH_A) {
    it(`${id} runs 30 frames at chapters 1, 5 and 13`, async () => {
      for (const ch of [1, 5, 13]) {
        const sim = new Sim();
        setup(sim, ch);
        sim.start(id);
        await sim.tick(30);
        expect(sim.errors, `${id} @ch${ch}`).toEqual([]);
        expect(sim.game.field?.def.id).toBe(id);
      }
    });
  }

  it('regions, music and hostility follow the world plan', () => {
    const region: Record<string, string> = {
      paozu_valley: 'Mt. Paozu', paozu_peaks: 'Mt. Paozu', satan_plaza: 'Satan City', satan_dojo: 'Satan City',
      kame_island: 'Kame House', korin_base: 'The Lookout', lookout: 'The Lookout',
    };
    for (const [id, r] of Object.entries(region)) expect(def(id).region, id).toBe(r);
    for (const id of ['paozu_forest', 'paozu_peaks', 'korin_base']) expect(def(id).hostile, id).toBe(true);
    for (const id of ['paozu_valley', 'paozu_home', 'satan_plaza', 'satan_mansion', 'kame_island', 'lookout']) expect(!!def(id).hostile, id).toBe(false);
    expect(def('paozu_valley').music).toBe('peaceful');
    expect(def('paozu_forest').music).toBe('field');
    expect(def('satan_plaza').music).toBe('town');
    expect(def('korin_base').music).toBe('field');
  });
});

describe('world earthA: landing spots', () => {
  it('registers the Guide §8 spots on walkable tiles next to a world sign and save point', async () => {
    const expected: Record<string, [number, number, string]> = {
      spot_paozu: [96, 92, 'paozu_valley'], spot_satancity: [118, 150, 'satan_plaza'],
      spot_kame: [200, 172, 'kame_island'], spot_lookout: [128, 62, 'korin_base'],
    };
    for (const [id, [x, y, map]] of Object.entries(expected)) {
      const s = SPOTS[id];
      expect(s, id).toBeTruthy();
      expect([s.world, s.x, s.y, s.map], id).toEqual(['earth', x, y, map]);
      const sim = new Sim();
      setup(sim, QUIET);
      sim.game.startField(s.map, s.tx, s.ty, 'down');
      await sim.tick(5);
      expect(stuck(sim), `${id} lands blocked`).toBe(false);
      const objs = def(s.map).objects ?? [];
      expect(objs.some((o) => o.type === 'worldSign'), `${id} world sign`).toBe(true);
      expect(objs.some((o) => o.type === 'save'), `${id} save point`).toBe(true);
    }
  });
});

describe('world earthA: traversal', () => {
  it('every door warp delivers the player onto open ground on the right map', async () => {
    for (const id of EARTH_A) {
      for (const w of def(id).warps ?? []) {
        const sim = new Sim();
        setup(sim, QUIET);
        sim.start(id, w.x, w.y + w.h);
        await sim.tick(35);
        const f = sim.game.field;
        if (!f) throw new Error('no field');
        f.player.x = (w.x + w.w / 2) * TILE;
        f.player.y = (w.y + w.h / 2) * TILE + 3;
        expect(await waitForMap(sim, w.to), `${id} warp -> ${w.to}`).toBe(true);
        await sim.tick(5);
        expect(stuck(sim), `${id} warp -> ${w.to} arrival blocked`).toBe(false);
        expect(sim.errors).toEqual([]);
      }
    }
  });

  it('house doors and interior exits pair up', () => {
    const pairs: Array<[string, string]> = [
      ['paozu_valley', 'gohan_house'], ['paozu_home', 'paozu_house'], ['satan_plaza', 'satan_shop'],
      ['satan_mansion', 'satan_mansion_in'], ['satan_mansion', 'satan_dojo'], ['kame_island', 'kame_house_in'],
      ['lookout', 'lookout_palace_in'],
    ];
    for (const [out, inside] of pairs) {
      const door = (def(out).warps ?? []).find((w) => w.to === inside);
      const back = (def(inside).warps ?? []).find((w) => w.to === out);
      expect(door, `${out} -> ${inside}`).toBeTruthy();
      expect(back, `${inside} -> ${out}`).toBeTruthy();
      if (!door || !back) continue;
      // Leaving the interior lands one tile below the outside door.
      expect(back.tx).toBeGreaterThanOrEqual(door.x);
      expect(back.tx).toBeLessThan(door.x + door.w);
      expect(back.ty).toBe(door.y + door.h);
    }
  });

  it('walks the Mt. Paozu edge chain valley <-> home <-> forest <-> peaks', async () => {
    await walkOff(new Sim(), 'paozu_valley', 0, 14, 'left', 'paozu_home');
    await walkOff(new Sim(), 'paozu_home', 43, 15, 'right', 'paozu_valley');
    await walkOff(new Sim(), 'paozu_home', 0, 14, 'left', 'paozu_forest');
    await walkOff(new Sim(), 'paozu_forest', 45, 15, 'right', 'paozu_home');
    await walkOff(new Sim(), 'paozu_forest', 21, 0, 'up', 'paozu_peaks');
    await walkOff(new Sim(), 'paozu_peaks', 19, 33, 'down', 'paozu_forest');
  });

  it('walks Satan City plaza <-> mansion', async () => {
    await walkOff(new Sim(), 'satan_plaza', 23, 0, 'up', 'satan_mansion');
    await walkOff(new Sim(), 'satan_mansion', 19, 29, 'down', 'satan_plaza');
  });

  it('chains the whole Mt. Paozu region with edgeExit/changeMap', async () => {
    const sim = new Sim();
    setup(sim, QUIET);
    sim.start('paozu_valley', 30, 9);
    await sim.tick(5);
    const hop = async (side: 'north' | 'south' | 'east' | 'west', px: number, py: number, to: string) => {
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      const ex = f.def.exits?.[side];
      expect(ex?.to, `${f.def.id} ${side}`).toBe(to);
      await drive(sim, sim.game.edgeExit(side, to, ex?.offset ?? 0, px + 0.5, py + 0.875));
      expect(sim.game.field?.def.id).toBe(to);
      expect(stuck(sim), `arrive ${to}`).toBe(false);
    };
    await hop('west', 0, 14, 'paozu_home');
    await drive(sim, sim.game.changeMap('paozu_house', 6, 10, 'up'));
    expect(sim.game.field?.def.id).toBe('paozu_house');
    await drive(sim, sim.game.changeMap('paozu_home', 19, 7, 'down'));
    await hop('west', 0, 15, 'paozu_forest');
    await hop('north', 22, 0, 'paozu_peaks');
    await hop('south', 20, 33, 'paozu_forest');
    await hop('east', 45, 14, 'paozu_home');
    await hop('east', 43, 13, 'paozu_valley');
    await drive(sim, sim.game.changeMap('gohan_house', 8, 10, 'up'));
    expect(sim.game.field?.def.id).toBe('gohan_house');
    expect(sim.errors).toEqual([]);
  });

  it('every flight circle flies to open ground', async () => {
    for (const id of EARTH_A) {
      for (const o of def(id).objects ?? []) {
        if (o.type !== 'flight') continue;
        const sim = new Sim();
        setup(sim, QUIET);
        sim.start(id, o.x, o.y);
        await sim.tick(35);
        const f = sim.game.field;
        if (!f) throw new Error('no field');
        f.player.x = o.x * TILE + 8;
        f.player.y = o.y * TILE + 12;
        expect(f.tryInteract(), `${id} flight at ${o.x},${o.y}`).toBe(true);
        let arrived = false;
        for (let i = 0; i < 300 && !arrived; i++) {
          await sim.tick(1);
          const nf = sim.game.field;
          arrived = !!nf && nf !== f && nf.def.id === o.to && nf.fade === 0 && sim.game.lockDepth === 0;
        }
        expect(arrived, `${id} flight -> ${o.to}`).toBe(true);
        expect(stuck(sim), `${id} flight -> ${o.to} lands blocked`).toBe(false);
      }
    }
  });

  it('climbs Korin Forest -> Korin Tower -> The Lookout by flight circles', () => {
    const fl = (id: string) => (def(id).objects ?? []).filter((o) => o.type === 'flight').map((o) => (o as { to: string }).to);
    expect(fl('korin_base')).toContain('korin_tower');
    expect(fl('korin_tower')).toEqual(expect.arrayContaining(['korin_base', 'lookout']));
    expect(fl('lookout')).toContain('korin_tower');
  });
});

describe('world earthA: ambient NPCs and examine triggers', () => {
  const talkers: Array<[string, string]> = [];
  const examines: Array<[string, string]> = [];
  for (const id of EARTH_A) {
    for (const n of def(id).npcs ?? []) if (n.id.startsWith('ea_')) talkers.push([id, n.id]);
    for (const t of def(id).triggers ?? []) if (t.script.startsWith('ea_')) examines.push([id, t.script]);
  }

  it('places 6-12 townsfolk in Satan City and keeps the Son family off the hub maps', () => {
    const city = talkers.filter(([m]) => m === 'satan_plaza').length;
    expect(city).toBeGreaterThanOrEqual(6);
    expect(city).toBeLessThanOrEqual(12);
    const family = ['chichi', 'goten', 'gohan', 'videl', 'pan'];
    // Only the world builder's own (ea_) NPCs are checked; chapters overlay the family as story NPCs.
    for (const id of EARTH_A) for (const n of (def(id).npcs ?? []).filter((x) => x.id.startsWith('ea_'))) expect(family, `${id}/${n.id}`).not.toContain(n.sprite);
  });

  for (const ch of [1, 5, 13]) {
    it(`every ambient talk script runs cleanly at chapter ${ch}`, async () => {
      for (const [map, npcId] of talkers) {
        const sim = new Sim();
        setup(sim, ch);
        sim.start(map);
        await sim.tick(5);
        const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
        expect(npc, `${map}/${npcId} present`).toBeTruthy();
        const ok = await sim.run(npc?.def.talk ?? '', npc ? { npc } : {});
        expect(ok, `${map}/${npcId} finished`).toBe(true);
        expect(sim.errors, `${map}/${npcId}`).toEqual([]);
      }
    });
  }

  it('every examine trigger runs cleanly', async () => {
    for (const [map, script] of examines) {
      const sim = new Sim();
      setup(sim, 12);
      sim.start(map);
      await sim.tick(5);
      expect(await sim.run(script), `${map}/${script}`).toBe(true);
      expect(sim.errors, `${map}/${script}`).toEqual([]);
    }
  });

  it('Korin trades three fish for a Senzu Bean', async () => {
    const sim = new Sim();
    setup(sim, 4);
    sim.game.state.set('ea_korinMet');
    sim.game.giveQuiet('fish', 3);
    sim.start('korin_tower');
    await sim.tick(5);
    const npc = sim.game.field?.npcs.find((n) => n.def.id === 'ea_kt_korin');
    expect(await sim.run('ea_kt_korin', npc ? { npc } : {})).toBe(true);
    expect(sim.game.state.count('fish')).toBe(0);
    expect(sim.game.state.count('senzu')).toBe(1);
    expect(sim.errors).toEqual([]);
  });

  /** Talk to the Korin Forest Yajirobe once at `chapter`. */
  async function talkYajirobe(sim: Sim, chapter: number): Promise<void> {
    sim.game.state.data.chapter = chapter;
    const npc = sim.game.field?.npcs.find((n) => n.def.id === 'ea_kb_yajirobe');
    expect(npc, 'Yajirobe present').toBeTruthy();
    expect(await sim.run('ea_kb_yajirobe', npc ? { npc } : {})).toBe(true);
  }

  it('Yajirobe gives one free Senzu per chapter at his first three meetings, then quits (LoG2 §9.3)', async () => {
    const sim = new Sim();
    setup(sim, 4);
    sim.start('korin_base');
    await sim.tick(5);
    const st = sim.game.state;
    // Meeting 1: a bean. Talking again in the same chapter gives nothing more.
    await talkYajirobe(sim, 4);
    expect(st.count('senzu')).toBe(1);
    await talkYajirobe(sim, 4);
    await talkYajirobe(sim, 4);
    expect(st.count('senzu')).toBe(1);
    // Meetings 2 and 3 in later chapters.
    await talkYajirobe(sim, 5);
    expect(st.count('senzu')).toBe(2);
    await talkYajirobe(sim, 5);
    expect(st.count('senzu')).toBe(2);
    await talkYajirobe(sim, 7);
    expect(st.count('senzu')).toBe(3);
    expect(st.get(YAJI_GIFTS)).toBe(YAJI_MAX_GIFTS);
    // Meeting 4: he quits and sends you to Korin. No beans ever again.
    st.take('senzu', 3);
    await talkYajirobe(sim, 8);
    expect(st.flag(YAJI_QUIT)).toBe(true);
    for (const ch of [8, 9, 12, 15]) await talkYajirobe(sim, ch);
    expect(st.count('senzu')).toBe(0);
    expect(sim.errors).toEqual([]);
  });

  it('Yajirobe holds his gift while the Senzu pouch is full instead of wasting it', async () => {
    const sim = new Sim();
    setup(sim, 4);
    sim.game.giveQuiet('senzu', 3);
    sim.start('korin_base');
    await sim.tick(5);
    const st = sim.game.state;
    await talkYajirobe(sim, 4);
    expect(st.count('senzu')).toBe(3);
    expect(st.flag(YAJI_HELD)).toBe(true);
    expect(st.get(YAJI_GIFTS) ?? 0).toBe(0);
    // Eat one, come back the same chapter: the held bean is handed over.
    st.take('senzu', 1);
    await talkYajirobe(sim, 4);
    expect(st.count('senzu')).toBe(3);
    expect(st.flag(YAJI_HELD)).toBe(false);
    expect(st.get(YAJI_GIFTS)).toBe(1);
    // Still only one gift per chapter.
    st.take('senzu', 1);
    await talkYajirobe(sim, 4);
    expect(st.count('senzu')).toBe(2);
    expect(sim.errors).toEqual([]);
  });

  it('Yajirobe is away during the Chapter 3 hunt and gives his first bean once he is back', async () => {
    const sim = new Sim();
    setup(sim, 3);
    sim.game.state.set('ea_yajirobeAway');
    sim.start('korin_base');
    await sim.tick(5);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'ea_kb_yajirobe'), 'hidden while away').toBe(false);
    sim.game.state.clear('ea_yajirobeAway');
    await drive(sim, sim.game.changeMap('korin_base', 20, 28, 'up'));
    await talkYajirobe(sim, 3);
    expect(sim.game.state.count('senzu')).toBe(1);
    expect(sim.errors).toEqual([]);
  });

  it('one-time gifts are only given once (angler fish, shop sample, Bee)', async () => {
    const sim = new Sim();
    setup(sim, 2);
    sim.start('paozu_valley');
    await sim.tick(5);
    await sim.run('ea_pv_fisher');
    await sim.run('ea_pv_fisher');
    expect(sim.game.state.count('fish')).toBe(1);
    await drive(sim, sim.game.changeMap('satan_shop', 6, 8, 'up'));
    await sim.run('ea_sh_clerk');
    await sim.run('ea_sh_clerk');
    expect(sim.game.state.count('cookie')).toBe(2);
    await drive(sim, sim.game.changeMap('satan_mansion_in', 9, 12, 'up'));
    for (let i = 0; i < 5; i++) await sim.run('ea_smi_bee');
    expect(sim.game.state.count('cookie')).toBe(5);
    expect(sim.errors).toEqual([]);
  });
});

describe('world earthA: collectibles and gates', () => {
  it('places exactly 9 Earth Delicacies (Paozu 3, Satan City 3, Kame 1, Lookout 2) with del_ ids', () => {
    const found: Array<[string, string]> = [];
    for (const id of EARTH_A) {
      const m = def(id);
      for (const p of m.pickups ?? []) if (p.item === 'delicacy') found.push([id, p.id]);
      for (const o of m.objects ?? []) {
        if (o.type === 'chest' && o.item === 'delicacy') found.push([id, o.id]);
        if (o.type === 'breakable' && o.item === 'delicacy') found.push([id, o.id ?? '']);
      }
    }
    expect(found.length).toBe(9);
    for (const [map, pid] of found) expect(pid, map).toMatch(new RegExp(`^del_${map}_\\d+$`));
    expect(new Set(found.map(([, p]) => p)).size).toBe(9);
    const region = (m: string) => def(m).region;
    const per = (r: string) => found.filter(([m]) => region(m) === r).length;
    expect(per('Mt. Paozu')).toBe(3);
    expect(per('Satan City')).toBe(3);
    expect(per('Kame House')).toBe(1);
    expect(per('The Lookout')).toBe(2);
  });

  it('reserves the Gohan L50 trophy gate and the Mr. Satan L50 ZTV gate', () => {
    const peaks = def('paozu_peaks');
    const g50 = peaks.barriers?.find((b) => b.id === 'g50_gohan');
    expect(g50).toMatchObject({ character: 'gohan', level: 50 });
    const trophy = peaks.objects?.find((o) => o.type === 'chest' && o.id === 'trophy_gohan');
    expect(trophy).toMatchObject({ item: 'trophyGohan' });
    const g15 = peaks.barriers?.find((b) => b.character === 'goku');
    expect(g15?.level).toBe(15);

    const ztv = def('satan_plaza').barriers?.find((b) => b.id === 'ztv_gate');
    expect(ztv).toMatchObject({ character: 'satan', level: 50, x: 7, y: 10, w: 3, h: 1 });
  });

  it('the 3x3 ZTV ending space behind the gate is open ground only reachable through the gate', async () => {
    const sim = new Sim();
    setup(sim, QUIET);
    sim.start('satan_plaza', 8, 8);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    for (let y = 7; y <= 9; y++) {
      for (let x = 7; x <= 9; x++) {
        expect(f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 }), `ztv space ${x},${y}`).toBe(false);
      }
    }
    // The gate seals the courtyard while it stands.
    expect(f.col.blocked({ x: 8 * TILE + 3, y: 10 * TILE + 8, w: 10, h: 6 })).toBe(true);
  });

  it('opens the Goku L15 gate with the right hero and reaches the +3 capsule chest', async () => {
    const sim = new Sim();
    setup(sim, QUIET, 15);
    sim.start('paozu_peaks', 29, 25);
    await sim.tick(5);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const gate = f.map.gates.find((g) => g.def.id === 'g15');
    expect(gate?.broken).toBe(false);
    if (gate) f.map.openGate(gate);
    expect(f.col.blocked({ x: 31 * TILE + 3, y: 25 * TILE + 8, w: 10, h: 6 })).toBe(false);
    const chest = (def('paozu_peaks').objects ?? []).find((o) => o.type === 'chest' && o.id === 'ea_peaks_pow3');
    expect(chest).toMatchObject({ item: 'pow3' });
  });
});

describe('world earthA: river and reef wildlife (LoG2 Fish for Korin\'s Senzu)', () => {
  /** Tiles reachable on foot from every way into map `id` (edge exits, door/flight arrivals, landing spots). */
  async function openGround(id: string, gatesOpen: boolean): Promise<Set<string>> {
    const m = def(id);
    const sim = new Sim();
    setup(sim, QUIET);
    if (gatesOpen) for (const b of m.barriers ?? []) sim.game.state.set(`gate:${id}:${b.id}`);
    sim.start(id);
    await sim.tick(2);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const grid = parseGrid(m);
    const W = grid[0].length;
    const H = grid.length;
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 });
    const seeds: Array<[number, number]> = [];
    for (const [side, ex] of Object.entries(m.exits ?? {})) {
      if (!ex) continue;
      for (let i = 0; i < (side === 'north' || side === 'south' ? W : H); i++) {
        if (side === 'north') seeds.push([i, 0]);
        if (side === 'south') seeds.push([i, H - 1]);
        if (side === 'west') seeds.push([0, i]);
        if (side === 'east') seeds.push([W - 1, i]);
      }
    }
    for (const other of Object.keys(MAPS)) for (const w of resolveMap(other)?.warps ?? []) if (w.to === id) seeds.push([Math.floor(w.tx), Math.floor(w.ty)]);
    for (const s of Object.values(SPOTS)) if (s.map === id) seeds.push([s.tx, s.ty]);
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [];
    const visit = (x: number, y: number) => {
      if (seen.has(`${x},${y}`) || !free(x, y)) return;
      seen.add(`${x},${y}`);
      queue.push([x, y]);
    };
    for (const [x, y] of seeds) visit(x, y);
    const flights = (m.objects ?? []).flatMap((o) => (o.type === 'flight' && o.to === id ? [o] : []));
    while (queue.length) {
      const [x, y] = queue.shift() as [number, number];
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
      for (const o of flights) if (Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) visit(Math.floor(o.tx), Math.floor(o.ty));
    }
    return seen;
  }

  it('Turtle Reef is a hostile Kame House area reached along the island\'s east sandbar', async () => {
    expect(def('kame_reef')).toMatchObject({ region: 'Kame House', hostile: true });
    expect(def('kame_reef').music, 'one theme for the whole Kame House region').toBe(def('kame_island').music);
    expect(def('kame_island').exits?.east?.to).toBe('kame_reef');
    expect(def('kame_reef').exits?.west?.to).toBe('kame_island');
    expect(!!def('kame_island').hostile).toBe(false);
    await walkOff(new Sim(), 'kame_island', 39, 12, 'right', 'kame_reef');
    await walkOff(new Sim(), 'kame_reef', 0, 13, 'left', 'kame_island');
  });

  it('puts Fish-carrying shore wildlife (crabs, vipers, king crabs) next to the water on every Earth A hostile map', () => {
    for (const t of ['crab', 'viper', 'kingCrab']) expect(ENEMIES[t].drops, t).toBe('water');
    const want: Record<string, number> = { paozu_forest: 2, paozu_peaks: 2, korin_base: 4, kame_reef: 10 };
    for (const [id, min] of Object.entries(want)) {
      const m = def(id);
      const grid = parseGrid(m);
      const shore = (m.enemies ?? []).filter((e) => ENEMIES[e.type]?.drops === 'water' && !e.showIf);
      expect(shore.length, id).toBeGreaterThanOrEqual(min);
      for (const e of shore) {
        let wet = false;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) wet ||= ['water', 'deep'].includes(grid[e.y + dy]?.[e.x + dx] ?? '');
        expect(wet, `${id}: ${e.type} at ${e.x},${e.y} lives by the water`).toBe(true);
      }
    }
  });

  it('a water creature drops a Fish about 4% of the time; dry-land wildlife never does', async () => {
    const sim = new Sim();
    setup(sim, 4, 12);
    sim.start('kame_reef', 2, 12);
    await sim.tick(2);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const fishFrom = (type: string, kills: number): number => {
      let fish = 0;
      for (let i = 0; i < kills; i++) {
        const before = f.pickups.length;
        const e = f.spawnEnemy(type, f.player.x + 160, f.player.y);
        for (let h = 0; h < 10 && !e.dead && e.state !== 'dying'; h++) f.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
        fish += f.pickups.slice(before).filter((p) => p.kind === 'fish').length;
      }
      return fish;
    };
    // 4% of 400 kills is 16 on average: the window is wide enough for any seed, narrow enough to catch 0% or 15%.
    for (const t of ['crab', 'viper', 'kingCrab']) {
      const n = fishFrom(t, 400);
      expect(n, t).toBeGreaterThanOrEqual(5);
      expect(n, t).toBeLessThanOrEqual(32);
    }
    for (const t of ['wolf', 'snake', 'hawk', 'bear', 'beetle']) expect(fishFrom(t, 200), t).toBe(0);
    expect(sim.errors).toEqual([]);
  });

  it('end to end: hunt the Korin Forest river until three Fish drop, fly up the tower and trade them for a Senzu Bean', async () => {
    const sim = new Sim();
    setup(sim, 4, 14);
    const st = sim.game.state;
    // A fixed save seed makes the field's drop rolls reproducible (a fresh save seeds from Math.random).
    st.data.seed = 0x4b0b1f15;
    let kills = 0;
    for (let visit = 0; visit < 200 && st.count('fish') < 3; visit++) {
      // Every visit respawns the wildlife (LoG2 §5.8).
      sim.start('korin_base', 20, 28);
      await sim.tick(2);
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      for (const e of f.enemies) {
        if (e.def.drops !== 'water' || e.dead) continue;
        for (let h = 0; h < 10 && !e.dead && e.state !== 'dying'; h++) f.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
        kills++;
      }
      // Walk onto every Fish that dropped (the bot keeps the hero alive and swats the rest of the wildlife).
      sim.game.allowControl = true;
      for (const pk of f.pickups.filter((p) => p.kind === 'fish')) {
        for (let i = 0; i < 60 && st.count('fish') < 3 && f.pickups.includes(pk); i++) {
          f.player.x = pk.x;
          f.player.y = pk.y + 2;
          await sim.tick(1);
        }
      }
      sim.game.allowControl = false;
    }
    expect(st.count('fish')).toBe(3);
    // Fish only come from the river's crabs and vipers, at LoG2's rare rate: it takes a real hunt.
    expect(kills).toBeGreaterThanOrEqual(12);

    // Fly up Korin Tower from the circle at its foot.
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const circle = (def('korin_base').objects ?? []).find((o) => o.type === 'flight' && o.to === 'korin_tower');
    if (!circle) throw new Error('no tower circle');
    await sim.tick(35);
    f.player.x = circle.x * TILE + 8;
    f.player.y = circle.y * TILE + 12;
    expect(f.tryInteract()).toBe(true);
    expect(await waitForMap(sim, 'korin_tower')).toBe(true);
    await sim.tick(10);

    const korin = sim.game.field?.npcs.find((n) => n.def.id === 'ea_kt_korin');
    expect(korin, 'Korin at the top').toBeTruthy();
    sim.choice = 0;
    expect(await sim.run('ea_kt_korin', korin ? { npc: korin } : {})).toBe(true);
    expect(st.count('fish')).toBe(0);
    expect(st.count('senzu')).toBe(1);
    expect(sim.errors).toEqual([]);
  });

  it('every hostile Earth A map shelters its wildlife on open ground', async () => {
    for (const id of ['paozu_forest', 'paozu_peaks', 'korin_base', 'kame_reef']) {
      const sim = new Sim();
      setup(sim, QUIET);
      sim.start(id);
      await sim.tick(1);
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      for (const e of def(id).enemies ?? []) {
        expect(f.col.blocked({ x: e.x * TILE + 3, y: e.y * TILE + 8, w: 10, h: 6 }), `${id}: ${e.type} spawns inside a wall at ${e.x},${e.y}`).toBe(false);
      }
    }
  });

  it('the reef\'s outer atoll, its king crabs and the Kame House Delicacy sit behind the Gohan L25 gate', async () => {
    const reef = def('kame_reef');
    expect(reef.barriers?.find((b) => b.id === 'ea_g25_gohan')).toMatchObject({ character: 'gohan', level: 25 });
    const closed = await openGround('kame_reef', false);
    const open = await openGround('kame_reef', true);
    const del = reef.pickups?.find((p) => p.item === 'delicacy');
    expect(del?.id).toBe('del_kame_reef_1');
    if (!del) return;
    expect(closed.has(`${del.x},${del.y}`), 'Delicacy sealed off').toBe(false);
    expect(open.has(`${del.x},${del.y}`), 'Delicacy reachable through the gate').toBe(true);
    // The inner flats (crabs, vipers, tide slimes) are open from the sandbar; the atoll's residents are not.
    for (const e of reef.enemies ?? []) {
      const atoll = e.x > 22;
      expect(closed.has(`${e.x},${e.y}`), `${e.type} at ${e.x},${e.y}`).toBe(!atoll);
      expect(open.has(`${e.x},${e.y}`), `${e.type} at ${e.x},${e.y}`).toBe(true);
    }
    expect((reef.enemies ?? []).filter((e) => e.x > 22).map((e) => e.type).sort())
      .toEqual(['kingCrab', 'kingCrab', 'kingCrab', 'mudSlime', 'mudSlime', 'pterodactyl']);
    expect((reef.enemies ?? []).filter((e) => e.x <= 22).map((e) => e.type).sort())
      .toEqual(['crab', 'crab', 'crab', 'crab', 'crab', 'ea_tideSlime', 'ea_tideSlime', 'viper', 'viper']);
    // The open flats are the region's Fish ground (LoG2's Tropical Islands): seven carriers, about one Fish every
    // four visits at the 4% roll, the best yield on Earth before the gate.
    const flats = (reef.enemies ?? []).filter((e) => e.x <= 22 && ENEMIES[e.type]?.drops === 'water');
    expect(flats.length).toBe(7);
    for (const id of ['paozu_forest', 'paozu_peaks', 'korin_base']) {
      expect((def(id).enemies ?? []).filter((e) => ENEMIES[e.type]?.drops === 'water').length, id).toBeLessThan(flats.length);
    }
  });

  it('Gohan at level 25 breaks the reef gate; nobody else does', async () => {
    const tryGate = async (who: 'gohan' | 'goku', level: number): Promise<boolean> => {
      const sim = new Sim();
      sim.game.state.data.chapter = 7;
      sim.game.state.join(who, level);
      sim.game.state.data.active = who;
      sim.start('kame_reef', 21, 12);
      await sim.tick(2);
      const f = sim.game.field;
      const gate = f?.map.gates.find((g) => g.def.id === 'ea_g25_gohan');
      if (!f || !gate) throw new Error('no gate');
      f.meleeHit(gate.rect, 10, 1);
      return gate.broken;
    };
    expect(await tryGate('gohan', 24)).toBe(false);
    expect(await tryGate('goku', 50)).toBe(false);
    expect(await tryGate('gohan', 25)).toBe(true);
  });
});

describe('world earthA: townsfolk react to the character you play and to the story (LoG2 CurChar branches)', () => {
  /** Every main character plus the two Tournament of Power guests. */
  const HEROES: CharId[] = [...MAIN_ROSTER, 'android17', 'frieza'];

  /** Every Earth A townsperson as [map, NPC id] (each NPC's talk script carries its id). */
  const TOWNSFOLK: Array<[string, string]> = [];
  /** Every Earth A examine trigger as [map, script]. */
  const EXAMINES: Array<[string, string]> = [];
  for (const id of EARTH_A) {
    for (const n of def(id).npcs ?? []) if (n.id.startsWith('ea_')) TOWNSFOLK.push([id, n.id]);
    for (const t of def(id).triggers ?? []) if (t.script.startsWith('ea_') && !EXAMINES.some(([, s]) => s === t.script)) EXAMINES.push([id, t.script]);
  }

  /**
   * One playthrough as the story flags record it: [chapter, flags set, flags cleared], applied in order. Only
   * moments where the player can walk the hubs are listed. The mid-chapter moments are the beats the townsfolk talk
   * about: the birthday cruise, the Champion Orb, the Earth blowing up, Buu's trip and hibernation, the tournament
   * departure and the post-game press conference. A flag set in a chapter's last scene is first walked around in the
   * next chapter (c02_rage → c03_start, c03_beerusDone → c04_start, c11_farewell → c12_start, c14_won →
   * post_start), and c06_earthGone never outlives its cutscene: the victory party after it only sees c06_won.
   * A `done:` entry finishes that journal quest (Chapter 11's Mafuba lesson).
   */
  const TIMELINE: Array<[number, string[], string[]?]> = [
    [0, []], [1, []], [1, ['c01_metSatan']],
    [2, []], [2, ['c02_boarded', 'ea_buuAway']],
    [3, ['c02_rage'], ['ea_buuAway']], [3, ['c03_satanDone']],
    [4, ['c03_beerusDone']], [5, []], [6, []], [6, ['c06_round2', 'c06_won']],
    [7, []], [7, ['c07_champaDone', 'ea_buuAway', 'c07_hidBuu']], [8, [], ['ea_buuAway', 'c07_hidBuu']],
    [9, []], [9, ['c09_hopeCrashed']], [9, [BLACK_SEEN]], [10, []], [11, []], [11, [MAFUBA_TAUGHT]],
    [12, ['c11_farewell']], [12, ['c12_hitDone']], [12, ['c12_filmDone', 'c12_herbGot']],
    [13, []], [13, ['c13_expoSeen']], [13, [BUU_ASLEEP]],
    [14, []], [14, ['c14_departed']],
    [15, ['c14_won', 'post_game']], [15, ['post_ztvSeen']],
  ];
  const POST = TIMELINE.length - 1;

  type State = Sim['game']['state'];

  /** Apply timeline moment `i` on top of the moments before it. */
  function step(st: State, i: number): void {
    const [ch, set, clear] = TIMELINE[i];
    st.data.chapter = ch;
    for (const f of set) {
      if (f.startsWith('done:')) st.data.journal[f.slice(5)] = 'done';
      else st.set(f);
    }
    for (const f of clear ?? []) st.clear(f);
  }

  /** Index of the first moment in `chapter` (with `flag` among the flags it sets, when given). */
  function moment(chapter: number, flag?: string): number {
    const i = TIMELINE.findIndex(([c, set]) => c === chapter && (flag ? set.includes(flag) : true));
    if (i < 0) throw new Error(`no moment ch${chapter} ${flag ?? ''}`);
    return i;
  }

  const label = (i: number) => `ch${TIMELINE[i][0]}${TIMELINE[i][1].length ? `+${TIMELINE[i][1].join('+')}` : ''}`;

  /** A fresh save at timeline moment `i`, playing as `hero`. */
  function playAs(hero: CharId, i: number): Sim {
    const sim = new Sim();
    sim.game.state.join(hero, 30);
    sim.game.state.data.active = hero;
    for (let k = 0; k <= i; k++) step(sim.game.state, k);
    return sim;
  }

  /** Record every dialogue line the game shows as "Name: text" (narration has no name). */
  function listen(sim: Sim): string[] {
    const out: string[] = [];
    const orig = sim.game.say.bind(sim.game);
    sim.game.say = (lines: Line[]) => {
      for (const l of lines) out.push(`${l.name ?? ''}: ${l.text}`);
      return orig(lines);
    };
    return out;
  }

  async function talkTo(sim: Sim, npcId: string): Promise<void> {
    const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
    expect(npc, `${npcId} on ${sim.game.field?.def.id}`).toBeTruthy();
    if (npc) expect(await sim.run(npc.def.talk, { npc }), npcId).toBe(true);
  }

  /** Every Talk an NPC table holds: each reaction (every story step) and each chatter line (every rotation). */
  function talks(id: string): Talk[] {
    const t = EA_TALK[id];
    const out: Talk[] = [];
    for (const r of Object.values(t.heroes)) {
      if (!r) continue;
      if (typeof r === 'object' && !Array.isArray(r)) out.push(...r.story.map(([, v]) => v));
      else out.push(r);
    }
    for (const [, c] of t.story) {
      if (typeof c === 'object' && !Array.isArray(c)) out.push(...c.cycle);
      else out.push(c);
    }
    return out;
  }

  it('every townsperson has a reaction to each of the six main characters', () => {
    expect(TOWNSFOLK.length).toBeGreaterThanOrEqual(29);
    for (const [map, id] of TOWNSFOLK) {
      const t = EA_TALK[id];
      expect(t, `${map}/${id} has no dialogue table`).toBeTruthy();
      for (const hero of MAIN_ROSTER) expect(t?.heroes[hero], `${id} has no reaction to ${hero}`).toBeTruthy();
    }
    // Every table belongs to a townsperson, or to the mansion staircase (Mr. Satan's voice from upstairs).
    const ids = new Set(TOWNSFOLK.map(([, id]) => id));
    for (const id of Object.keys(EA_TALK)) expect(ids.has(id) || id === 'ea_smi_stairs', `${id} is not an Earth A NPC`).toBe(true);
    expect(Object.keys(EA_TALK[`ea_smi_stairs`].heroes)).toEqual(expect.arrayContaining([...MAIN_ROSTER]));
    // The guests get reactions where they would make the biggest impression.
    for (const id of ['ea_sc_police', 'ea_sc_reporter', 'ea_smi_buu', 'ea_kt_korin', 'ea_lk_popo', 'ea_kb_yajirobe']) {
      expect(EA_TALK[id].heroes.frieza, `${id} vs Frieza`).toBeTruthy();
      expect(EA_TALK[id].heroes.android17, `${id} vs 17`).toBeTruthy();
    }
  });

  /**
   * Who can walk the hubs at a story moment: the party timeline's joins (Vegeta Ch2, Gohan and Piccolo Ch5, Trunks
   * Ch9) and Mr. Satan from the post-game. The two guests never free-roam (only the ?char= dev entry plays them).
   */
  const PLAYABLE: Partial<Record<CharId, (st: State) => boolean>> = {
    goku: (st) => st.check('chapter>=1'), vegeta: (st) => st.check('chapter>=2'), gohan: (st) => st.check('chapter>=5'),
    piccolo: (st) => st.check('chapter>=5'), trunks: (st) => st.check('chapter>=9'), satan: (st) => st.check('post_game'),
  };

  it('chatter and reactions resolve at every moment of a playthrough, and every story step is reached', () => {
    expect(new Set(TIMELINE.map(([c]) => c)).size).toBe(16);
    const st = new Sim().game.state;
    const reached = new Map<string, Set<number>>();
    const mark = (key: string, n: number) => {
      const set = reached.get(key) ?? new Set<number>();
      set.add(n);
      reached.set(key, set);
    };
    for (let i = 0; i < TIMELINE.length; i++) {
      step(st, i);
      for (const [id, t] of Object.entries(EA_TALK)) {
        const pick = byStory(st, t.story);
        expect(pick, `${id} @${label(i)}`).toBeTruthy();
        // Mr. Satan's voice from upstairs is only heard while he is home (the staircase stays silent otherwise).
        if (id !== 'ea_smi_stairs' || satanHome({ check: (c) => st.check(c), hero: 'goku' })) mark(id, t.story.findIndex(([, v]) => v === pick));
        for (const hero of HEROES) {
          const r = reactionFor({ check: (c) => st.check(c), hero }, id);
          if ((MAIN_ROSTER as readonly CharId[]).includes(hero)) expect(r, `${id} -> ${hero} @${label(i)}`).toBeTruthy();
          if (!r) continue;
          expect(talkLines(r, id, id).length).toBeGreaterThan(0);
          const staged = t.heroes[hero];
          const live = PLAYABLE[hero]?.(st) ?? false;
          if (live && staged && typeof staged === 'object' && !Array.isArray(staged)) mark(`${id}/${hero}`, staged.story.findIndex(([, v]) => v === r));
        }
      }
    }
    for (const [id, t] of Object.entries(EA_TALK)) {
      expect(t.story[0][0], `${id}: the first story step must be the chapter-0 fallback`).toBe(0);
      expect(t.story.length, `${id}: chatter follows at least five story points`).toBeGreaterThanOrEqual(5);
      const missed = t.story.map(([k], j) => [k, j] as [StoryKey, number]).filter(([, j]) => !reached.get(id)?.has(j));
      expect(missed, `${id}: story steps no playthrough reaches`).toEqual([]);
      for (const [hero, r] of Object.entries(t.heroes)) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
        const seen = reached.get(`${id}/${hero}`) ?? new Set<number>();
        if (hero === 'satan') {
          // Mr. Satan joins after the tournament, with Buu hibernating: a story run only ever plays his last variant.
          expect([...seen], `${id} -> satan: the post-game variant`).toEqual([r.story.length - 1]);
          expect(r.story[r.story.length - 1][0], `${id} -> satan`).toBe(BUU_ASLEEP);
          continue;
        }
        if (!PLAYABLE[hero as CharId]) continue;
        const missedR = r.story.map(([k], j) => [k, j] as [StoryKey, number]).filter(([, j]) => !seen.has(j));
        expect(missedR, `${id} -> ${hero}: reaction steps never reached`).toEqual([]);
      }
    }
  });

  it('every line is short, has a known speaker, and story keys are flags the acts really set', () => {
    const source = Object.values(import.meta.glob('../../src/content/**/*.ts', { query: '?raw', import: 'default', eager: true })).join('\n');
    const known = (id: string, who: string) => who === id || who === 'hero' || who === 'narrator' || !!CAST[who];
    const check = (id: string, t: Talk, me: string) => {
      for (const [who, text] of talkLines(t, id, me)) {
        expect(known(id, who), `${id}: unknown speaker "${who}"`).toBe(true);
        expect(text.trim().length, `${id}: empty line`).toBeGreaterThan(0);
        expect(text.length, `${id}: "${text}" is longer than two dialogue boxes`).toBeLessThanOrEqual(150);
        expect(text, `${id}: placeholder`).not.toMatch(/\{(?!hero\})|TODO|TBD|lorem/i);
      }
    };
    // A flag some script clears again (c06_earthGone lives for one cutscene) only works as a key if the timeline
    // above models the clear; otherwise its lines may never be heard.
    const cleared = new Set(TIMELINE.flatMap(([, , c]) => c ?? []));
    for (const id of Object.keys(EA_TALK)) {
      for (const t of talks(id)) check(id, t, id);
      const keys: StoryKey[] = EA_TALK[id].story.map(([k]) => k);
      for (const r of Object.values(EA_TALK[id].heroes)) if (r && typeof r === 'object' && !Array.isArray(r)) keys.push(...r.story.map(([k]) => k));
      for (const k of keys) {
        if (typeof k === 'number') continue;
        for (const atom of k.split('&').map((a) => a.trim().replace(/^!/, ''))) {
          if (/^chapter/.test(atom)) continue;
          if (atom.startsWith('done:')) {
            expect(source.includes(`done('${atom.slice(5)}'`), `${id}: story key "${atom}" is a quest no script finishes`).toBe(true);
            continue;
          }
          expect(source.includes(`set('${atom}'`), `${id}: story key "${atom}" is never set by any script`).toBe(true);
          if (source.includes(`clear('${atom}'`)) expect(cleared.has(atom), `${id}: story key "${atom}" is cleared again by a script`).toBe(true);
        }
      }
    }
    const examined = new Set(EXAMINES.map(([, s]) => s));
    for (const [script, table] of Object.entries(EA_ASIDES)) {
      expect(examined.has(script), `${script} is not an Earth A examine trigger`).toBe(true);
      for (const t of Object.values(table)) if (t) check(script, t, 'hero');
    }
  });

  it('each townsperson says something only that character hears, and the news is still reachable', async () => {
    const maps = [...new Set(TOWNSFOLK.map(([m]) => m))];
    for (const map of maps) {
      const npcs = TOWNSFOLK.filter(([m]) => m === map).map(([, id]) => id);
      const heard = new Map<string, Map<CharId, string[]>>();
      for (const hero of MAIN_ROSTER) {
        const sim = playAs(hero, POST);
        const said = listen(sim);
        sim.start(map);
        await sim.tick(3);
        for (const id of npcs) {
          const from = said.length;
          for (let k = 0; k < 4; k++) await talkTo(sim, id);
          const per = heard.get(id) ?? new Map<CharId, string[]>();
          per.set(hero, said.slice(from).filter((l) => !/^: You found/.test(l)));
          heard.set(id, per);
        }
        expect(sim.errors, `${map} as ${hero}`).toEqual([]);
      }
      for (const id of npcs) {
        const per = heard.get(id) ?? new Map<CharId, string[]>();
        for (const hero of MAIN_ROSTER) {
          const others = new Set(MAIN_ROSTER.filter((h) => h !== hero).flatMap((h) => per.get(h) ?? []));
          const own = (per.get(hero) ?? []).filter((l) => !others.has(l));
          expect(own.length, `${id} has no reaction to ${hero}`).toBeGreaterThan(0);
        }
        const shared = (per.get('goku') ?? []).filter((l) => MAIN_ROSTER.every((h) => per.get(h)?.includes(l)));
        expect(shared.length, `${id}: the story chatter is unreachable between reactions`).toBeGreaterThan(0);
      }
    }
  });

  it('the townsfolk notice the story: Beerus, Frieza\'s army, Future Trunks, the Zeno tournament and its aftermath', async () => {
    const cases: Array<[string, string, number, RegExp, RegExp?]> = [
      ['satan_plaza', 'ea_sc_reporter', moment(3), /hole in the hull/],
      ['paozu_valley', 'ea_pv_farmer', moment(4, 'c03_beerusDone'), /sky over the sea lit up gold/],
      ['satan_plaza', 'ea_sc_reporter', moment(4, 'c03_beerusDone'), /sky over the sea lit up gold/],
      ['satan_plaza', 'ea_sc_reporter', moment(5), /alien emperor/],
      ['lookout', 'ea_lk_popo', moment(5), /Frieza has returned/],
      ['satan_plaza', 'ea_sc_granny', moment(6, EARTH_RESTORED), /world went boom/],
      ['paozu_valley', 'ea_pv_farmer', moment(7, 'c07_champaDone'), /another universe/],
      ['satan_mansion', 'ea_sm_gardener', moment(7, 'c07_champaDone'), /another universe/],
      ['satan_mansion', 'ea_sm_gardener', moment(8), /Buu\'s home/, /another universe with Mr\. Son/],
      ['paozu_home', 'ea_ph_neighbor', moment(9), /time machine/],
      ['satan_plaza', 'ea_sc_scientist', moment(12, 'c11_farewell'), /whole timeline/],
      ['kame_island', 'ea_ki_turtle', moment(12, 'c11_farewell'), /ramen coupon/],
      ['satan_plaza', 'ea_sc_scientist', moment(13), /twelve whole universes/],
      ['satan_plaza', 'ea_sc_police', moment(14, 'c14_departed'), /Saving the universe/],
      ['kame_island', 'ea_ki_turtle', moment(14, 'c14_departed'), /left for the tournament/],
      ['satan_mansion_in', 'ea_smi_butler', moment(14, 'c14_departed'), /sports pages/],
      ['korin_tower', 'ea_kt_korin', POST, /Universe 7 lives/],
      ['satan_plaza', 'ea_sc_fan', POST, /GOD OF DESTRUCTION/],
    ];
    for (const [map, id, i, want, not] of cases) {
      const sim = playAs('goku', i);
      const said = listen(sim);
      sim.start(map);
      await sim.tick(3);
      for (let k = 0; k < 4; k++) await talkTo(sim, id);
      expect(said.some((l) => want.test(l)), `${id} @${label(i)}: ${want}`).toBe(true);
      if (not) expect(said.some((l) => not.test(l)), `${id} @${label(i)}: stale ${not}`).toBe(false);
      expect(sim.errors).toEqual([]);
    }
    // Before the story gets there, nobody mentions it.
    const early = playAs('goku', moment(1));
    const said = listen(early);
    early.start('paozu_valley');
    await early.tick(3);
    for (let k = 0; k < 4; k++) await talkTo(early, 'ea_pv_farmer');
    expect(said.some((l) => /gold|soldiers|tournament/.test(l))).toBe(false);
  });

  it('nobody gets ahead of the story: the cruise before it sails, Universe 6 before Champa, Buu away before he leaves', async () => {
    const quiet: Array<[string, string, number, RegExp]> = [
      // Chapter 2 before Vegeta boards: the party is still to come, and Mr. Satan and Buu are at home.
      ['satan_plaza', 'ea_sc_reporter', moment(2), /hole in the hull/],
      ['satan_plaza', 'ea_sc_police', moment(2), /seaweed/],
      ['satan_plaza', 'ea_sc_girl', moment(2), /saw the photos/],
      ['satan_plaza', 'ea_sc_fan', moment(2), /went to a party/],
      // Chapter 7 before Champa's visit: no Universe 6 match yet, and Buu is still on the sofa.
      ['paozu_valley', 'ea_pv_farmer', moment(7), /another universe/],
      ['paozu_home', 'ea_ph_neighbor', moment(7), /another universe/],
      ['satan_plaza', 'ea_sc_tourist', moment(7), /another universe/],
      ['satan_plaza', 'ea_sc_girl', moment(7), /away/],
      ['satan_plaza', 'ea_sc_reporter', moment(7), /cultural exchange/],
      ['satan_plaza', 'ea_sc_suit', moment(7), /another universe/],
      ['satan_dojo', 'ea_sd_student1', moment(7), /another universe/],
      ['lookout', 'ea_lk_popo', moment(7), /has been busy/],
    ];
    for (const [map, id, i, early] of quiet) {
      const sim = playAs('goku', i);
      const said = listen(sim);
      sim.start(map);
      await sim.tick(3);
      for (let k = 0; k < 6; k++) await talkTo(sim, id);
      expect(said.filter((l) => early.test(l)), `${id} @${label(i)} is ahead of the story`).toEqual([]);
      expect(sim.errors).toEqual([]);
    }
    expect(def('satan_mansion_in').npcs?.some((n) => n.id === 'ea_smi_buu' && n.hideIf === 'ea_buuAway')).toBe(true);
  });

  it('a story run meets Mr. Satan after the tournament: the Champion minds his hibernating buddy', async () => {
    const sim = playAs('satan', POST);
    const said = listen(sim);
    sim.start('satan_plaza');
    await sim.tick(3);
    // The waiter's first talk is the cafe intro; the second is the reaction to the Champion.
    for (let k = 0; k < 2; k++) await talkTo(sim, 'ea_sc_waiter');
    expect(said.some((l) => /Box his up/.test(l))).toBe(true);
    expect(said.some((l) => /VERY good boy this week/.test(l))).toBe(false);
    sim.start('satan_mansion_in');
    await sim.tick(3);
    expect(await sim.run('ea_smi_stairs')).toBe(true);
    expect(said.some((l) => /Buu's sleeping\. The Champion is home\. Quietly/.test(l))).toBe(true);
    await talkTo(sim, 'ea_smi_buu');
    expect(said.some((l) => /pulls the blanket up to Buu's chin/.test(l))).toBe(true);
    expect(said.some((l) => /Buu missed you/.test(l))).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('Mr. Satan answers from upstairs only when he is home, and reacts to who is downstairs', async () => {
    const VOICE = ': A familiar voice booms down the stairs.';
    const cases: Array<[number, CharId, boolean]> = [
      [moment(1), 'goku', false], [moment(4), 'vegeta', false], [moment(5), 'gohan', false],
      [moment(3), 'goku', false], [moment(3, 'c03_satanDone'), 'goku', true],
      [moment(2), 'vegeta', true], [moment(2, 'ea_buuAway'), 'vegeta', false],
      [moment(9), 'trunks', true], [moment(14, 'c14_departed'), 'piccolo', true],
      [POST, 'gohan', true], [POST, 'satan', false],
    ];
    for (const [i, hero, home] of cases) {
      const sim = playAs(hero, i);
      const said = listen(sim);
      sim.start('satan_mansion_in');
      await sim.tick(3);
      expect(satanHome({ check: (c) => sim.game.state.check(c), hero }), `${hero} @${label(i)}`).toBe(home);
      for (let k = 0; k < 2; k++) expect(await sim.run('ea_smi_stairs')).toBe(true);
      expect(said.filter((l) => l === VOICE).length, `${hero} @${label(i)}`).toBe(home ? 2 : 0);
      expect(sim.errors).toEqual([]);
    }
    // Who is downstairs: Vegeta gets the answering machine; the second visit is the story news.
    const sim = playAs('vegeta', moment(9));
    const said = listen(sim);
    sim.start('satan_mansion_in');
    await sim.tick(3);
    await sim.run('ea_smi_stairs');
    expect(said.some((l) => /^Mr\. Satan: .*This is a recording/.test(l))).toBe(true);
    await sim.run('ea_smi_stairs');
    expect(said.some((l) => /^Mr\. Satan: .*time machine crashed/.test(l))).toBe(true);
    // Back home with the Champion Orb handed over (Chapter 3), he tells the cruise story that ended Chapter 2.
    const ch3 = playAs('goku', moment(3, 'c03_satanDone'));
    const heard = listen(ch3);
    ch3.start('satan_mansion_in');
    await ch3.tick(3);
    for (let k = 0; k < 4; k++) await ch3.run('ea_smi_stairs');
    expect(heard.some((l) => /^Mr\. Satan: .*wouldn't share his pudding/.test(l))).toBe(true);
    // Playing Mr. Satan: his own staircase.
    const me = playAs('satan', POST);
    const mine = listen(me);
    me.start('satan_mansion_in');
    await me.tick(3);
    await me.run('ea_smi_stairs');
    expect(mine.some((l) => /Home sweet h/.test(l))).toBe(true);
  });

  it('Mr. Satan and Majin Buu: mobbed by his best friend, and tucking him in once he hibernates', async () => {
    const talkBuu = async (hero: CharId, i: number, times: number) => {
      const sim = playAs(hero, i);
      const said = listen(sim);
      sim.start('satan_mansion_in');
      await sim.tick(3);
      for (let k = 0; k < times; k++) await talkTo(sim, 'ea_smi_buu');
      expect(sim.errors).toEqual([]);
      return said;
    };
    // Awake (the ?char=satan dev entry; a story run only has Mr. Satan after the tournament): no "watching the
    // Mr. Satan show" intro for the man himself - Buu just mobs him.
    const awake = await talkBuu('satan', moment(12), 1);
    expect(awake.some((l) => /MR\. SATAN! Buu missed you/.test(l))).toBe(true);
    expect(awake.some((l) => /watching Mr\. Satan show/.test(l))).toBe(false);
    // Anyone else meets Buu in front of the TV first; at the Expo he is still awake and bragging.
    const expo = await talkBuu('goku', moment(13), 3);
    expect(expo[0]).toMatch(/watching Mr\. Satan show/);
    expect(expo.some((l) => /Buu beat doggy man/.test(l))).toBe(true);
    // Hibernating from the ninth recruit on: Mr. Satan tucks him in; Buu only snores.
    const asleep = await talkBuu('satan', moment(13, BUU_ASLEEP), 2);
    expect(asleep.some((l) => /pulls the blanket up to Buu's chin/.test(l))).toBe(true);
    expect(asleep.some((l) => /snoring like a thunderstorm/.test(l))).toBe(true);
    expect(asleep.some((l) => /watching Mr\. Satan show/.test(l))).toBe(false);
    const post = await talkBuu('goku', POST, 2);
    expect(post.some((l) => /WAKE ME FOR CAKE/.test(l))).toBe(true);
  });

  it('every Earth A talk and examine script runs cleanly through the whole story as every character', async () => {
    const byMap = new Map<string, Array<[string, boolean]>>();
    for (const [map, id] of TOWNSFOLK) byMap.set(map, [...(byMap.get(map) ?? []), [id, true]]);
    for (const [map, script] of EXAMINES) byMap.set(map, [...(byMap.get(map) ?? []), [script, false]]);
    for (let i = 0; i < TIMELINE.length; i++) {
      // Each moment is played by a different character, so every character walks the timeline several times.
      const hero = HEROES[i % HEROES.length];
      const sim = playAs(hero, i);
      for (const [map, list] of byMap) {
        sim.start(map);
        await sim.tick(3);
        for (const [id, isNpc] of list) {
          const npc = isNpc ? sim.game.field?.npcs.find((n) => n.def.id === id) : undefined;
          if (isNpc && !npc) continue; // away for the story (Buu at the party / in Universe 6)
          for (let k = 0; k < (isNpc ? 3 : 2); k++) {
            expect(await sim.run(id, npc ? { npc } : {}), `${map}/${id} as ${hero} @${label(i)}`).toBe(true);
          }
        }
      }
      expect(sim.errors, `as ${hero} @${label(i)}`).toEqual([]);
    }
  });

  /**
   * Who can be standing in front of the townsfolk: the forced segments (Vegeta for all of Chapter 2, Goku in
   * Chapter 8's hub time, Trunks for all of Chapter 11), otherwise everyone the party timeline has joined.
   */
  function listeners(st: State): CharId[] {
    const forced: Partial<Record<number, CharId>> = { 2: 'vegeta', 8: 'goku', 11: 'trunks' };
    const only = forced[st.data.chapter];
    return only ? [only] : MAIN_ROSTER.filter((h) => PLAYABLE[h]?.(st) ?? false);
  }

  /** How the townsfolk name each character when he is not around. */
  const NAMED: Record<CharId, RegExp> = {
    goku: /\bGoku\b|\bKakarot\b|\bMr\. Son\b/, vegeta: /\bVegeta\b/, gohan: /\bGohan\b/, piccolo: /\bPiccolo\b/, trunks: /\bTrunks\b/,
    satan: /\bMr\. Satan\b|\bChampion\b|\bSensei\b|\bthe Master\b/, android17: /\bAndroid 17\b/, frieza: /\bFrieza\b/,
  };

  it('nobody talks about you behind your back: the news never names a character who could be the one listening', () => {
    const st = new Sim().game.state;
    const leaks: string[] = [];
    for (let i = 0; i < TIMELINE.length; i++) {
      step(st, i);
      for (const [id, t] of Object.entries(EA_TALK)) {
        const c = byStory(st, t.story);
        const news = typeof c === 'object' && !Array.isArray(c) ? c.cycle : [c];
        for (const hero of listeners(st)) {
          // Mr. Satan's voice from upstairs is only heard while he is home and somebody else is downstairs.
          if (id === 'ea_smi_stairs' && !satanHome({ check: (k) => st.check(k), hero })) continue;
          for (const [who, text] of news.flatMap((n) => talkLines(n, id, id))) {
            if (who !== 'narrator' && who !== 'hero' && NAMED[hero].test(text)) leaks.push(`${id} to ${hero} @${label(i)}: ${text}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('mid-chapter news waits for its beat: Frieza\'s army (Ch5), Goku Black\'s visit (Ch9), the Mafuba lesson (Ch11)', async () => {
    /** Four talks to `id` on `map` as `hero` at timeline moment `i`: everything said. */
    const hear = async (map: string, id: string, hero: CharId, i: number): Promise<string[]> => {
      const sim = playAs(hero, i);
      const said = listen(sim);
      sim.start(map);
      await sim.tick(3);
      for (let k = 0; k < 4; k++) await talkTo(sim, id);
      expect(sim.errors, `${id} @${label(i)}`).toEqual([]);
      return said;
    };
    // [map, NPC, the moment before the beat, the moment after it, what only the second may mention]
    const beats: Array<[string, string, number, number, RegExp]> = [
      ['satan_plaza', 'ea_sc_police', moment(9, 'c09_hopeCrashed'), moment(9, BLACK_SEEN), /dark gi/],
      ['satan_plaza', 'ea_sc_jogger', moment(9, 'c09_hopeCrashed'), moment(9, BLACK_SEEN), /dark gi/],
      ['paozu_valley', 'ea_pv_farmer', moment(9, 'c09_hopeCrashed'), moment(9, BLACK_SEEN), /dark gi/],
      ['kame_island', 'ea_ki_turtle', moment(9, 'c09_hopeCrashed'), moment(9, BLACK_SEEN), /familiar ki/],
      ['korin_tower', 'ea_kt_korin', moment(9, 'c09_hopeCrashed'), moment(9, BLACK_SEEN), /familiar ki/],
      ['kame_island', 'ea_ki_turtle', moment(11), moment(11, MAFUBA_TAUGHT), /rice cooker/],
      ['kame_island', 'ea_ki_sailor', moment(11), moment(11, MAFUBA_TAUGHT), /MAFUBA/],
      ['lookout', 'ea_lk_popo', moment(11), moment(11, MAFUBA_TAUGHT), /Kami's old bottle/],
    ];
    // Trunks is forced through Chapter 11 and is the first to walk the hubs in Chapter 9.
    for (const [map, id, before, after, news] of beats) {
      expect((await hear(map, id, 'trunks', before)).filter((l) => news.test(l)), `${id} @${label(before)}`).toEqual([]);
      expect((await hear(map, id, 'trunks', after)).some((l) => news.test(l)), `${id} @${label(after)}`).toBe(true);
    }
    // Chapter 5's hub time is before and during the battle in the wasteland: nobody reports it won yet.
    for (const [map, id] of [['satan_plaza', 'ea_sc_police'], ['satan_plaza', 'ea_sc_reporter'], ['satan_plaza', 'ea_sc_scientist'],
      ['satan_mansion_in', 'ea_smi_butler'], ['paozu_valley', 'ea_pv_farmer'], ['kame_island', 'ea_ki_turtle'], ['kame_island', 'ea_ki_sailor']]) {
      const said = await hear(map, id, 'gohan', moment(5));
      expect(said.filter((l) => /came back|no wreckage|tidied|next morning|for six hours|fought (half )?an? (alien )?army/i.test(l)), id).toEqual([]);
    }
  });
});

describe('world earthA: Turtle Reef signposts', () => {
  it('both reef signs stand on dry sand next to the walkway, readable from the path', () => {
    for (const [id, x, y] of [['kame_island', 33, 11], ['kame_reef', 3, 14]] as Array<[string, number, number]>) {
      const m = def(id);
      const sign = (m.objects ?? []).find((o) => o.type === 'sign' && o.x === x && o.y === y && /TURTLE REEF/.test(o.text));
      expect(sign, `${id} reef sign at ${x},${y}`).toBeTruthy();
      const grid = parseGrid(m);
      expect(grid[y][x], `${id} sign footing`).toBe('sand');
      // Read from the sandbar walkway (rows 12-13), the only way between the island and the reef.
      expect([grid[y + 1]?.[x], grid[y - 1]?.[x]].includes('sand'), `${id} sign beside the path`).toBe(true);
    }
  });
});

describe('world ecology (Earth A): homed wildlife keeps out of sight of every way into its map', () => {
  /** Regular enemies notice the hero within 110 px (`AGGRO` in src/game/enemy.ts). */
  const SIGHT = 110 / TILE;
  /** Wildlife the ecology pass homed on Earth A's hostile maps (the older spawns keep their own placement). */
  const HOMED: Record<string, string[]> = {
    paozu_forest: ['crab', 'slime'], paozu_peaks: ['wolf', 'crab', 'viper', 'hornet', 'timberWolf', 'bear'],
    korin_base: ['viper', 'crab', 'beetle', 'hornet', 'bear'],
    kame_reef: ['crab', 'viper', 'ea_tideSlime', 'mudSlime', 'kingCrab', 'pterodactyl'],
  };

  it('no homed creature can jump the hero on arrival (edge exits, doors, flight circles, landing spots)', async () => {
    for (const [id, types] of Object.entries(HOMED)) {
      const m = def(id);
      const sim = new Sim();
      setup(sim, QUIET);
      sim.start(id);
      await sim.tick(1);
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      const grid = parseGrid(m);
      const W = grid[0].length;
      const H = grid.length;
      const open = (x: number, y: number) => !f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 });
      const ways: Array<[number, number, string]> = [];
      for (const [side, ex] of Object.entries(m.exits ?? {})) {
        if (!ex) continue;
        for (let i = 0; i < (side === 'north' || side === 'south' ? W : H); i++) {
          const [x, y] = side === 'north' ? [i, 0] : side === 'south' ? [i, H - 1] : side === 'west' ? [0, i] : [W - 1, i];
          if (open(x, y)) ways.push([x, y, `${side} exit`]);
        }
      }
      for (const other of Object.keys(MAPS)) {
        const o = resolveMap(other);
        for (const w of o?.warps ?? []) if (w.to === id) ways.push([Math.floor(w.tx), Math.floor(w.ty), `door from ${other}`]);
        for (const fl of o?.objects ?? []) if (fl.type === 'flight' && fl.to === id) ways.push([Math.floor(fl.tx), Math.floor(fl.ty), `flight from ${other}`]);
      }
      for (const s of Object.values(SPOTS)) if (s.map === id) ways.push([s.tx, s.ty, s.id]);
      expect(ways.length, id).toBeGreaterThan(0);
      const homed = (m.enemies ?? []).filter((e) => types.includes(e.type));
      expect(homed.length, id).toBeGreaterThan(0);
      for (const e of homed) {
        for (const [x, y, how] of ways) {
          expect(Math.hypot(x - e.x, y - e.y), `${id}: ${e.type} at ${e.x},${e.y} sees the ${how} at ${x},${y}`).toBeGreaterThan(SIGHT);
        }
      }
    }
  });

  it('every creature on an Earth A hostile map starts with its own hitbox clear of walls, water and props', async () => {
    for (const id of EARTH_A.filter((m) => def(m).hostile)) {
      const sim = new Sim();
      setup(sim, QUIET);
      for (const b of def(id).barriers ?? []) sim.game.state.set(`gate:${id}:${b.id}`);
      sim.start(id);
      await sim.tick(1);
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      for (const e of f.enemies) {
        expect(f.col.blocked(e.box(), e.flying), `${id}: ${e.def.id} spawns inside something solid at ${(e.x / TILE).toFixed(1)},${(e.y / TILE).toFixed(1)}`).toBe(false);
      }
    }
  });
});

describe('world ecology (Earth A): Kame House keeps one Delicacy across the move to Turtle Reef', () => {
  it('the atoll Delicacy waits for a new save, but not for one that already dug up the old Kame House beach one', async () => {
    const reefDelicacy = async (dugUpOld: boolean): Promise<boolean> => {
      const sim = new Sim();
      setup(sim, QUIET, 25);
      if (dugUpOld) sim.game.state.set('pickup:del_kame_island_1');
      sim.game.state.set('gate:kame_reef:ea_g25_gohan');
      sim.start('kame_reef', 2, 12);
      await sim.tick(2);
      expect(sim.errors).toEqual([]);
      return (sim.game.field?.pickups ?? []).some((p) => p.kind === 'item' && p.item === 'delicacy');
    };
    expect(await reefDelicacy(false)).toBe(true);
    expect(await reefDelicacy(true)).toBe(false);
  });
});

describe('world ecology (Earth A): the grind zones fit LoG2\'s band for the Goku who first walks in (critic round 2)', () => {
  /**
   * Each zone as it first opens: the chapter, and Goku's level and kit then (the recorded story run: Paozu Forest
   * behind the L2 tutorial gate, the peaks' basin on the way to Scarface at L4, Turtle Reef and Korin Forest in the
   * Chapter 3 Dragon Ball hunt at L11), with the fair bot's EXP per minute there before the retune (same saves, same
   * seeds), which a clear must still match so the grind stays as quick. Korin Forest was in band already; its brown
   * bear keeps LoG2's Kuma 69 row (9 hits to knock Goku out at L11), so only its zone medians are held.
   */
  const STAGES: Array<{ map: string; chapter: number; level: number; techs: string[]; form: string | null; before: number; perType: boolean }> = [
    { map: 'paozu_forest', chapter: 1, level: 2, techs: ['kiBlast'], form: null, before: 919, perType: true },
    { map: 'paozu_peaks', chapter: 1, level: 4, techs: ['kiBlast', 'kamehameha'], form: null, before: 2900, perType: true },
    { map: 'kame_reef', chapter: 3, level: 11, techs: ['kiBlast', 'kamehameha'], form: 'ssj', before: 14942, perType: true },
    { map: 'korin_base', chapter: 3, level: 11, techs: ['kiBlast', 'kamehameha'], form: 'ssj', before: 5950, perType: false },
  ];
  const SEEDS = [1, 2, 3, 4, 5, 6];

  /** A save with Goku as he walks into a stage (pinned RNG, no Senzu). */
  function arrival(s: (typeof STAGES)[number]): string {
    const st = new GameState();
    st.rng = new Rng(0x6ea0 + s.level);
    st.data.chapter = s.chapter;
    st.join('goku', s.level);
    st.data.active = 'goku';
    const c = st.char('goku');
    c.techs = [...s.techs];
    c.selected = 0;
    c.form = s.form;
    st.data.inv = {};
    return JSON.stringify(st.data);
  }

  const median = (xs: number[]): number => {
    const v = [...xs].sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  it('the fair bot clears each zone with no knock-out and no Senzu, as fast in EXP per minute as before, and every foe sits in the band', async () => {
    for (const s of STAGES) {
      const save = arrival(s);
      const runs: ZoneClear[] = [];
      for (const seed of SEEDS) runs.push(await clearZone(save, s.map, seed));
      for (const r of runs) {
        expect(r.stopped, `${s.map} seed ${r.seed}`).toBe('cleared');
        expect(r.kills, `${s.map} seed ${r.seed}: every foe in reach`).toBe(r.scoped);
        expect(r.kos, `${s.map} seed ${r.seed}: knock-outs`).toBe(0);
        expect(r.senzu, `${s.map} seed ${r.seed}: Senzu eaten`).toBe(0);
        expect(r.levelEnd, `${s.map} seed ${r.seed}: one clear is worth a level`).toBeGreaterThan(r.level);
      }
      const perMinute = runs.reduce((a, r) => a + r.exp / (r.frames / 3600), 0) / runs.length;
      expect(perMinute, `${s.map}: EXP per minute`).toBeGreaterThanOrEqual(s.before);
      // The critic's hits formula (one average melee hit against the foe's END; one average hit of the foe's real
      // attack stat against Goku's END, form included) for every type the clears met.
      const st = new GameState(JSON.parse(save) as ConstructorParameters<typeof GameState>[0]);
      const hero = formStats(st.hero, st.hero.form);
      const types = [...new Set(runs.flatMap((r) => Object.keys(r.foes).filter((t) => r.foes[t].count > 0)))];
      const ratios = types.map((t) => ({ t, ...mobRatio(hero, ENEMIES[t]) }));
      if (s.perType) {
        for (const q of ratios) {
          expect(q.hitsToEnd, `${s.map}: hits to kill a ${q.t}`).toBeLessThanOrEqual(7);
          expect(q.hitsToKO, `${s.map}: ${q.t} hits to knock Goku out`).toBeGreaterThanOrEqual(10);
        }
      }
      const kill = median(ratios.map((q) => q.hitsToEnd));
      const ko = median(ratios.map((q) => q.hitsToKO));
      expect(kill, `${s.map}: median hits to kill`).toBeLessThanOrEqual(6);
      expect(ko, `${s.map}: median hits to knock Goku out`).toBeGreaterThanOrEqual(12);
      expect(kill >= 3 || ko <= 40, `${s.map}: not a walkover (median ${kill} to kill, ${ko} to KO)`).toBe(true);
    }
  }, 180000);

  it('the peaks\' basin is Chapter 1 ground: vipers join the pool from Chapter 3, the big game waits behind the L15 gate', () => {
    const peaks = def('paozu_peaks');
    const spawns = (chapter: number) => {
      const st = new GameState();
      st.data.chapter = chapter;
      return (peaks.enemies ?? []).filter((e) => st.check(e.showIf) && !(e.hideIf && st.check(e.hideIf)));
    };
    expect(spawns(1).filter((e) => e.type === 'viper')).toEqual([]);
    expect(spawns(3).filter((e) => e.type === 'viper').length).toBe(2);
    // Every Chapter 1 resident of the basin (south of the cliff band, west of the gate) is a forest-tier creature.
    const basin = spawns(1).filter((e) => e.y > 15 && e.x < 30).map((e) => e.type);
    expect([...new Set(basin)].sort()).toEqual(['crab', 'hawk', 'hornet', 'wolf']);
    const gate = peaks.barriers?.find((b) => b.id === 'g15');
    expect(gate).toMatchObject({ level: 15, character: 'goku' });
    expect((peaks.enemies ?? []).filter((e) => e.y > 15 && e.x > 31).map((e) => e.type).sort()).toEqual(['bear', 'timberWolf']);
  });

  it('Turtle Reef\'s tide slime: its own blob sprite, a no-Fish exploder between the Bog Slime and the Mud Golem, scanned at its real stats', async () => {
    const d = ENEMIES.ea_tideSlime;
    expect(d).toMatchObject({ name: 'Tide Slime', sprite: 'ea_tideSlime', ai: 'exploder' });
    expect(d.drops).toBeUndefined();
    expect(CREATURES.ea_tideSlime?.kind).toBe('blob');
    expect(scanRecord('enemy:ea_tideSlime').entry).toMatchObject({ name: 'Tide Slime', hp: d.hp, str: d.str, pow: d.pow, end: d.end });
    for (const k of ['hp', 'str', 'pow', 'end'] as const) {
      expect(d[k], k).toBeGreaterThan(ENEMIES.slime[k]);
      expect(d[k], k).toBeLessThan(ENEMIES.mudSlime[k]);
    }
    const homes = Object.keys(MAPS).filter((id) => (resolveMap(id)?.enemies ?? []).some((e) => e.type === 'ea_tideSlime'));
    expect(homes).toEqual(['kame_reef']);
    // Its burst is a mud golem's, softer: max(STR, POW) x1.1 within 32 px, a small bite out of a Chapter 3 Goku.
    const sim = new Sim();
    setup(sim, 3, 11);
    sim.start('dev_arena', 4, 8);
    await sim.tick(2);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const blob = f.spawnEnemy('ea_tideSlime', f.player.x + 12, f.player.y);
    const calls: Array<[number, number]> = [];
    const orig = f.damagePlayer.bind(f);
    f.damagePlayer = (atk, mult, x, y, o) => { calls.push([atk, mult]); return orig(atk, mult, x, y, o); };
    const before = f.player.cs.hp;
    blob.die();
    await sim.tick(45);
    expect(calls).toContainEqual([Math.max(d.str, d.pow), 1.1]);
    const taken = before - f.player.cs.hp;
    expect(taken).toBeGreaterThan(0);
    expect(taken, 'burst damage').toBeLessThan(f.player.cs.hpMax / 8);
    expect(sim.errors).toEqual([]);
  });
});
