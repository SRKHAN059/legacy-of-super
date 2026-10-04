import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { TILE } from '../../src/engine/constants';
import type { Button } from '../../src/engine/input';
import type { MapDef } from '../../src/game/mapdef';
import { Sim } from '../sim';

/** World builder A: Mt. Paozu, Satan City, Kame House and The Lookout hubs. */
const EARTH_A = [
  'paozu_valley', 'paozu_home', 'paozu_house', 'gohan_house', 'paozu_forest', 'paozu_peaks',
  'satan_plaza', 'satan_mansion', 'satan_mansion_in', 'satan_shop', 'satan_dojo',
  'kame_island', 'kame_house_in', 'korin_base', 'korin_tower', 'lookout', 'lookout_palace_in',
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
