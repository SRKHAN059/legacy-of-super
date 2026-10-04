import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/content/registry';
import { SCRIPTS } from '../../src/game/script';
import type { CharId } from '../../src/content/characters';
import { Sim } from '../sim';

/**
 * Act 2 (chapters 3-5) chain test: drives every gold-quest beat headlessly from a fresh save at chapter 3
 * through the c06_start handoff, then runs every act 2 NPC talk script in its chapter.
 */

const MAX = 120000;

/** Tick until no script holds the controls (onEnter cutscenes finished). */
async function settle(sim: Sim, max = 40000): Promise<void> {
  for (let i = 0; i < max && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
  await sim.tick(2);
}

async function enter(sim: Sim, map: string, x?: number, y?: number): Promise<void> {
  sim.start(map, x, y);
  await sim.tick(3);
  await settle(sim);
}

async function run(sim: Sim, script: string): Promise<void> {
  expect(await sim.run(script, {}, MAX), `${script} did not finish`).toBe(true);
  expect(sim.errors, `${script} errors`).toEqual([]);
}

async function talk(sim: Sim, map: string, npcId: string): Promise<void> {
  const f = sim.game.field;
  if (!f || f.def.id !== map) await enter(sim, map);
  const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
  expect(npc, `${npcId} should be on ${map}`).toBeTruthy();
  if (!npc) return;
  expect(await sim.run(npc.def.talk, { npc }, MAX), `${npcId} talk did not finish`).toBe(true);
  expect(sim.errors, `${npcId} errors`).toEqual([]);
}

/** Walk onto a visible pickup (or examine a hidden one) and wait for the item box. */
async function collect(sim: Sim, map: string, pickupId: string): Promise<void> {
  const def = resolveMap(map)?.pickups?.find((p) => p.id === pickupId);
  expect(def, `pickup ${pickupId} on ${map}`).toBeTruthy();
  if (!def) return;
  await enter(sim, map, def.x, def.hidden ? def.y - 1 : def.y);
  const f = sim.game.field;
  if (!f) return;
  f.player.x = def.x * 16 + 8;
  f.player.y = (def.hidden ? def.y - 1 : def.y) * 16 + 14;
  f.player.dir = 'down';
  if (def.hidden) f.tryInteract();
  for (let i = 0; i < 400 && !sim.game.state.flag(`pickup:${pickupId}`); i += 10) await sim.tick(10);
  await settle(sim);
  expect(sim.game.state.flag(`pickup:${pickupId}`), `collected ${pickupId}`).toBe(true);
}

describe('act 2: chapters 3-5 chain', () => {
  it('plays Battle of Gods, Student of the Angel and Resurrection F through to the c06 handoff', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    const orig06 = SCRIPTS.c06_start;
    SCRIPTS.c06_start = async (s) => { s.set('test_c06Called'); };
    try {
      // ---------------------------------------------------------------- Chapter 3: opening
      await enter(sim, 'cc_yard', 22, 21);
      await run(sim, 'c03_start');
      expect(st.data.chapter).toBe(3);
      expect(st.data.active).toBe('goku');
      expect(st.char('goku').level).toBeGreaterThanOrEqual(12);
      expect(st.char('vegeta').joined).toBe(true);
      expect(st.count('dragonRadar')).toBe(1);
      expect(st.data.journal.c03_dragonballs).toBe('active');
      expect(st.flag('c03_vaultLocked')).toBe(true);
      expect(st.flag('noSwitch')).toBe(false);
      expect(st.data.regions).toEqual(expect.arrayContaining(['spot_desert', 'spot_lookout', 'spot_kame', 'spot_satancity']));

      await talk(sim, 'cc_yard', 'c03_panchy');
      expect(st.count('c03_bento')).toBe(1);
      await talk(sim, 'cc_yard', 'c03_bulma');

      // ---------------------------------------------------------------- the hunt
      await collect(sim, 'desert_oasis', 'c03_db1');
      expect(st.count('db1')).toBe(1);

      // Pilaf's castle: the vault is sealed; the basement levers open it.
      await enter(sim, 'pilaf_castle_in', 15, 9);
      await run(sim, 'c03_gate_note');
      expect(st.data.journal.c03_vault).toBe('active');
      expect(sim.game.field?.map.gates.find((g) => g.def.id === 'c03_vaultGate')?.broken).toBe(false);
      await enter(sim, 'c03_pilaf_vault', 4, 17);
      await run(sim, 'c03_memo');
      expect(st.count('c03_memo')).toBe(1);
      sim.choice = 0;
      await run(sim, 'c03_lever_sun'); // wrong first lever: alarm + reset
      expect(st.flag('c03_lever_sun')).toBe(false);
      expect(st.get('c03_leverStep')).toBe(0);
      for (const l of ['moon', 'sun', 'dragon', 'pilaf']) await run(sim, `c03_lever_${l}`);
      expect(st.flag('c03_vaultOpen')).toBe(true);
      expect(st.flag('c03_vaultLocked')).toBe(false);
      await enter(sim, 'pilaf_castle_in', 15, 9);
      expect(sim.game.field?.map.gates.find((g) => g.def.id === 'c03_vaultGate')?.broken).toBe(true);
      await collect(sim, 'pilaf_castle_in', 'c03_db2');
      await run(sim, 'c03_mk2_ambush');
      expect(st.flag('defeated:c03_mk2')).toBe(true);
      expect(st.count('db2') + st.count('db3')).toBe(2);
      await run(sim, 'c03_mk2_phase2');

      // Satan City: the Champion Orb for a pudding.
      await talk(sim, 'satan_mansion', 'c03_satan');
      expect(st.data.journal.c03_champion).toBe('active');
      await talk(sim, 'satan_plaza', 'c03_pastry');
      expect(st.count('c03_pudding')).toBe(1);
      await talk(sim, 'satan_mansion', 'c03_satan');
      expect(st.count('db5')).toBe(1);
      expect(st.data.journal.c03_champion).toBe('done');

      // Kame House: the buried four-star ball.
      await talk(sim, 'kame_island', 'c03_roshi');
      await collect(sim, 'kame_island', 'c03_db4');
      expect(st.count('db4')).toBe(1);

      // Korin Forest and the Lookout.
      await talk(sim, 'korin_base', 'c03_yajirobe');
      expect(st.count('db6')).toBe(1);
      expect(st.count('c03_bento')).toBe(0);
      expect(st.data.journal.c03_dragonballs).toBe('active');
      await talk(sim, 'lookout', 'c03_dende');
      expect(st.count('db7')).toBe(1);
      expect(st.data.journal.c03_dragonballs).toBe('done');
      expect(st.data.journal.c03_summon).toBe('active');

      // ---------------------------------------------------------------- ritual + Beerus
      await talk(sim, 'cc_yard', 'c03_bulma');
      expect(st.flag('c03_ritualDone')).toBe(true);
      expect(st.char('goku').form).toBe('ssg');
      expect(st.count('db1')).toBe(0);
      expect(st.data.journal.c03_summon).toBe('done');
      expect(st.data.journal.c03_beerus).toBe('active');
      expect(sim.game.field?.def.id).toBe('c03_sky_sea');

      // "Give me a minute": back to the lawn, then Bulma flies Goku back to the arena.
      sim.choice = 1;
      await run(sim, 'c03_battle');
      expect(sim.game.field?.def.id).toBe('cc_yard');
      expect(st.flag('c03_beerusDone')).toBe(false);
      expect(st.flag('noSwitch')).toBe(false);
      sim.choice = 0;
      await talk(sim, 'cc_yard', 'c03_bulma');
      expect(sim.game.field?.def.id).toBe('c03_sky_sea');
      const expBefore = st.char('goku').exp;
      await run(sim, 'c03_battle');
      expect(st.flag('c03_beerusDone')).toBe(true);
      expect(st.char('goku').exp).toBeGreaterThan(expBefore);
      expect(st.char('goku').techs).toContain('godKamehameha');
      expect(st.data.journal.c03_beerus).toBe('done');
      expect(st.flag('ea_yajirobeAway')).toBe(false);
      // c03 ending hands straight into chapter 4.
      expect(st.data.chapter).toBe(4);
      expect(st.data.active).toBe('vegeta');
      expect(st.flag('noSwitch')).toBe(true);
      expect(st.data.journal.c04_whis).toBe('active');
      expect(st.char('vegeta').level).toBeGreaterThanOrEqual(15);

      // ---------------------------------------------------------------- Chapter 4
      await enter(sim, 'cc_inside', 15, 3);
      await run(sim, 'c04_stash');
      expect(st.count('c04_ramen')).toBe(1);
      await talk(sim, 'cc_yard', 'c04_bulma');
      await talk(sim, 'cc_yard', 'c04_whis');
      expect(st.data.journal.c04_whis).toBe('done');
      expect(st.data.journal.c04_training).toBe('active');
      expect(st.data.journal.c04_delicacies).toBe('active');
      expect(st.data.regions).toEqual(expect.arrayContaining(['spot_beerus', 'spot_space_earth']));
      expect(sim.game.field?.def.id).toBe('c04_whis_field');

      // Chores: three water jars (carry), three boulders, the spoon.
      await settle(sim);
      for (let i = 0; i < 3; i++) {
        await run(sim, 'c04_jar_fill');
        expect(sim.game.field?.carrying).toBeTruthy();
        await run(sim, 'c04_jar_deliver');
        expect(sim.game.field?.carrying).toBeNull();
      }
      expect(st.flag('c04_jarsDone')).toBe(true);
      await run(sim, 'c04_jar_fill');
      await run(sim, 'c04_jar_broke');
      await talk(sim, 'c04_whis_field', 'c04_fieldWhis'); // progress report: boulders + spoon missing
      expect(st.flag('c04_whisHit')).toBe(false);
      for (const id of ['c04_rock1', 'c04_rock2', 'c04_rock3']) st.set(`broke:c04_whis_field:${id}`);
      await run(sim, 'c04_critter_caught');
      expect(st.count('c04_spoon')).toBe(1);
      // Whis fight -> Goku arrives -> spar -> Hell -> chapter 5.
      await talk(sim, 'c04_whis_field', 'c04_fieldWhis');
      expect(st.flag('c04_whisHit')).toBe(true);
      expect(st.data.journal.c04_training).toBe('done');
      expect(st.data.journal.c04_spar).toBe('done');
      expect(st.flag('c04_spoonReturned')).toBe(true);
      expect(st.char('goku').outfit).toBe('gokuWhis');
      expect(st.flag('c04_done')).toBe(true);

      // ---------------------------------------------------------------- Chapter 5
      expect(st.data.chapter).toBe(5);
      expect(st.char('gohan').joined).toBe(true);
      expect(st.char('gohan').level).toBe(16);
      expect(st.char('gohan').techs).toContain('masenko');
      expect(st.data.active).toBe('gohan');
      expect(st.char('gohan').outfit).toBe('gohanSuit');
      expect(st.data.journal.c05_army).toBe('active');
      expect(st.data.regions).toContain('spot_wasteland');
      expect(st.count('senzu')).toBeGreaterThanOrEqual(2);
      await talk(sim, 'cc_yard', 'c05_bulma');
      await talk(sim, 'cc_yard', 'c05_jacoNpc');

      await enter(sim, 'waste_entry', 3, 15); // onEnter: the team assembles
      expect(st.flag('c05_assembled')).toBe(true);
      expect(st.char('piccolo').joined).toBe(true);
      expect(st.char('piccolo').level).toBe(18);
      expect(st.char('gohan').outfit).toBeUndefined();
      expect(st.data.active).toBe('gohan');
      await run(sim, 'c05_wave1');
      expect(st.flag('c05_wave1')).toBe(true);

      await enter(sim, 'waste_canyon', 2, 13);
      await run(sim, 'c05_wave2');
      expect(st.flag('c05_wave2')).toBe(true);
      await run(sim, 'c05_shisami');
      expect(st.flag('c05_shisamiDone')).toBe(true);
      expect(st.data.active).toBe('piccolo');
      expect(st.flag('noSwitch')).toBe(true);
      expect(st.char('piccolo').techs).toContain('specialBeamCannon');
      expect(st.char('piccolo').form).toBe('unweighted');
      expect(st.data.journal.c05_army).toBe('done');
      expect(st.data.journal.c05_mesa).toBe('active');

      await enter(sim, 'waste_mesa', 22, 31);
      await run(sim, 'c05_wave3');
      expect(st.flag('c05_wave3')).toBe(true);
      await run(sim, 'c05_ginyu');
      expect(st.flag('c05_ginyuDone')).toBe(true);
      expect(st.char('gohan').form).toBe('ssj');
      expect(st.flag('c05_done')).toBe(true);
      expect(st.data.journal.c05_mesa).toBe('done');
      expect(st.flag('noSwitch')).toBe(false);
      expect(st.flag('test_c06Called')).toBe(true);

      // ---------------------------------------------------------------- side quests
      // Master Roshi's charged melee (each student talks once).
      for (const id of ['goku', 'vegeta', 'gohan', 'piccolo'] as CharId[]) {
        await enter(sim, 'kame_island', 25, 15);
        sim.game.switchCharacter(id);
        await talk(sim, 'kame_island', 'c05_roshi');
        expect(st.char(id).charged, `${id} charged`).toBe(true);
      }
      expect(st.data.journal.c05_roshi).toBe('done');
      // Whis's 25 delicacies (Capsule Corp Whis is back after chapter 5).
      st.data.chapter = 6;
      st.give('delicacy', 25, 25);
      await talk(sim, 'cc_yard', 'c04_whis');
      expect(st.count('whisStaff')).toBe(1);
      expect(st.count('end3')).toBeGreaterThanOrEqual(1);
      expect(st.data.journal.c04_delicacies).toBe('done');
      expect(sim.errors).toEqual([]);
    } finally {
      if (orig06) SCRIPTS.c06_start = orig06; else delete SCRIPTS.c06_start;
    }
  }, 600000);

  it('runs every act 2 NPC talk script in its chapter', async () => {
    const maps = ['cc_yard', 'cc_inside', 'satan_mansion', 'satan_plaza', 'kame_island', 'korin_base', 'lookout', 'beerus_grounds',
      'beerus_palace_in', 'paozu_home', 'paozu_valley', 'gohan_house', 'waste_mesa', 'c03_sky_sea', 'c04_whis_field'];
    let ran = 0;
    for (const chapter of [3, 4, 5, 6]) {
      for (const map of maps) {
        const def = resolveMap(map);
        if (!def) continue;
        for (const n of def.npcs ?? []) {
          if (!/^c0[345]_/.test(n.id)) continue;
          const sim = new Sim();
          sim.game.state.data.chapter = chapter;
          for (const c of ['goku', 'vegeta'] as CharId[]) sim.game.state.join(c, 15);
          sim.game.state.data.active = 'goku';
          sim.game.state.set('c05_called');
          sim.game.state.set('c03_ritualDone');
          sim.game.state.set('c05_wave3');
          await enter(sim, map, n.x, n.y + 1);
          const npc = sim.game.field?.npcs.find((x) => x.def.id === n.id);
          if (!npc) continue; // gated out for this chapter
          sim.choice = 2;
          expect(await sim.run(n.talk, { npc }, MAX), `${map}/${n.id} ch${chapter}`).toBe(true);
          expect(sim.errors, `${map}/${n.id} ch${chapter}`).toEqual([]);
          ran++;
        }
      }
    }
    expect(ran).toBeGreaterThan(30);
  }, 600000);
});
