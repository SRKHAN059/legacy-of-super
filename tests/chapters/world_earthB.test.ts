import { describe, expect, it } from 'vitest';
import type { Button } from '../../src/engine/input';
import { MAPS, resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { Sim } from '../sim';

/** world/earthB: West City, Rocky Wasteland, Diablo Desert, Snowy Highlands. */
const MAP_IDS = ['wc_streets', 'wc_shops', 'cc_yard', 'cc_inside', 'cc_gravity', 'waste_entry', 'waste_canyon', 'waste_mesa',
  'desert_entry', 'desert_oasis', 'pilaf_castle_out', 'pilaf_castle_in', 'snow_entry', 'snow_peak'];

function mapId(sim: Sim): string | undefined {
  return sim.game.field?.def.id;
}

function place(sim: Sim, tx: number, ty: number): void {
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  f.player.x = tx * 16 + 8;
  f.player.y = ty * 16 + 14;
}

function tile(sim: Sim): [number, number] {
  const p = sim.game.field?.player;
  if (!p) throw new Error('no player');
  return [Math.floor(p.x / 16), Math.floor((p.y - 1) / 16)];
}

/** Stand on a tile, hold a direction until the map changes (door / edge exit), and let the fade finish. */
async function go(sim: Sim, tx: number, ty: number, dir: Button, expectMap: string): Promise<void> {
  sim.game.allowControl = true; // lets the Sim bot keep the hero alive and clear enemies while we walk around
  await sim.tick(35); // edge-exit / warp cooldown after arriving
  const from = mapId(sim);
  place(sim, tx, ty);
  sim.input.inject(dir, true);
  for (let i = 0; i < 200 && mapId(sim) === from; i++) await sim.tick(1);
  sim.input.inject(dir, false);
  await sim.tick(20);
  expect(mapId(sim), `from ${from} (${tx},${ty}) ${dir}`).toBe(expectMap);
}

/** Use the flight circle on this tile and check where we land. */
async function fly(sim: Sim, tx: number, ty: number, expectTile: [number, number]): Promise<void> {
  sim.game.allowControl = true;
  await sim.tick(5);
  place(sim, tx, ty);
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  expect(f.tryInteract(), `flight circle at ${tx},${ty}`).toBe(true);
  await sim.tick(90);
  const [x, y] = tile(sim);
  expect(Math.abs(x - expectTile[0]) <= 1 && Math.abs(y - expectTile[1]) <= 1, `landed at ${x},${y}`).toBe(true);
}

describe('world earthB: maps', () => {
  it('registers every hub map with the right region and hostility', () => {
    const expected: Record<string, [string, boolean]> = {
      wc_streets: ['West City', false], wc_shops: ['West City', false], cc_yard: ['West City', false], cc_inside: ['West City', false],
      waste_entry: ['Rocky Wasteland', true], waste_canyon: ['Rocky Wasteland', true], waste_mesa: ['Rocky Wasteland', true],
      desert_entry: ['Diablo Desert', true], desert_oasis: ['Diablo Desert', true], pilaf_castle_out: ['Diablo Desert', true],
      pilaf_castle_in: ['Diablo Desert', true], snow_entry: ['Snowy Highlands', true], snow_peak: ['Snowy Highlands', true],
    };
    for (const [id, [region, hostile]] of Object.entries(expected)) {
      expect(MAPS[id], id).toBeTruthy();
      expect(MAPS[id].region, id).toBe(region);
      expect(!!MAPS[id].hostile, id).toBe(hostile);
    }
    const mesa = MAPS.waste_mesa;
    expect(mesa.grid[0].length).toBeGreaterThanOrEqual(44);
    expect(mesa.grid.length).toBeGreaterThanOrEqual(32);
  });

  it('starts every map and runs 30 frames without errors', async () => {
    for (const id of MAP_IDS) {
      const sim = new Sim();
      sim.game.state.data.chapter = 5;
      sim.start(id);
      await sim.tick(30);
      expect(sim.errors, id).toEqual([]);
      expect(mapId(sim)).toBe(id);
    }
  });

  it('registers the four landing spots on walkable tiles', async () => {
    const want: Record<string, string> = { spot_westcity: 'wc_streets', spot_wasteland: 'waste_entry', spot_desert: 'desert_entry', spot_snow: 'snow_entry' };
    for (const [spot, map] of Object.entries(want)) {
      const s = SPOTS[spot];
      expect(s?.map, spot).toBe(map);
      expect(s.world).toBe('earth');
      const sim = new Sim();
      sim.game.startField(s.map, s.tx, s.ty, 'down');
      await sim.tick(10);
      expect(tile(sim)).toEqual([s.tx, s.ty]);
      // Each region entry has a world sign and a save point.
      const objs = MAPS[map].objects ?? [];
      expect(objs.some((o) => o.type === 'worldSign'), `${map} world sign`).toBe(true);
      expect(objs.some((o) => o.type === 'save'), `${map} save`).toBe(true);
    }
  });

  it('places nine Earth Delicacies with del_ ids', () => {
    const ids: string[] = [];
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      for (const p of m.pickups ?? []) if (p.item === 'delicacy') ids.push(p.id);
      for (const o of m.objects ?? []) if (o.type === 'chest' && o.item === 'delicacy') ids.push(o.id);
    }
    expect(ids.length).toBe(9);
    for (const id of ids) expect(id).toMatch(/^del_[a-z_]+_\d$/);
  });

  it('gives each hostile map 2-6 breakables', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      if (!m.hostile || id === 'cc_gravity') continue;
      const n = (m.objects ?? []).filter((o) => o.type === 'breakable').length;
      expect(n >= 2 && n <= 6, `${id} has ${n} breakables`).toBe(true);
    }
  });
});

describe('world earthB: traversal', () => {
  it('West City: streets ⇄ shops, streets ⇄ Capsule Corp ⇄ HQ ⇄ gravity room', async () => {
    const sim = new Sim();
    sim.start('wc_streets', 2, 20);
    await go(sim, 8, 21, 'up', 'wc_shops');
    expect(tile(sim)).toEqual([5, 10]);
    await go(sim, 5, 10, 'down', 'wc_streets');
    expect(tile(sim)).toEqual([8, 21]);
    await go(sim, 13, 21, 'up', 'wc_shops');
    expect(tile(sim)).toEqual([15, 10]);
    await go(sim, 15, 10, 'down', 'wc_streets');
    await go(sim, 42, 13, 'right', 'cc_yard');
    await go(sim, 21, 8, 'up', 'cc_inside');
    expect(tile(sim)).toEqual([9, 12]);
    await go(sim, 4, 2, 'up', 'cc_gravity');
    expect(tile(sim)).toEqual([7, 9]);
    await go(sim, 7, 10, 'down', 'cc_inside');
    expect(tile(sim)).toEqual([4, 2]);
    await go(sim, 9, 12, 'down', 'cc_yard');
    expect(tile(sim)).toEqual([21, 8]);
    await go(sim, 1, 15, 'left', 'wc_streets');
    expect(sim.errors).toEqual([]);
  });

  it('Rocky Wasteland: entry → canyon → mesa and back, plus flight circles', async () => {
    const sim = new Sim();
    sim.start('waste_entry', 3, 15);
    await go(sim, 38, 14, 'right', 'waste_canyon');
    await fly(sim, 29, 22, [37, 21]);
    await fly(sim, 35, 23, [27, 22]);
    await go(sim, 32, 1, 'up', 'waste_mesa');
    expect(tile(sim)[0]).toBe(22);
    await fly(sim, 14, 12, [6, 4]);
    await fly(sim, 8, 6, [13, 13]);
    await go(sim, 22, 32, 'down', 'waste_canyon');
    expect(tile(sim)[0]).toBe(32);
    await go(sim, 1, 14, 'left', 'waste_entry');
    expect(sim.errors).toEqual([]);
  });

  it('Diablo Desert: entry → oasis → castle → interior and back', async () => {
    const sim = new Sim();
    sim.start('desert_entry', 4, 15);
    await go(sim, 40, 14, 'right', 'desert_oasis');
    await go(sim, 21, 1, 'up', 'pilaf_castle_out');
    await go(sim, 19, 10, 'up', 'pilaf_castle_in');
    expect(tile(sim)).toEqual([15, 20]);
    await go(sim, 15, 20, 'down', 'pilaf_castle_out');
    expect(tile(sim)).toEqual([19, 10]);
    await go(sim, 20, 28, 'down', 'desert_oasis');
    await go(sim, 1, 14, 'left', 'desert_entry');
    expect(sim.errors).toEqual([]);
  });

  it('Snowy Highlands: entry ⇄ peak, shelf and summit flights', async () => {
    const sim = new Sim();
    sim.start('snow_entry', 20, 25);
    await fly(sim, 30, 11, [36, 5]);
    await fly(sim, 34, 6, [30, 12]);
    await go(sim, 21, 1, 'up', 'snow_peak');
    await fly(sim, 23, 13, [23, 5]);
    await fly(sim, 17, 6, [24, 14]);
    await go(sim, 21, 32, 'down', 'snow_entry');
    expect(sim.errors).toEqual([]);
  });
});

describe('world earthB: gates and rewards', () => {
  const opened: Array<[string, string, number, number, string]> = [
    ['waste_canyon', 'eb_g25_vegeta', 5, 5, 'str3'],
    ['waste_mesa', 'g50_vegeta', 41, 6, 'trophyVegeta'],
    ['snow_peak', 'g50_goku', 16, 2, 'trophyGoku'],
    ['snow_peak', 'g50_trunks', 22, 2, 'trophyTrunks'],
    ['snow_peak', 'g50_piccolo', 28, 2, 'trophyPiccolo'],
    ['snow_peak', 'g40_goku', 4, 29, 'str3'],
  ];
  for (const [map, gate, x, y, item] of opened) {
    it(`${map}: chest behind ${gate} gives ${item}`, async () => {
      const def = resolveMap(map);
      expect(def?.barriers?.some((b) => b.id === gate), gate).toBe(true);
      const sim = new Sim();
      sim.game.state.set(`gate:${map}:${gate}`);
      sim.start(map, x, y);
      await sim.tick(5);
      place(sim, x, y);
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      f.player.dir = 'up';
      expect(f.tryInteract()).toBe(true);
      await sim.tick(60);
      expect(sim.game.state.count(item)).toBeGreaterThan(0);
      expect(sim.errors).toEqual([]);
    });
  }

  it('trophy gates are level 50 and use the right characters', () => {
    const want: Record<string, string> = { g50_vegeta: 'vegeta', g50_goku: 'goku', g50_trunks: 'trunks', g50_piccolo: 'piccolo' };
    for (const m of MAP_IDS) {
      for (const b of MAPS[m].barriers ?? []) {
        if (!want[b.id]) continue;
        expect(b.level, b.id).toBe(50);
        expect(b.character, b.id).toBe(want[b.id]);
      }
    }
    expect(MAPS.snow_peak.barriers?.find((b) => b.id === 'g40_goku')).toMatchObject({ level: 40, character: 'goku' });
  });
});

describe('world earthB: scripts', () => {
  it('runs every ambient talk / trigger script at several story points without errors', async () => {
    for (const chapter of [0, 2, 4, 5, 6, 9, 13]) {
      for (const id of MAP_IDS) {
        const m = resolveMap(id);
        if (!m) continue;
        const ids = [...(m.npcs ?? []).filter((n) => n.talk.startsWith('eb_')).map((n) => n.talk), ...(m.triggers ?? []).filter((t) => t.script.startsWith('eb_')).map((t) => t.script)];
        if (!ids.length) continue;
        const sim = new Sim();
        sim.game.state.data.chapter = chapter;
        sim.start(id);
        await sim.tick(3);
        for (const sid of ids) {
          for (let k = 0; k < 3; k++) {
            sim.choice = k % 2;
            const npc = sim.game.field?.npcs.find((n) => n.def.talk === sid);
            const ok = await sim.run(sid, npc ? { npc } : {});
            expect(ok, `${id}/${sid} ch${chapter}`).toBe(true);
          }
        }
        expect(sim.errors, `${id} ch${chapter}`).toEqual([]);
      }
    }
  });

  it('ramen delivery side quest: chef → broth capsule in the wasteland → reward', async () => {
    const sim = new Sim();
    sim.start('wc_shops', 3, 7);
    await sim.tick(3);
    expect(await sim.run('eb_shop_chef', { npc: sim.game.field?.npcs.find((n) => n.def.id === 'eb_shop_chef') })).toBe(true);
    expect(sim.game.state.check('quest:eb_delivery')).toBe(true);

    sim.start('waste_entry', 3, 15);
    await sim.tick(5);
    expect(sim.game.field?.pickups.some((p) => p.id === 'eb_broth')).toBe(true);
    place(sim, 11, 18);
    await sim.tick(60);
    expect(sim.game.state.count('eb_brothCapsule')).toBe(1);

    sim.start('wc_shops', 3, 7);
    await sim.tick(3);
    const pow = sim.game.state.count('pow3');
    expect(await sim.run('eb_shop_chef', { npc: sim.game.field?.npcs.find((n) => n.def.id === 'eb_shop_chef') })).toBe(true);
    expect(sim.game.state.check('done:eb_delivery')).toBe(true);
    expect(sim.game.state.count('eb_brothCapsule')).toBe(0);
    expect(sim.game.state.count('pow3')).toBe(pow + 1);
    expect(sim.errors).toEqual([]);
  });

  it('gravity console accepts every setting', async () => {
    for (const choice of [0, 1, 2, 3]) {
      for (const chapter of [1, 6]) {
        const sim = new Sim();
        sim.game.state.data.chapter = chapter;
        sim.start('cc_gravity', 7, 8);
        await sim.tick(3);
        sim.choice = choice;
        expect(await sim.run('eb_cc_gravity')).toBe(true);
        expect(sim.errors).toEqual([]);
        expect(sim.game.state.get('eb_gravity')).toBe(choice === 3 && chapter < 6 ? 1 : [1, 10, 100, 300][choice]);
      }
    }
  });

  it('computer terminal explains the scouter link, then opens the Scouter database', async () => {
    const t = MAPS.cc_inside.triggers?.find((x) => x.id === 'eb_cc_terminal');
    expect(t).toMatchObject({ x: 1, y: 8, w: 2, h: 1, onAction: true, hideIf: 'eb_terminal_custom' });
    const sim = new Sim();
    sim.start('cc_inside', 2, 9);
    await sim.tick(3);
    expect(await sim.run('eb_cc_terminal')).toBe(true);
    sim.game.state.give('scouter', 1);
    let opened = false;
    const orig = sim.game.openScouterDb.bind(sim.game);
    sim.game.openScouterDb = async () => { opened = true; };
    expect(await sim.run('eb_cc_terminal')).toBe(true);
    sim.game.openScouterDb = orig;
    expect(opened).toBe(true);
    expect(sim.errors).toEqual([]);
  });
});
