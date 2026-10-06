import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { ITEMS } from '../../src/content/items';
import { TILE } from '../../src/engine/constants';
import type { CharId } from '../../src/content/characters';
import type { MapDef } from '../../src/game/mapdef';
import { Sim } from '../sim';

/** World builder C: Future Earth, space hubs, the Tournament of Power stage and Hell. */
const FAR_C = [
  'future_city', 'future_highway', 'future_hideout_out', 'future_hideout_in', 'future_cc_ruins',
  'kingkai_planet', 'beerus_grounds', 'beerus_palace_in', 'u10_sacred', 'zeno_palace',
  'top_arena_a', 'top_arena_b', 'top_arena_c', 'hell_lake',
];

function def(id: string): MapDef {
  const m = resolveMap(id);
  if (!m) throw new Error(`missing map ${id}`);
  return m;
}

function setup(sim: Sim, chapter: number, char: CharId = 'goku', level = 20): void {
  sim.game.state.data.chapter = chapter;
  sim.game.state.join(char, level);
  sim.game.state.data.active = char;
}

/** True when the player's feet box overlaps something solid on the current field. */
function stuck(sim: Sim): boolean {
  const f = sim.game.field;
  if (!f) return true;
  return f.col.blocked(f.player.box());
}

/** Tick until the field shows map `id` and its fade-in has finished. */
async function waitForMap(sim: Sim, id: string, max = 240): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await sim.tick(1);
    const f = sim.game.field;
    if (f?.def.id === id && f.fade === 0) return true;
  }
  return false;
}

describe('world farC: maps load at every relevant chapter', () => {
  for (const id of FAR_C) {
    it(`${id} runs 30 frames at chapters 0/4/7/9/11/13/14`, async () => {
      for (const ch of [0, 4, 7, 9, 11, 13, 14]) {
        const sim = new Sim();
        setup(sim, ch);
        sim.start(id);
        await sim.tick(30);
        expect(sim.errors, `${id} @ch${ch}`).toEqual([]);
        expect(sim.game.field?.def.id).toBe(id);
      }
    });
  }

  it('hostile maps field the right enemy tiers', async () => {
    const count = async (id: string, ch: number) => {
      const sim = new Sim();
      setup(sim, ch);
      sim.start(id);
      return (sim.game.field?.enemies ?? []).map((e) => e.def.id);
    };
    // Prologue Trunks (L6) only meets T1/T2 robots in the ruins; Ch9+ swaps in T5 patrols.
    const pro = await count('future_city', 0);
    expect(pro).toContain('fc_scavDrone');
    expect(pro).not.toContain('fc_hunterDrone');
    for (const id of ['future_city', 'future_highway', 'future_cc_ruins']) expect(await count(id, 0), id).not.toContain('greenDrone');
    const late = await count('future_city', 9);
    expect(late).toContain('fc_hunterDrone');
    expect(late).not.toContain('fc_scavDrone');
    expect(await count('future_city', 11)).toContain('redMech');
    // Beerus's planet is peaceful before Ch4, T3 critters Ch4-6, T4/T5 from Ch7.
    expect(await count('beerus_grounds', 3)).toEqual([]);
    expect(await count('beerus_grounds', 4)).toContain('fc_mossBeast');
    expect(await count('beerus_grounds', 7)).toContain('fc_hornBeast');
    // Hell: fire bats early, inferno bats + lava oozes from Ch13.
    expect(await count('hell_lake', 5)).toContain('fireBat');
    expect(await count('hell_lake', 13)).toContain('fc_lavaOoze');
    // Tournament rivals only during the tournament, and a chapter can clear them.
    expect(await count('top_arena_b', 13)).toEqual([]);
    expect(await count('top_arena_b', 14)).toContain('fc_topBrawler');
    const quiet = new Sim();
    setup(quiet, 14);
    quiet.game.state.set('fc_topQuiet');
    quiet.start('top_arena_b');
    expect(quiet.game.field?.enemies.length).toBe(0);
  });
});

describe('world farC: landing spots', () => {
  it('registers the Guide §8 spots on walkable tiles', async () => {
    const expected: Record<string, [string, number, number]> = {
      spot_future_city: ['future', 150, 118], spot_future_base: ['future', 120, 140],
      spot_kingkai: ['space', 70, 70], spot_beerus: ['space', 128, 120], spot_u10: ['space', 80, 186],
      spot_zeno: ['space', 188, 186], spot_space_earth: ['space', 128, 200],
    };
    for (const [id, [world, x, y]] of Object.entries(expected)) {
      const s = SPOTS[id];
      expect(s, id).toBeTruthy();
      expect([s.world, s.x, s.y], id).toEqual([world, x, y]);
      if (s.toWorld) { expect(s.toWorld).toBe('earth'); continue; }
      const sim = new Sim();
      setup(sim, 9);
      sim.game.startField(s.map, s.tx, s.ty, 'down');
      await sim.tick(5);
      expect(stuck(sim), `${id} lands blocked`).toBe(false);
      // Every landing map has a world sign so the player can leave again.
      expect(def(s.map).objects?.some((o) => o.type === 'worldSign'), `${id} world sign`).toBe(true);
    }
  });
});

describe('world farC: traversal', () => {
  it('every door/stairs warp delivers the player to its destination on open ground', async () => {
    for (const id of FAR_C) {
      for (const w of def(id).warps ?? []) {
        const sim = new Sim();
        setup(sim, 9);
        sim.start(id, w.x, w.y);
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

  it('edge exits chain hideout_out <-> highway <-> city <-> cc_ruins and the three ToP sections', async () => {
    const chain: Array<[string, 'north' | 'south' | 'east' | 'west', string]> = [
      ['future_hideout_out', 'east', 'future_highway'], ['future_highway', 'west', 'future_hideout_out'],
      ['future_highway', 'east', 'future_city'], ['future_city', 'west', 'future_highway'],
      ['future_city', 'north', 'future_cc_ruins'], ['future_cc_ruins', 'south', 'future_city'],
      ['top_arena_a', 'east', 'top_arena_b'], ['top_arena_b', 'west', 'top_arena_a'],
      ['top_arena_b', 'east', 'top_arena_c'], ['top_arena_c', 'west', 'top_arena_b'],
    ];
    for (const [from, side, to] of chain) {
      const m = def(from);
      expect(m.exits?.[side]?.to, `${from} ${side}`).toBe(to);
      const W = m.grid[0].length;
      const H = m.grid.length;
      // Try every open tile along that edge: each must lead to open ground on the other side.
      const tiles: Array<[number, number]> = [];
      for (let i = 0; i < (side === 'east' || side === 'west' ? H : W); i++) {
        const tx = side === 'east' ? W - 1 : side === 'west' ? 0 : i;
        const ty = side === 'south' ? H - 1 : side === 'north' ? 0 : i;
        tiles.push([tx, ty]);
      }
      let crossed = 0;
      for (const [tx, ty] of tiles) {
        const sim = new Sim();
        setup(sim, 14);
        sim.game.state.set('fc_topQuiet');
        sim.game.startField(from, tx, ty, 'down');
        const f = sim.game.field;
        if (!f || f.col.blocked(f.player.box())) continue;
        if (side === 'east') f.player.x = W * TILE - 6;
        if (side === 'west') f.player.x = 6;
        if (side === 'north') f.player.y = 7;
        if (side === 'south') f.player.y = H * TILE - 1;
        if (f.col.blocked(f.player.box())) continue;
        const key = side === 'east' ? 'right' : side === 'west' ? 'left' : side === 'north' ? 'up' : 'down';
        sim.input.inject(key, true);
        const ok = await waitForMap(sim, to);
        sim.input.inject(key, false);
        expect(ok, `${from} ${side} edge at ${tx},${ty} -> ${to}`).toBe(true);
        await sim.tick(2);
        expect(stuck(sim), `${from} ${side} edge at ${tx},${ty} lands blocked in ${to}`).toBe(false);
        crossed++;
      }
      expect(crossed, `${from} ${side} has an opening`).toBeGreaterThan(2);
    }
  });

  it('flight circles land on open ground', async () => {
    for (const id of FAR_C) {
      for (const o of def(id).objects ?? []) {
        if (o.type !== 'flight') continue;
        const sim = new Sim();
        setup(sim, 9);
        sim.start(id, o.x, o.y);
        await sim.tick(2);
        void sim.game.flyTo(o.to, o.tx, o.ty);
        await sim.tick(80);
        expect(sim.game.field?.def.id).toBe(o.to);
        expect(stuck(sim), `${id} flight ${o.x},${o.y} lands blocked`).toBe(false);
      }
    }
  });
});

describe('world farC: ambient NPCs and collectibles', () => {
  const talks: Array<[string, string]> = [
    ['future_hideout_out', 'fc_talk_lookout'], ['future_hideout_in', 'fc_talk_medic'],
    ['future_hideout_in', 'fc_talk_tamo'], ['future_hideout_in', 'fc_talk_kiko'], ['beerus_grounds', 'fc_talk_oracle'],
  ];
  for (const [map, script] of talks) {
    it(`${script} runs cleanly across chapters and characters`, async () => {
      for (const [ch, char] of [[0, 'trunks'], [4, 'goku'], [9, 'trunks'], [10, 'vegeta'], [11, 'trunks']] as Array<[number, CharId]>) {
        const sim = new Sim();
        setup(sim, ch, char, 30);
        sim.start(map);
        await sim.tick(3);
        const npc = sim.game.field?.npcs.find((n) => n.def.talk === script);
        for (let i = 0; i < 4; i++) expect(await sim.run(script, npc ? { npc } : {}), `${script} @ch${ch}`).toBe(true);
        expect(sim.errors, `${script} @ch${ch}`).toEqual([]);
      }
    });
  }

  it('Medic Sora patches the hero up', async () => {
    const sim = new Sim();
    setup(sim, 0, 'trunks', 6);
    sim.start('future_hideout_in');
    await sim.tick(3);
    sim.game.state.hero.hp = 1;
    expect(await sim.run('fc_talk_medic')).toBe(true);
    expect(sim.game.state.hero.hp).toBe(sim.game.state.hero.hpMax);
  });

  it('places the 7 far-region Delicacies and the stat capsules', () => {
    const dels: string[] = [];
    const caps: string[] = [];
    for (const id of FAR_C) {
      const m = def(id);
      for (const p of m.pickups ?? []) if (p.item === 'delicacy') dels.push(p.id);
      for (const o of m.objects ?? []) {
        if (o.type === 'chest' && o.item === 'delicacy') dels.push(o.id);
        if (o.type === 'chest' && ITEMS[o.item]?.kind === 'capsule') caps.push(`${o.id}:${o.item}`);
      }
    }
    expect(dels.sort()).toEqual([
      'del_beerus_grounds_1', 'del_beerus_palace_in_1', 'del_future_cc_ruins_1', 'del_future_city_1',
      'del_kingkai_planet_1', 'del_u10_sacred_1', 'del_zeno_palace_1',
    ]);
    expect(caps).toContain('fc_cap_hell_1:pow5');
    expect(caps.length).toBeGreaterThanOrEqual(8);
  });

  it('the Capsule Corp vault gate only yields to Trunks at level 34', () => {
    const gate = def('future_cc_ruins').barriers?.find((b) => b.id === 'fc_vault');
    expect(gate).toMatchObject({ character: 'trunks', level: 34 });
  });
});
