import { describe, expect, it } from 'vitest';
import type { Button } from '../../src/engine/input';
import { propArt } from '../../src/art/props';
import { MAIN_ROSTER, type CharId } from '../../src/content/characters';
import { MAPS, resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { parseGrid } from '../../src/game/world';
import type { Line } from '../../src/ui/dialogue';
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

// ------------------------------------------------------------------------------------------------ LoG2 parity extras

/** Record every dialogue line the game shows (speaker name + text). */
function record(sim: Sim): string[] {
  const out: string[] = [];
  const orig = sim.game.say.bind(sim.game);
  sim.game.say = (lines: Line[]) => {
    for (const l of lines) out.push(`${l.name ?? ''}: ${l.text}`);
    return orig(lines);
  };
  return out;
}

/** A fresh save at a story point, playing as `hero`. */
function playing(hero: CharId, chapter: number, flags: string[] = []): Sim {
  const sim = new Sim();
  const st = sim.game.state;
  st.join(hero, 30);
  st.data.active = hero;
  st.data.chapter = chapter;
  for (const f of flags) st.set(f);
  return sim;
}

async function talkTo(sim: Sim, npcId: string): Promise<void> {
  const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
  expect(npc, `${npcId} on ${sim.game.field?.def.id}`).toBeTruthy();
  if (!npc) return;
  expect(await sim.run(npc.def.talk, { npc }), npcId).toBe(true);
}

describe('world earthB: Mrs. Briefs\'s endless cookies (LoG2 §9.1)', () => {
  it('stands in the Capsule Corp kitchen and gives one Cookie per talk, every time', async () => {
    const sim = playing('goku', 5);
    const said = record(sim);
    sim.start('cc_inside', 17, 3);
    await sim.tick(3);
    for (let i = 1; i <= 12; i++) {
      await talkTo(sim, 'eb_cc_panchy');
      expect(sim.game.state.count('cookie'), `talk ${i}`).toBe(i);
    }
    expect(said[0]).toMatch(/^Mrs\. Briefs: .*Goku/);
    expect(said.some((l) => l.startsWith('Mrs. Briefs: Goku, dear!')), 'reacts to Goku').toBe(true);
    expect(said.filter((l) => /You found a Cookie/.test(l)).length).toBe(12);
    expect(sim.errors).toEqual([]);
  });

  it('stops at the 99 cap with her "you have 99 already" line', async () => {
    const sim = playing('vegeta', 9);
    const said = record(sim);
    sim.start('cc_inside', 17, 3);
    await sim.tick(3);
    sim.game.state.data.inv.cookie = 98;
    await talkTo(sim, 'eb_cc_panchy');
    expect(sim.game.state.count('cookie')).toBe(99);
    said.length = 0;
    for (let i = 0; i < 3; i++) await talkTo(sim, 'eb_cc_panchy');
    expect(sim.game.state.count('cookie')).toBe(99);
    expect(said.length).toBe(3);
    for (const l of said) expect(l).toMatch(/^Mrs\. Briefs: .*99 of my cookies/);
    expect(sim.errors).toEqual([]);
  });

  it('is never home while a chapter has her out on the cc_yard lawn', async () => {
    const cases: Array<[number, string[], boolean]> = [
      [0, [], true], [1, [], true], [2, [], true], [3, [], false], [4, [], true], [6, [], true],
      [7, [], true], [7, ['c07_champaDone'], false], [7, ['c07_champaDone', 'c07_departed'], true],
      [9, [], true], [12, [], true], [14, [], true], [15, [], true],
    ];
    for (const [chapter, flags, home] of cases) {
      const sim = playing('goku', chapter, flags);
      sim.start('cc_inside', 17, 3);
      await sim.tick(2);
      const inKitchen = !!sim.game.field?.npcs.some((n) => n.def.id === 'eb_cc_panchy' && !n.hidden);
      expect(inKitchen, `ch${chapter} ${flags.join(',')}`).toBe(home);
      sim.start('cc_yard', 21, 8);
      await sim.tick(2);
      const onLawn = !!sim.game.field?.npcs.some((n) => n.def.sprite === 'panchy' && !n.hidden);
      expect(inKitchen && onLawn, `ch${chapter}: Mrs. Briefs in two places`).toBe(false);
      expect(sim.errors).toEqual([]);
    }
  });
});

describe('world earthB: hub NPCs react to the character you play (LoG2 CurChar branches)', () => {
  const HUB_NPCS: Array<[string, string]> = [
    ['wc_streets', 'eb_wc_tourist'], ['wc_streets', 'eb_wc_kidA'], ['wc_streets', 'eb_wc_officer'], ['wc_streets', 'eb_wc_reporter'],
    ['cc_yard', 'eb_cc_guard'], ['cc_yard', 'eb_cc_poolbot'], ['cc_inside', 'eb_cc_receptionist'], ['cc_inside', 'eb_cc_panchy'],
  ];

  it('each busy West City / Capsule Corp NPC says something different to every main character, Mr. Satan included', async () => {
    for (const [map, npcId] of HUB_NPCS) {
      const heard = new Map<CharId, string[]>();
      for (const hero of MAIN_ROSTER) {
        const sim = playing(hero, 15);
        const said = record(sim);
        sim.start(map);
        await sim.tick(3);
        for (let i = 0; i < 5; i++) await talkTo(sim, npcId);
        heard.set(hero, said.filter((l) => !/^: You found/.test(l)));
        expect(sim.errors, `${npcId} as ${hero}`).toEqual([]);
      }
      // A line only this hero heard = a reaction to that character.
      for (const hero of MAIN_ROSTER) {
        const others = new Set(MAIN_ROSTER.filter((h) => h !== hero).flatMap((h) => heard.get(h) ?? []));
        const own = (heard.get(hero) ?? []).filter((l) => !others.has(l));
        expect(own.length, `${npcId} has no reaction to ${hero}`).toBeGreaterThan(0);
      }
      // The story-progress chatter is still reachable between reactions: some line is shared by every hero.
      const shared = (heard.get('goku') ?? []).filter((l) => MAIN_ROSTER.every((h) => heard.get(h)?.includes(l)));
      expect(shared.length, `${npcId} story chatter`).toBeGreaterThan(0);
    }
  });

  it('every earthB region has at least one character-aware NPC', async () => {
    const want: Array<[string, string]> = [['wc_shops', 'eb_shop_waiter'], ['waste_entry', 'eb_waste_geologist'], ['snow_peak', 'eb_snow_hermit'], ['cc_yard', 'eb_cc_dino']];
    for (const [map, npcId] of want) {
      const lines: string[][] = [];
      for (const hero of ['goku', 'satan'] as CharId[]) {
        const sim = playing(hero, 15);
        const said = record(sim);
        sim.start(map);
        await sim.tick(3);
        for (let i = 0; i < 2; i++) await talkTo(sim, npcId);
        lines.push(said);
        expect(sim.errors).toEqual([]);
      }
      expect(lines[0].join('|'), npcId).not.toBe(lines[1].join('|'));
    }
  });

  it('runs every earthB talk script as every playable character without errors', async () => {
    const heroes: CharId[] = [...MAIN_ROSTER, 'android17', 'frieza'];
    for (const hero of heroes) {
      for (const id of MAP_IDS) {
        const m = resolveMap(id);
        const npcs = (m?.npcs ?? []).filter((n) => n.talk.startsWith('eb_'));
        if (!npcs.length) continue;
        const sim = playing(hero, 13);
        sim.start(id);
        await sim.tick(3);
        for (const def of npcs) {
          const npc = sim.game.field?.npcs.find((n) => n.def.id === def.id);
          if (!npc) continue;
          for (let k = 0; k < 3; k++) expect(await sim.run(def.talk, { npc }), `${id}/${def.talk} as ${hero}`).toBe(true);
        }
        expect(sim.errors, `${id} as ${hero}`).toEqual([]);
      }
    }
  });
});

describe('world earthB: Capsule Corp garden', () => {
  /** The chapter stage: party lawn rows 15-25 (to the top of the fences), between the corner lamps. */
  const STAGE = { x: 7 * 16, y: 15 * 16, w: (38.5 - 7) * 16, h: (25.5 - 15) * 16 };
  const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function baseSolids(): Array<{ kind: string; x: number; y: number; w: number; h: number }> {
    const out: Array<{ kind: string; x: number; y: number; w: number; h: number }> = [];
    for (const pl of MAPS.cc_yard.props ?? []) {
      const [kind, x, y] = Array.isArray(pl) ? pl : [pl.kind, pl.x, pl.y];
      const art = propArt(kind);
      if (art.solid) out.push({ kind, x: x * 16 + art.solid.x, y: y * 16 + art.solid.y, w: art.solid.w, h: art.solid.h });
    }
    return out;
  }

  it('dresses the lawn with a patio, walkways and flowerbeds (no big empty grass field)', () => {
    const g = parseGrid(MAPS.cc_yard);
    let dressed = 0;
    for (let y = 15; y <= 27; y++) for (let x = 6; x <= 39; x++) if (g[y][x] !== 'grass') dressed++;
    expect(dressed).toBeGreaterThan(120);
    // Largest connected patch of plain grass on the lawn (the barren-region audit measured 108 before the garden).
    const seen = new Set<number>();
    let largest = 0;
    for (let y = 15; y <= 27; y++) for (let x = 6; x <= 39; x++) {
      if (g[y][x] !== 'grass' || seen.has(y * 64 + x)) continue;
      let n = 0;
      const stack = [[x, y]];
      seen.add(y * 64 + x);
      while (stack.length) {
        const [a, b] = stack.pop() ?? [0, 0];
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = a + dx;
          const d = b + dy;
          if (c < 6 || c > 39 || d < 15 || d > 27 || g[d][c] !== 'grass' || seen.has(d * 64 + c)) continue;
          seen.add(d * 64 + c);
          stack.push([c, d]);
        }
      }
      largest = Math.max(largest, n);
    }
    expect(largest).toBeLessThanOrEqual(75);
    const kinds = new Set((MAPS.cc_yard.props ?? []).map((p) => (Array.isArray(p) ? p[0] : p.kind)));
    for (const k of ['fountain', 'fenceH', 'fenceV', 'car', 'flowers']) expect(kinds.has(k), k).toBe(true);
  });

  it('keeps every solid prop off the party stage, so no chapter NPC stands inside one', () => {
    const solids = baseSolids();
    for (const s of solids) expect(hits(s, STAGE), `${s.kind} at ${s.x / 16},${s.y / 16}`).toBe(false);
    for (const n of resolveMap('cc_yard')?.npcs ?? []) {
      if (n.id === 'eb_cc_dino') continue;
      const box = { x: n.x * 16 + 3, y: n.y * 16 + 8, w: 10, h: 6 };
      for (const s of solids) expect(hits(box, s), `${n.id} @${n.x},${n.y} inside ${s.kind}`).toBe(false);
    }
  });

  it('the baby dinosaur stays in its pen and can be talked to', async () => {
    const sim = playing('goku', 6);
    const said = record(sim);
    sim.start('cc_yard', 34, 24);
    sim.game.allowControl = true;
    for (let i = 0; i < 20; i++) {
      await sim.tick(60);
      const d = sim.game.field?.npcs.find((n) => n.def.id === 'eb_cc_dino');
      if (!d) throw new Error('no dino');
      expect(d.x > 32 * 16 + 6 && d.x < 38 * 16 + 1 && d.y > 25 * 16 + 14 && d.y <= 27 * 16 + 8, `dino at ${d.x},${d.y}`).toBe(true);
    }
    // Reachable over the top fence: stand on the lawn just above it, face down, press A.
    const f = sim.game.field;
    const d = f?.npcs.find((n) => n.def.id === 'eb_cc_dino');
    if (!f || !d) throw new Error('no field');
    d.paused = true;
    d.x = 34.5 * 16 + 8;
    d.y = 26 * 16 + 14;
    f.player.x = d.x;
    f.player.y = 25 * 16 + 8;
    f.player.dir = 'down';
    expect(f.tryInteract(), 'talk over the fence').toBe(true);
    await sim.tick(200);
    for (let i = 0; i < 3; i++) await talkTo(sim, 'eb_cc_dino');
    expect(said.some((l) => /sleeve/.test(l)), 'reacts to Goku').toBe(true);
    expect(sim.errors).toEqual([]);
  });
});
