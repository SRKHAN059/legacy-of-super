import { describe, expect, it } from 'vitest';
import { MAPS, resolveMap } from '../../src/content/registry';
import { ENEMIES } from '../../src/content/enemies';
import { damage, ENEMY_POWER, MAX_LEVEL } from '../../src/game/leveling';
import { SCRIPTS } from '../../src/game/script';
import { GameState, newGame } from '../../src/game/state';
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

/** Record every dialogue / narrator line shown from now on, as "Speaker: text". */
function record(sim: Sim): string[] {
  const out: string[] = [];
  const g = sim.game;
  const say = g.say.bind(g);
  g.say = (lines) => {
    for (const l of lines) out.push(`${l.name ?? ''}: ${l.text}`);
    return say(lines);
  };
  const ask = g.ask.bind(g);
  g.ask = (prompt, options) => {
    out.push(`${prompt.name ?? ''}: ${prompt.text}`);
    return ask(prompt, options);
  };
  return out;
}

describe('act 2: chapters 3-5 chain', () => {
  it('plays Battle of Gods, Student of the Angel and Resurrection F through to the c06 handoff', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    const orig06 = SCRIPTS.c06_start;
    SCRIPTS.c06_start = async (s) => { s.set('test_c06Called'); };
    const said = record(sim);
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
      // The field's Moss Grazer roams free and can be mid-charge when a jar is filled (the save's random seed decides):
      // a jar it breaks is fetched again, as a player would.
      for (let i = 0; i < 12 && !st.flag('c04_jarsDone'); i++) {
        await run(sim, 'c04_jar_fill');
        if (!sim.game.field?.carrying) continue;
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

      // Story continuity: Beerus never uses Goku's Saiyan name, and (as in episode 17) Pan is born before Goku
      // borrows Bulma's phone and stows away on Whis - chapter 5 does not announce the birth a second time.
      expect(said.filter((l) => l.startsWith('Beerus:') && /Kakarot/.test(l))).toEqual([]);
      const born = said.findIndex((l) => /gave birth/.test(l));
      const stowaway = said.findIndex((l) => /lend me your phone|stowaway/i.test(l));
      expect(born, 'Pan\'s birth is narrated').toBeGreaterThanOrEqual(0);
      expect(stowaway, 'Goku stows away on Whis').toBeGreaterThan(born);
      expect(said.filter((l) => /gave birth/.test(l))).toHaveLength(1);
      const jaco = said.findIndex((l) => /Frieza has been brought back to life/.test(l));
      expect(jaco).toBeGreaterThan(stowaway);

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

// ---------------------------------------------------------------- mid-fight re-entry (robustness)

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/**
 * Manual driver for mid-fight tests: advances dialogue and choices like the Sim bot and keeps the hero's HP full,
 * but never touches the enemies, so a fight stays open while the test moves the hero around.
 */
async function drive(sim: Sim, frames: number, until?: () => boolean): Promise<boolean> {
  const g = sim.game;
  let press = false;
  for (let i = 0; i < frames; i++) {
    if (until?.()) return true;
    const top = g.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|BeamStruggle|Choice/.test(top)) {
      if (/Choice/.test(top)) (g.scenes.top as unknown as { sel: number }).sel = 0;
      press = !press;
      sim.input.inject('A', press);
    } else {
      press = false;
      sim.input.inject('A', false);
    }
    const f = g.field;
    if (f) f.player.cs.hp = f.player.cs.hpMax;
    sim.input.poll();
    g.scenes.update(sim.input);
    await flush();
  }
  return until?.() ?? false;
}

/** Start `id` (as a trigger or NPC would) and drive until it hands control over for its fight against `uid`. */
async function toFight(sim: Sim, id: string, uid: string): Promise<void> {
  void sim.game.runScript(id);
  const live = () => sim.game.allowControl && !!sim.game.field?.enemies.some((e) => e.uid === uid && !e.dead);
  expect(await drive(sim, 20000, live), `${id} reaches the ${uid} fight`).toBe(true);
}

/** Put the hero on a tile and let a few frames run (triggers react). */
async function stepTo(sim: Sim, x: number, y: number): Promise<void> {
  const p = sim.game.field?.player;
  if (!p) throw new Error('no field');
  p.x = x * 16 + 8;
  p.y = y * 16 + 14;
  await drive(sim, 4);
}

/** Highest number of live enemies sharing one uid that starts with `prefix` (2+ = a duplicated spawn). */
function maxCopies(sim: Sim, prefix: string): number {
  const n = new Map<string, number>();
  for (const e of sim.game.field?.enemies ?? []) {
    if (!e.uid?.startsWith(prefix) || e.dead) continue;
    n.set(e.uid, (n.get(e.uid) ?? 0) + 1);
  }
  return Math.max(0, ...n.values());
}

/** Live enemies whose uid starts with `prefix`. */
function liveWith(sim: Sim, prefix: string): number {
  return sim.game.field?.enemies.filter((e) => e.uid?.startsWith(prefix) && !e.dead).length ?? 0;
}

/** Finish the open fight(s) the way the Sim bot does, then let the script run to its end. */
async function finish(sim: Sim, ticks = 40000): Promise<void> {
  for (let i = 0; i < ticks && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
  expect(sim.errors).toEqual([]);
}

/** Chapter 5 state: Gohan L16 and Piccolo L18 joined, `hero` forced. */
function c05Sim(hero: CharId, flags: string[], quests: string[]): Sim {
  const sim = new Sim();
  const st = sim.game.state;
  st.data.chapter = 5;
  st.join('goku', 18);
  st.join('vegeta', 18);
  st.join('gohan', 16);
  st.join('piccolo', 18);
  st.data.active = hero;
  if (hero === 'piccolo') st.char('piccolo').form = 'unweighted';
  for (const f of ['noSwitch', 'c05_called', 'c05_assembled', 'c05_mesaSeen', ...flags]) st.set(f);
  for (const q of quests) st.addQuest(q);
  return sim;
}

/** Re-entry contract: one copy of the beat, its fight still open and the player still in control. */
function expectSingleFight(sim: Sim, prefix: string, count: number): void {
  expect(maxCopies(sim, prefix), `duplicate ${prefix} spawn`).toBe(1);
  expect(liveWith(sim, prefix)).toBe(count);
  expect(sim.game.lockDepth).toBe(1);
  expect(sim.game.fightDepth).toBe(1);
  expect(sim.game.allowControl).toBe(true);
}

/** Control is back with the player for good once the beat is over. */
function expectFree(sim: Sim): void {
  expect(sim.game.lockDepth).toBe(0);
  expect(sim.game.fightDepth).toBe(0);
  expect(sim.game.field, 'still on the field (no Game Over)').toBeTruthy();
  expect(sim.game.field?.locked, 'field unlocked').toBeFalsy();
}

describe('act 2: story fights cannot be restarted mid-fight', () => {
  it('chapter 3 Beerus: re-crossing the trigger column replays nothing and the chapter 4 handoff still runs', async () => {
    const orig04 = SCRIPTS.c04_start;
    SCRIPTS.c04_start = async (s) => { s.set('test_c04Called'); };
    try {
      const sim = new Sim();
      const st = sim.game.state;
      st.data.chapter = 3;
      st.join('goku', 15);
      st.join('vegeta', 15);
      st.data.active = 'goku';
      st.char('goku').form = 'ssg';
      for (const f of ['c03_ritualDone', 'c03_seaArrived']) st.set(f);
      st.addQuest('c03_beerus');
      sim.start('c03_sky_sea', 6, 11);
      await settle(sim);
      const said = record(sim);
      await toFight(sim, 'c03_battle', 'c03_beerus1');
      const intro = said.filter((l) => /Shall we begin/.test(l)).length;
      await stepTo(sim, 15, 11);
      await stepTo(sim, 17, 11); // Back inside c03_beerusZone (x17, y3-17).
      await stepTo(sim, 19, 11);
      await stepTo(sim, 17, 11);
      await drive(sim, 600);
      expectSingleFight(sim, 'c03_beerus1', 1);
      expect(said.filter((l) => /Shall we begin/.test(l)).length, 'Beerus intro replayed').toBe(intro);
      await finish(sim);
      expect(st.flag('c03_beerusDone')).toBe(true);
      expect(st.flag('test_c04Called')).toBe(true);
      expectFree(sim);
    } finally {
      if (orig04) SCRIPTS.c04_start = orig04; else delete SCRIPTS.c04_start;
    }
  });

  it('chapter 5 wave 1: re-entering the trigger mid-wave does not spawn a second wave', async () => {
    const sim = c05Sim('gohan', [], ['c05_army']);
    sim.start('waste_entry', 13, 15);
    await settle(sim);
    await toFight(sim, 'c05_wave1', 'c05w1_0');
    await stepTo(sim, 13, 15);
    await stepTo(sim, 16, 15); // Back inside c05_wave1T (x16-17, y3-26).
    await drive(sim, 1500);
    expectSingleFight(sim, 'c05w1_', 7);
    await finish(sim);
    expect(sim.game.state.flag('c05_wave1')).toBe(true);
    expectFree(sim);
  });

  it('chapter 5 wave 2: re-entering the trigger mid-wave does not spawn a second wave', async () => {
    const sim = c05Sim('gohan', ['c05_wave1'], ['c05_army']);
    sim.start('waste_canyon', 8, 13);
    await settle(sim);
    await toFight(sim, 'c05_wave2', 'c05w2_0');
    await stepTo(sim, 8, 13);
    await stepTo(sim, 10, 13); // Back inside c05_wave2T (x10, y10-17).
    await drive(sim, 1500);
    expectSingleFight(sim, 'c05w2_', 7);
    await finish(sim);
    expect(sim.game.state.flag('c05_wave2')).toBe(true);
    expectFree(sim);
  });

  it('chapter 5 Shisami: standing in (and re-entering) the trigger band does not spawn a second Shisami', async () => {
    const sim = c05Sim('gohan', ['c05_wave1', 'c05_wave2'], ['c05_army']);
    sim.start('waste_canyon', 19, 4);
    await settle(sim);
    // The beat puts Gohan at (22,4), inside c05_shisamiT (x22, y2-6), before handing over control.
    await toFight(sim, 'c05_shisami', 'c05_shisami1');
    await drive(sim, 60);
    await stepTo(sim, 20, 4);
    await stepTo(sim, 22, 4);
    await drive(sim, 600);
    expectSingleFight(sim, 'c05_shisami1', 1);
    await finish(sim);
    const st = sim.game.state;
    expect(st.flag('c05_shisamiDone')).toBe(true);
    expect(st.data.active).toBe('piccolo');
    expectFree(sim);
  });

  it('chapter 5 wave 3: re-entering the trigger row mid-wave does not spawn a second wave', async () => {
    const sim = c05Sim('piccolo', ['c05_wave1', 'c05_wave2', 'c05_shisamiDone'], ['c05_mesa']);
    sim.start('waste_mesa', 22, 29);
    await settle(sim);
    await toFight(sim, 'c05_wave3', 'c05w3_0');
    await stepTo(sim, 22, 29);
    await stepTo(sim, 22, 27); // Back inside c05_wave3T (x2-43, y27).
    await drive(sim, 1500);
    expectSingleFight(sim, 'c05w3_', 8);
    await finish(sim);
    expect(sim.game.state.flag('c05_wave3')).toBe(true);
    expectFree(sim);
  });

  it('chapter 5 Ginyu: crossing Tagoma\'s trigger band mid-fight does not spawn a second Ginyu', async () => {
    const orig06 = SCRIPTS.c06_start;
    SCRIPTS.c06_start = async (s) => { s.set('test_c06Called'); };
    try {
      const sim = c05Sim('piccolo', ['c05_wave1', 'c05_wave2', 'c05_shisamiDone', 'c05_wave3'], ['c05_mesa']);
      sim.start('waste_mesa', 24, 19);
      await settle(sim);
      await toFight(sim, 'c05_ginyu', 'c05_ginyu1');
      await stepTo(sim, 24, 16); // Into c05_tagomaT (x20-28, y15-16), toward the boss.
      await stepTo(sim, 24, 19);
      await stepTo(sim, 24, 16);
      await drive(sim, 600);
      expectSingleFight(sim, 'c05_ginyu1', 1);
      await finish(sim);
      const st = sim.game.state;
      expect(st.flag('c05_ginyuDone')).toBe(true);
      expect(st.flag('c05_done')).toBe(true);
      expect(st.flag('test_c06Called')).toBe(true);
      expectFree(sim);
    } finally {
      if (orig06) SCRIPTS.c06_start = orig06; else delete SCRIPTS.c06_start;
    }
  });
});

// ---------------------------------------------------------------- chapter 5 balance

/** Play a script out with the player's real HP: dialogue advances and enemies fall at once, but HP is never topped up. */
async function playOut(sim: Sim, id: string, frames = 40000): Promise<boolean> {
  const g = sim.game;
  let done = false;
  void g.runScript(id).then(() => { done = true; });
  let press = false;
  for (let i = 0; i < frames && !done; i++) {
    const top = g.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|BeamStruggle|Choice/.test(top)) {
      if (/Choice/.test(top)) (g.scenes.top as unknown as { sel: number }).sel = 0;
      press = !press;
      sim.input.inject('A', press);
    } else {
      press = false;
      sim.input.inject('A', false);
    }
    const f = g.field;
    if (f && g.allowControl) {
      for (const e of f.enemies) {
        if (e.dead || e.state === 'dying' || e.def.invulnerable || e.ended) continue;
        f.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
      }
      if (f.timer) f.timer.frames = 0;
    }
    sim.input.poll();
    g.scenes.update(sim.input);
    await flush();
  }
  return done;
}

/** Average damage of one enemy ki shot against a defender's END (all 26 damage rolls). */
function shotDamage(enemy: string, end: number): number {
  const e = ENEMIES[enemy];
  const mult = e.shot?.mult ?? 0.8;
  let total = 0;
  for (let r = 0; r < 26; r++) total += damage({ power: ENEMY_POWER, mult, stat: e.pow, end, res: 1, crit: false, r26: r });
  return total / 26;
}

/** Sustained damage per second of a shooter that fires on cooldown (the AI adds 0-30 random frames). */
function shotDps(enemy: string, end: number): number {
  const cd = ENEMIES[enemy].shot?.cooldown ?? 90;
  return (shotDamage(enemy, end) * 60) / (cd + 15);
}

describe('act 2: chapter 5 waves are not the hardest regular fights in the game', () => {
  it('the Frieza Force officer hits about as hard as a grunt instead of out-damaging two of them', () => {
    // Level-up stats are random rolls: judge the typical hero over a fixed set of seeded playthroughs, not one
    // unseeded roll (a single roll lands above the 13% line about one run in five).
    const heroes = (id: CharId, level: number) => Array.from({ length: 40 }, (_, i) => {
      const d = newGame();
      d.seed = (0x9e3779b1 * (i + 1)) >>> 0;
      const st = new GameState(d);
      st.join(id, level);
      return st.char(id);
    });
    const gohans = heroes('gohan', 16);
    const piccolos = heroes('piccolo', 18);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // One officer shot costs forced L16 Gohan (no form) ~13% of his HP at most.
    expect(mean(gohans.map((g) => shotDamage('c05_officer', g.end) / g.hpMax))).toBeLessThanOrEqual(0.13);
    // Sustained fire: no more than 25% above a grunt's (it used to be twice a grunt's: POW 28 on a 60-frame cooldown).
    for (const c of [...gohans, ...piccolos]) {
      expect(shotDps('c05_officer', c.end)).toBeLessThanOrEqual(shotDps('c05_grunt', c.end) * 1.25);
    }
    // No faster fire than the grunts (the officers used to share the fastest regular fire rate in the game).
    expect(ENEMIES.c05_officer.shot?.cooldown ?? 0).toBeGreaterThanOrEqual(ENEMIES.c05_grunt.shot?.cooldown ?? 0);
  });

  it('Krillin\'s senzu beans heal Gohan after wave 2 (before Shisami) and after Tagoma', async () => {
    const sim = c05Sim('gohan', ['c05_wave1'], ['c05_army']);
    const st = sim.game.state;
    sim.start('waste_canyon', 8, 13);
    await settle(sim);
    const gohan = st.char('gohan');
    // Level-ups refill HP: hold Gohan at the level cap (same stats) so only the story heals can top him up.
    gohan.level = MAX_LEVEL;
    gohan.hp = 60;
    expect(await playOut(sim, 'c05_wave2'), 'c05_wave2 finished').toBe(true);
    expect(st.flag('c05_wave2')).toBe(true);
    expect(gohan.hp).toBe(gohan.hpMax);
    gohan.hp = 60;
    expect(await playOut(sim, 'c05_shisami'), 'c05_shisami finished').toBe(true);
    expect(st.flag('c05_shisamiDone')).toBe(true);
    expect(gohan.hp).toBe(gohan.hpMax);
    expect(sim.errors).toEqual([]);
  });
});

describe('Whis, one place at a time (he is the ride between Earth and space)', () => {
  type World = 'earth' | 'future' | 'space';
  /** A story point: chapter, flags raised, Journal entries, and the world the player is in. */
  interface Point { label: string; chapter: number; flags?: string[]; quests?: Record<string, 'active' | 'done'>; world: World; want: string[] }

  function save(p: Point): GameState {
    const st = new GameState(newGame());
    st.data.chapter = p.chapter;
    for (const f of p.flags ?? []) st.set(f);
    for (const [id, v] of Object.entries(p.quests ?? {})) st.data.journal[id] = v;
    st.set('world', p.world);
    return st;
  }

  /** Every map Whis stands on for this save, read off the map definitions (what each map spawns on arrival). */
  function whisMaps(st: GameState): string[] {
    const out: string[] = [];
    for (const id of Object.keys(MAPS)) {
      if (/^dev_/.test(id)) continue;
      for (const n of resolveMap(id)?.npcs ?? []) {
        if (n.sprite === 'whis' && st.check(n.showIf) && !(n.hideIf && st.check(n.hideIf))) out.push(`${id}/${n.id}`);
      }
    }
    return out.sort();
  }

  it('`world:` reads the world the player is in (Earth for a save that never left it)', () => {
    const st = new GameState(newGame());
    expect(st.check('world:earth')).toBe(true);
    expect(st.check('world:space')).toBe(false);
    st.set('world', 'space');
    expect(st.check('world:space&!world:earth')).toBe(true);
    st.set('world', 'future');
    expect(st.check('world:future')).toBe(true);
  });

  it('stands on one map per story point: wherever the story has him, else on the player\'s side of the trip', () => {
    const points: Point[] = [
      { label: 'Chapter 3, the Capsule Corp party', chapter: 3, world: 'earth', want: ['cc_yard/c03_whis'] },
      { label: 'Chapter 4, waiting for something new to eat', chapter: 4, quests: { c04_whis: 'active' }, world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 4, the lessons', chapter: 4, quests: { c04_whis: 'done' }, world: 'space', want: ['c04_whis_field/c04_fieldWhis'] },
      { label: 'Chapter 4, flown home mid-lesson', chapter: 4, quests: { c04_whis: 'done' }, world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 5 on Earth, unreachable', chapter: 5, world: 'earth', want: [] },
      { label: 'Chapter 5 in space, unreachable', chapter: 5, world: 'space', want: [] },
      { label: 'Chapter 6, the mesa', chapter: 6, flags: ['c06_arrived'], world: 'earth', want: ['waste_mesa/c06_m_whis'] },
      { label: 'Chapter 6, the party', chapter: 6, flags: ['c06_arrived', 'c06_won'], world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 6, flown to space', chapter: 6, flags: ['c06_arrived', 'c06_won'], world: 'space', want: ['beerus_grounds/c04_whisB'] },
      { label: 'Chapter 7, the weighted-clothes training', chapter: 7, world: 'space', want: ['beerus_grounds/c04_whisB'] },
      { label: 'Chapter 7, recruiting at Capsule Corp', chapter: 7, flags: ['c07_champaDone'], world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 7, the Nameless Planet', chapter: 7, flags: ['c07_champaDone', 'c07_departed'], quests: { c07_shards: 'active' }, world: 'space', want: ['c07_nameless_grounds/c07_g_whis'] },
      { label: 'Chapter 7, the orange stones owed during the matches', chapter: 7, flags: ['c07_champaDone', 'c07_departed', 'c07_examDone'], quests: { c07_shards: 'active' }, world: 'space', want: ['c07_nameless_grounds/c07_g_whis'] },
      { label: 'Chapter 7, the gods\' box', chapter: 7, flags: ['c07_champaDone', 'c07_departed', 'c07_examDone'], quests: { c07_shards: 'done' }, world: 'space', want: ['c07_nameless_arena/c07_a_whis'] },
      { label: 'Chapter 8, the stones still owed (space)', chapter: 8, quests: { c07_shards: 'active' }, world: 'space', want: ['c07_nameless_grounds/c07_g_whis2'] },
      { label: 'Chapter 8, the stones still owed (Earth)', chapter: 8, quests: { c07_shards: 'active' }, world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 10, Universe 10', chapter: 10, quests: { c10_q_u10: 'active' }, world: 'space', want: ['u10_sacred/c10_whisU'] },
      { label: 'Chapter 11, in the future', chapter: 11, world: 'future', want: [] },
      { label: 'Chapter 12 at home', chapter: 12, world: 'earth', want: ['cc_yard/c04_whis'] },
      { label: 'Chapter 12 in space', chapter: 12, world: 'space', want: ['beerus_grounds/c04_whisB'] },
      { label: 'Chapter 14, the World of Void', chapter: 14, flags: ['c14_departed'], world: 'space', want: [] },
      { label: 'after the credits', chapter: 15, flags: ['c14_departed', 'c14_won', 'post_game'], world: 'earth', want: ['cc_yard/c04_whis'] },
    ];
    for (const p of points) expect(whisMaps(save(p)), p.label).toEqual(p.want);
  });

  it('a story warp across worlds spawns him on the side it lands on (the world is set before the map fills)', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 30);
    st.data.active = 'goku';
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    expect(st.get('world')).toBe('earth');
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c04_whis' && !n.hidden)).toBe(true);
    sim.start('beerus_grounds', 20, 20);
    await settle(sim);
    expect(st.get('world')).toBe('space');
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c04_whisB' && !n.hidden)).toBe(true);
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c04_whis' && !n.hidden)).toBe(true);
    expect(sim.errors).toEqual([]);
  });
});
