import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/content/registry';
import type { CharId } from '../../src/content/characters';
import { ENEMIES } from '../../src/content/enemies';
import { QUESTS } from '../../src/content/quests';
import { SCRIPTS, ScriptApi, type FightOpts, type FightResult, type Script } from '../../src/game/script';
import type { Line } from '../../src/ui/dialogue';
import { Sim } from '../sim';

/**
 * Act 4 (Chapters 9-11) chain test: drives every gold-quest beat in order with the headless Sim, from
 * c09_start to the c12_start handoff, plus the side quests, asserting flags, quests, joins, forms and items.
 */

const BIG = 400000;

/** Tick until a condition holds, then until no script holds the lock. */
async function settle(sim: Sim, cond: () => boolean = () => true, max = BIG): Promise<void> {
  for (let i = 0; i < max && !cond(); i += 10) await sim.tick(10);
  for (let i = 0; i < max && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
}

/** Run an NPC's talk script with the NPC as context. */
async function talk(sim: Sim, npcId: string, script?: string, max = BIG): Promise<boolean> {
  const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
  expect(npc, `npc ${npcId} on ${sim.game.field?.def.id}`).toBeTruthy();
  return sim.run(script ?? npc!.def.talk, { npc }, max);
}

/** Start on a map and let its onEnter scripts finish. */
async function enter(sim: Sim, map: string, x?: number, y?: number): Promise<void> {
  sim.start(map, x, y);
  await sim.tick(5);
  await settle(sim);
}

/**
 * Which named character a sprite shows (null for extras). Black and his clones are left out on purpose:
 * Chapter 11 is full of Blacks.
 */
function identity(sprite: string): string | null {
  if (/^(gokuBlack|blackRose)/.test(sprite)) return null;
  if (/^goku/.test(sprite)) return 'goku';
  if (/^vegeta/.test(sprite)) return 'vegeta';
  if (/^futureTrunks/.test(sprite)) return 'trunks';
  if (/^gohan/.test(sprite)) return 'gohan';
  if (/^(vegito|beerus|whis|bulma|zamasu|futureMai|roshi|gowasu|supremeKai|zeno)/.test(sprite)) return sprite.replace(/(SSB|Blue)$/, '');
  return null;
}

/**
 * Watch every tick for two visible actors (the player included) showing the same named character while the
 * screen is not faded out. Returns the set of offending moments.
 */
function watchDoubles(sim: Sim): Set<string> {
  const seen = new Set<string>();
  const tick = sim.tick.bind(sim);
  sim.tick = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      await tick(1);
      const f = sim.game.field;
      if (!f || f.fade >= 1) continue;
      const on = new Map<string, string[]>();
      const add = (who: string | null, tag: string): void => { if (who) on.set(who, [...(on.get(who) ?? []), tag]); };
      if (!f.player.hidden) add(identity(f.player.spriteId), 'hero');
      for (const n2 of f.npcs) if (!n2.hidden) add(identity(n2.spriteId), n2.def.id);
      for (const [who, tags] of on) if (tags.length > 1) seen.add(`${f.def.id} ch${sim.game.state.data.chapter}: ${who} x${tags.length} (${tags.join(', ')})`);
    }
  };
  return seen;
}

/** Record every dialogue line shown, with the map and the NPC/actor ids on screen at that moment. */
function recordLines(sim: Sim): Array<{ map: string; text: string; npcs: string[] }> {
  const log: Array<{ map: string; text: string; npcs: string[] }> = [];
  const say = sim.game.say.bind(sim.game);
  sim.game.say = (lines: Line[]) => {
    const f = sim.game.field;
    for (const l of lines) log.push({ map: f?.def.id ?? '', text: l.text, npcs: f?.npcs.map((n) => n.def.id) ?? [] });
    return say(lines);
  };
  return log;
}

/** Act 4 quests still active in the journal. */
function openAct4(sim: Sim): string[] {
  return Object.entries(sim.game.state.data.journal).filter(([id, v]) => /^c(09|10|11)_q_/.test(id) && v === 'active').map(([id]) => id);
}

/** A Sim at the end of Chapter 8: Goku/Vegeta/Gohan/Piccolo at L31, Trunks with prologue stats (left the party). */
function endOfChapter8(): Sim {
  const sim = new Sim();
  const st = sim.game.state;
  st.data.chapter = 8;
  for (const id of ['goku', 'vegeta', 'gohan', 'piccolo'] as const) st.join(id, 31);
  st.join('trunks', 6);
  st.learn('trunks', 'burningAttack');
  st.char('trunks').form = 'ssj';
  st.char('trunks').joined = false;
  st.char('goku').form = 'ssb';
  st.char('vegeta').form = 'ssb';
  st.data.active = 'goku';
  return sim;
}

describe('act 4 - chapters 9 to 11', () => {
  it('plays from c09_start through the c12_start handoff', async () => {
    const sim = endOfChapter8();
    const st = sim.game.state;
    const q = (id: string) => st.data.journal[id];
    const doubles = watchDoubles(sim);
    const lines = recordLines(sim);
    const orig = SCRIPTS.c12_start;
    const handoff: Script = async (s) => { s.set('t_c12_called'); };
    SCRIPTS.c12_start = handoff;
    // Note which regular enemies are still standing when each boss fight starts.
    const proto = ScriptApi.prototype;
    const origFight = proto.fight;
    const mooksAtStart: Record<string, number> = {};
    proto.fight = async function (this: ScriptApi, type: string, opts?: FightOpts): Promise<FightResult> {
      mooksAtStart[type] = this.field.enemies.filter((e) => !e.isBoss && !e.dead && !e.puppet && e.state !== 'dying').length;
      return origFight.call(this, type, opts);
    };
    try {
      // ------------------------------------------------ Chapter 9
      await enter(sim, 'cc_yard', 21, 8);
      expect(await sim.run('c09_start', {}, BIG)).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(st.data.chapter).toBe(9);
      expect(st.char('trunks').joined).toBe(true);
      expect(st.char('trunks').level).toBeGreaterThanOrEqual(30);
      expect(st.char('trunks').techs).toContain('swordBlast');
      expect(st.char('trunks').charged).toBe(true);
      expect(st.data.active).toBe('trunks');
      expect(st.flag('noSwitch')).toBe(true);
      expect(st.flag('c09_hopeCrashed')).toBe(true);
      expect(q('c09_q_spar')).toBe('active');

      await enter(sim, 'cc_gravity', 7, 9);
      expect(await talk(sim, 'c09_vegeta')).toBe(true);
      expect(q('c09_q_spar')).toBe('done');
      expect(q('c09_q_black')).toBe('active');

      // Entering the yard triggers Black's arrival, the outskirts fight and Cell's machine.
      await enter(sim, 'cc_yard', 21, 8);
      await settle(sim, () => st.flag('c09_cellOut'));
      expect(sim.errors).toEqual([]);
      expect(st.flag('c09_blackDone')).toBe(true);
      expect(q('c09_q_black')).toBe('done');
      expect(q('c09_q_fuel')).toBe('active');
      expect(st.data.regions).toContain('c09_spot_mine');
      expect(st.data.active).toBe('trunks');
      expect(st.flag('noSwitch')).toBe(false);

      // The mine: three crystals, one behind the Excavator.
      await enter(sim, 'c09_mine', 5, 25);
      expect(st.flag('c09_mineSeen')).toBe(true);
      expect(await sim.run('c09_crystal3')).toBe(true);
      expect(st.count('c09_crystal')).toBe(0);
      expect(await sim.run('c09_crystal1')).toBe(true);
      expect(await sim.run('c09_crystal2')).toBe(true);
      expect(await sim.run('c09_excavator_fight')).toBe(true);
      expect(st.flag('defeated:c09_excavator1')).toBe(true);
      expect(await sim.run('c09_crystal3')).toBe(true);
      expect(st.count('c09_crystal')).toBe(3);
      expect(q('c09_q_fuel')).toBe('done');
      expect(q('c09_q_depart')).toBe('active');

      // Side quests: Gohan (as Trunks) and the Pilaf Gang's homework (all answers are option 2).
      await enter(sim, 'gohan_house', 8, 10);
      expect(await talk(sim, 'c09_gohanH')).toBe(true);
      expect(q('c09_q_gohan')).toBe('done');
      await enter(sim, 'cc_yard', 9, 21);
      sim.choice = 1;
      expect(await talk(sim, 'c09_pilafK')).toBe(true);
      sim.choice = 0;
      expect(q('c09_q_homework')).toBe('done');

      // Departure -> the future -> Mai -> Chapter 10 begins and Goku rides back alone.
      await enter(sim, 'cc_yard', 31, 10);
      expect(await talk(sim, 'c09_bulmaPad')).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(q('c09_q_depart')).toBe('done');
      expect(st.count('c09_crystal')).toBe(0);
      expect(st.data.regions).toEqual(expect.arrayContaining(['spot_future_city', 'spot_future_base']));
      expect(st.flag('c09_arrivedFuture')).toBe(true);

      // ------------------------------------------------ Chapter 10
      expect(st.data.chapter).toBe(10);
      expect(q('c10_q_ask')).toBe('active');
      expect(st.data.active).toBe('goku');
      expect(st.get('world')).toBe('earth');
      expect(sim.game.field?.def.id).toBe('cc_yard');

      await enter(sim, 'cc_yard', 23, 22);
      expect(await talk(sim, 'c10_beerus')).toBe(true);
      expect(q('c10_q_u10')).toBe('active');
      expect(sim.game.field?.def.id).toBe('u10_sacred');
      expect(st.get('world')).toBe('space');
      // The tea-table Beerus and Whis walked in with Goku and went to their posts (one of each, no stand-ins).
      for (const [sprite, id, x] of [['beerus', 'c10_beerusU', 25], ['whis', 'c10_whisU', 26]] as const) {
        const gods = sim.game.field?.npcs.filter((n) => n.spriteId === sprite) ?? [];
        expect(gods.map((n) => n.def.id)).toEqual([id]);
        expect(Math.round((gods[0].x - 8) / 16)).toBe(x);
      }
      expect(await talk(sim, 'c10_gowasu')).toBe(true);
      expect(await talk(sim, 'c10_zamasu')).toBe(true);
      expect(st.flag('c10_sparDone')).toBe(true);
      expect(await sim.run('c10_ring_shrine')).toBe(true);
      expect(st.flag('c10_clueRing')).toBe(true);
      expect(await talk(sim, 'c10_beerusU')).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(st.flag('c10_zamasuErased')).toBe(true);
      expect(st.count('c10_timeRing')).toBe(1);
      expect(q('c10_q_u10')).toBe('done');
      expect(q('c10_q_zeno')).toBe('active');
      expect(sim.game.field?.def.id).toBe('zeno_palace');

      expect(await talk(sim, 'c10_zeno')).toBe(true);
      expect(st.count('c10_zenoButton')).toBe(1);
      expect(q('c10_q_zeno')).toBe('done');
      expect(q('c10_q_future')).toBe('active');
      expect(sim.game.field?.def.id).toBe('cc_yard');

      // Babari side quest (silver): Gowasu sends Goku, the chief yields, the fruit comes home.
      await enter(sim, 'u10_sacred', 20, 20);
      expect(await talk(sim, 'c10_gowasu')).toBe(true);
      await settle(sim);
      expect(q('c10_q_babari')).toBe('active');
      expect(sim.game.field?.def.id).toBe('c10_babari');
      expect(await talk(sim, 'c10_slain')).toBe(true);
      expect(st.flag('c10_sawSlain')).toBe(true);
      expect(await talk(sim, 'c10_chief')).toBe(true);
      expect(st.flag('c10_chiefBeaten')).toBe(true);
      expect(await sim.run('c10_fruit_tree')).toBe(true);
      expect(st.count('c10_fruit')).toBe(1);
      expect(await sim.run('c10_kaistone')).toBe(true);
      expect(sim.game.field?.def.id).toBe('u10_sacred');
      expect(await talk(sim, 'c10_gowasu')).toBe(true);
      expect(q('c10_q_babari')).toBe('done');

      // Back to the future: Mai sends Goku to Black's hideout.
      await enter(sim, 'cc_yard', 31, 10);
      expect(await talk(sim, 'c09_bulmaPad')).toBe(true);
      expect(q('c10_q_future')).toBe('done');
      expect(q('c10_q_lair')).toBe('active');
      expect(st.get('world')).toBe('future');
      expect(sim.game.field?.def.id).toBe('c10_lair');

      // Medicine run (bronze): carry the case without being hit.
      expect(await talk(sim, 'c10_runner')).toBe(true);
      expect(q('c10_q_medicine')).toBe('active');
      expect(await sim.run('c10_pharmacy')).toBe(true);
      expect(sim.game.field?.carrying).toBeTruthy();
      expect(await talk(sim, 'c10_runner')).toBe(true);
      expect(q('c10_q_medicine')).toBe('done');

      // The showdown: Vegeta vs Black / Rosé, immortal Zamasu, the truth, retreat -> Chapter 11 begins.
      expect(await sim.run('c10_showdown', {}, BIG)).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(st.flag('c10_lairDone')).toBe(true);
      expect(q('c10_q_lair')).toBe('done');

      // ------------------------------------------------ Chapter 11
      expect(st.data.chapter).toBe(11);
      expect(st.char('trunks').form).toBe('rage');
      expect(st.data.active).toBe('trunks');
      expect(st.flag('noSwitch')).toBe(true);
      expect(q('c11_q_mafuba')).toBe('active');
      expect(sim.game.field?.def.id).toBe('cc_yard');

      await enter(sim, 'kame_island', 21, 15);
      expect(await talk(sim, 'c11_roshi')).toBe(true);
      expect(q('c11_q_mafuba')).toBe('done');
      expect(q('c11_q_urn')).toBe('active');

      await enter(sim, 'lookout', 22, 28);
      expect(st.count('c11_urn')).toBe(1);
      // With the urn in hand the journal (and the world-map star) points back to Kame House.
      expect(q('c11_q_urn')).toBe('done');
      expect(q('c11_q_charm')).toBe('active');
      expect(QUESTS.c11_q_charm.region).toBe('spot_kame');
      expect(QUESTS.c11_q_charm.star).toBe('gold');
      expect(await sim.run('c11_htc_door')).toBe(true);

      await enter(sim, 'kame_island', 21, 15);
      expect(await talk(sim, 'c11_gokuK')).toBe(true);
      expect(await talk(sim, 'c11_roshi')).toBe(true);
      expect(st.count('c11_charm')).toBe(1);
      expect(q('c11_q_urn')).toBe('done');
      expect(q('c11_q_charm')).toBe('done');
      expect(q('c11_q_return')).toBe('active');

      await enter(sim, 'cc_yard', 31, 10);
      expect(await talk(sim, 'c09_bulmaPad')).toBe(true);
      expect(st.flag('c11_inFuture')).toBe(true);
      expect(q('c11_q_return')).toBe('done');
      expect(q('c11_q_rift')).toBe('active');
      expect(q('c11_q_notes')).toBe('active');
      expect(st.get('world')).toBe('future');

      // Side quests in the ruins: the survivors (bronze) and Bulma's notebook (silver).
      await enter(sim, 'future_hideout_in', 9, 11);
      expect(await talk(sim, 'c11_mother')).toBe(true);
      expect(q('c11_q_survivors')).toBe('active');
      await enter(sim, 'future_city', 40, 4);
      expect(sim.game.field?.enemies.some((e) => e.def.id === 'c11_blackClone')).toBe(true);
      expect(resolveMap('future_city')?.triggers?.some((t) => t.script === 'c11_to_rift')).toBe(true);
      for (const id of ['c11_surv1', 'c11_surv2', 'c11_surv3']) expect(await talk(sim, id)).toBe(true);
      await enter(sim, 'future_cc_ruins', 32, 6);
      expect(await sim.run('c11_notes_shelf')).toBe(true);
      expect(st.count('c11_notes')).toBe(1);
      await enter(sim, 'future_hideout_in', 9, 11);
      expect(await talk(sim, 'c11_mother')).toBe(true);
      expect(q('c11_q_survivors')).toBe('done');
      expect(await talk(sim, 'c09_fmai')).toBe(true);
      expect(q('c11_q_notes')).toBe('done');

      // The finale: Rosé boss, the Mafuba wards, the coupon, Fused Zamasu relay, Zeno, farewell.
      const vegBefore = { ...st.char('vegeta') };
      // Walk to the south end of the avenue: the rift passage leads to the plaza (intro pan plays once).
      await enter(sim, 'future_city', 22, 27);
      expect(await sim.run('c11_to_rift')).toBe(true);
      await settle(sim, () => sim.game.field?.def.id === 'c11_rift_sky');
      expect(sim.game.field?.def.id).toBe('c11_rift_sky');
      expect(st.flag('c11_riftSeen')).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(sim.game.field?.enemies.some((e) => e.def.id === 'c11_blackClone')).toBe(true);
      expect(await sim.run('c11_showdown', {}, BIG)).toBe(true);
      expect(sim.errors).toEqual([]);
      // The plaza clones fade before the cutscene; none of them joins Black's duel.
      expect(mooksAtStart.c11_blackRoseB).toBe(0);
      expect(st.flag('c11_roseBeaten')).toBe(true);
      expect(st.flag('c11_finaleDone')).toBe(true);
      expect(q('c11_q_rift')).toBe('done');
      expect(st.count('c11_charm')).toBe(0);
      expect(st.count('c11_coupon')).toBe(1);
      expect(st.flag('c11_sealOpen')).toBe(false);
      expect(st.char('vegeta').outfit).toBeUndefined();
      expect(st.char('vegeta').str).toBe(vegBefore.str);
      expect(st.char('vegeta').pow).toBe(vegBefore.pow);
      expect(st.char('vegeta').end).toBe(vegBefore.end);
      expect(st.char('vegeta').form).toBe(vegBefore.form);
      expect(st.char('trunks').joined).toBe(true);
      expect(st.char('trunks').form).toBe('rage');
      expect(st.flag('c11_farewell')).toBe(true);
      expect(st.flag('noSwitch')).toBe(false);
      expect(st.get('world')).toBe('earth');
      expect(st.flag('t_c12_called')).toBe(true);
      expect(openAct4(sim)).toEqual([]);
      expect(sim.errors).toEqual([]);

      // Story beats the reviewers checked: Black is the Zamasu of Goku's time (and took Future Gowasu's earring),
      // Infinite Zamasu strikes down the survivors (only Mai is left beside Trunks), and the farewell grieves them.
      const said = lines.map((l) => l.text).join('\n');
      expect(said).toContain('Not of this world, Son Goku. Of YOURS');
      expect(said).toContain('Your Hakai came too late.');
      expect(said).toContain('A keepsake from the Gowasu of this world');
      expect(said).not.toContain('The Zamasu of this world');
      const gone = lines.find((l) => l.text.startsWith('Trunks... they\'re gone.'));
      expect(gone?.map).toBe('c11_rift_sky');
      expect(gone?.npcs).toContain('c11_mai');
      expect(gone?.npcs.filter((id) => /^c11_r\d$/.test(id))).toEqual([]);
      expect(said).toContain('Mai and I are all that\'s left of my world.');
      expect(said).toContain('Aiko, and the three I sent home to her');

      // No one is ever shown twice: Trunks's join, Beerus and Whis arriving in Universe 10, and the rest.
      expect([...doubles]).toEqual([]);
    } finally {
      proto.fight = origFight;
      if (orig) SCRIPTS.c12_start = orig;
      else delete SCRIPTS.c12_start;
    }
  });

  it('each chapter start works standalone', async () => {
    for (const [id, ch] of [['c10_start', 9], ['c11_start', 10]] as const) {
      const sim = new Sim();
      sim.game.state.data.chapter = ch;
      sim.game.state.join('goku', 30);
      sim.game.state.data.active = 'goku';
      sim.start('cc_yard', 21, 8);
      await sim.tick(5);
      expect(await sim.run(id, {}, BIG), id).toBe(true);
      expect(sim.errors, id).toEqual([]);
      expect(sim.game.state.data.chapter).toBe(ch + 1);
      expect(sim.game.state.char('trunks').joined).toBe(true);
    }
  });

  it('boss phase scripts play on their arenas', async () => {
    const cases: Array<[string, string, CharId]> = [
      ['c09_flash_wastes', 'c09_dabura_phase2', 'trunks'], ['cc_gravity', 'c09_vegeta_phase2', 'trunks'],
      ['c09_outskirts', 'c09_black_phase2', 'goku'], ['c09_mine', 'c09_excavator_phase2', 'trunks'],
      ['u10_sacred', 'c10_zamasu_phase2', 'goku'], ['c11_rift_sky', 'c11_rose_scythe', 'trunks'],
      ['c11_rift_sky', 'c11_rose_clones', 'trunks'], ['c11_rift_sky', 'c11_fused_mutate', 'goku'],
      ['c10_lair', 'c10_black_blade', 'vegeta'], ['c10_babari', 'c10_chief_rally', 'goku'],
    ];
    // Every phase script a boss of this act names is covered here.
    const named = Object.values(ENEMIES).filter((e) => /^c(09|10|11)_/.test(e.id))
      .flatMap((e) => e.boss?.phases.map((p) => p.onStart).filter((x): x is string => !!x) ?? []);
    expect(new Set(named)).toEqual(new Set(cases.map(([, id]) => id)));
    for (const [map, id, hero] of cases) {
      const sim = new Sim();
      const st = sim.game.state;
      st.data.chapter = 11;
      st.join(hero, 35);
      st.data.active = hero;
      st.set('c11_riftSeen');
      sim.start(map);
      await sim.tick(5);
      await settle(sim);
      expect(await sim.run(id), id).toBe(true);
      expect(sim.errors, id).toEqual([]);
    }
  });

  it('losing a spar or a memory is a retry, not a Game Over', async () => {
    // Make the first bout of each listed boss end in a knock-out, then fight normally.
    const proto = ScriptApi.prototype;
    const orig = proto.fight;
    const lostOnce = new Set<string>();
    proto.fight = async function (this: ScriptApi, type: string, opts?: FightOpts): Promise<FightResult> {
      if (['c09_vegetaSpar', 'c10_zamasuSpar', 'c09_dabura'].includes(type) && !lostOnce.has(type)) {
        lostOnce.add(type);
        if (opts?.uid) this.spawnEnemy(type, opts.x ?? 10, opts.y ?? 5, opts.uid).puppet = true;
        return 'lose';
      }
      return orig.call(this, type, opts);
    };
    try {
      // Vegeta's spar: a loss sends Trunks off to recover; talking again restarts it.
      const sim = new Sim();
      const st = sim.game.state;
      st.data.chapter = 9;
      st.join('trunks', 31);
      st.data.active = 'trunks';
      st.addQuest('c09_q_spar');
      await enter(sim, 'cc_gravity', 7, 9);
      expect(await talk(sim, 'c09_vegeta')).toBe(true);
      expect(st.data.journal.c09_q_spar).toBe('active');
      expect(sim.game.field?.npcs.some((n) => n.def.id === 'c09_vegeta')).toBe(true);
      expect(sim.game.field?.enemies.some((e) => e.uid === 'c09_vegspar')).toBe(false);
      expect(await talk(sim, 'c09_vegeta')).toBe(true);
      expect(st.data.journal.c09_q_spar).toBe('done');
      expect(sim.errors).toEqual([]);

      // Zamasu's bout on the Sacred World: same deal.
      const sim2 = new Sim();
      const st2 = sim2.game.state;
      st2.data.chapter = 10;
      st2.join('goku', 35);
      st2.data.active = 'goku';
      st2.set('c10_u10Arrived');
      st2.addQuest('c10_q_u10');
      await enter(sim2, 'u10_sacred', 20, 20);
      expect(await talk(sim2, 'c10_zamasu')).toBe(true);
      expect(st2.flag('c10_sparDone')).toBe(false);
      expect(await talk(sim2, 'c10_zamasu')).toBe(true);
      expect(st2.flag('c10_sparDone')).toBe(true);
      expect(sim2.errors).toEqual([]);

      // Dabura in Trunks's memory: a knock-out replays the fight.
      const sim3 = new Sim();
      const st3 = sim3.game.state;
      st3.data.chapter = 9;
      st3.join('trunks', 30);
      st3.data.active = 'trunks';
      await enter(sim3, 'cc_inside', 16, 10);
      expect(await sim3.run('c09_flashback', {}, BIG)).toBe(true);
      expect(lostOnce.has('c09_dabura')).toBe(true);
      expect(sim3.errors).toEqual([]);
    } finally {
      proto.fight = orig;
    }
  });

  it('a save made mid-scene never leaves a story trigger spent or Vegito\'s power behind', async () => {
    // Plaza under the rift: finale lock, open seal, Vegito outfit + boost all undone on entry.
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 11;
    for (const id of ['goku', 'vegeta', 'trunks'] as const) st.join(id, 38);
    st.data.active = 'vegeta';
    const before = { ...st.char('vegeta') };
    st.addQuest('c11_q_rift');
    st.set('c11_riftSeen');
    st.set('c11_finaleLock');
    st.set('c11_sealOpen');
    // Simulate a save taken mid-Vegito: boosted stats, the outfit and the finale lock, then reload the map.
    const veg = st.char('vegeta');
    veg.outfit = 'vegitoBlue';
    st.set('c11_boost_vegeta', '10,10,10');
    veg.str += 10; veg.pow += 10; veg.end += 10;
    st.set('c11_finaleLock');
    st.data.active = 'vegeta';
    sim.start('c11_rift_sky', 14, 18);
    await sim.tick(2);
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.flag('c11_finaleLock')).toBe(false);
    expect(st.flag('c11_sealOpen')).toBe(false);
    expect(veg.outfit).toBeUndefined();
    expect([veg.str, veg.pow, veg.end]).toEqual([before.str, before.pow, before.end]);
    expect(st.data.active).toBe('trunks');
    expect(resolveMap('c11_rift_sky')?.triggers?.find((t) => t.id === 'c11_t_showdown')?.hideIf).toBe('c11_finaleLock');

    // Black's hideout and the mine: the spent "started" flags are cleared on the next visit.
    const sim2 = new Sim();
    const st2 = sim2.game.state;
    st2.data.chapter = 10;
    st2.join('goku', 35);
    st2.data.active = 'goku';
    st2.set('c10_showdownStarted');
    st2.set('c09_exStarted');
    sim2.start('c10_lair', 16, 20);
    await sim2.tick(2);
    await settle(sim2);
    expect(st2.flag('c10_showdownStarted')).toBe(false);
    sim2.start('c09_mine', 5, 25);
    await sim2.tick(2);
    await settle(sim2);
    expect(st2.flag('c09_exStarted')).toBe(false);
    expect(sim2.errors).toEqual([]);
  });

  it('shares the hubs with other acts without doubling anyone', async () => {
    // Kame House in Chapter 11: one Roshi (the Mafuba one).
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 11;
    st.join('trunks', 38);
    st.data.active = 'trunks';
    st.addQuest('c11_q_mafuba');
    sim.start('kame_island', 21, 15);
    await sim.tick(2);
    await settle(sim);
    const roshis = sim.game.field?.npcs.filter((n) => n.spriteId === 'roshi').map((n) => n.def.id);
    expect(roshis).toEqual(['c11_roshi']);
    // Capsule Corp lawn in Chapter 10: Beerus naps, and there is exactly one Whis.
    const sim2 = new Sim();
    const st2 = sim2.game.state;
    st2.data.chapter = 10;
    st2.join('goku', 35);
    st2.data.active = 'goku';
    st2.set('c09_cellOut');
    st2.addQuest('c10_q_ask');
    sim2.start('cc_yard', 23, 22);
    await sim2.tick(2);
    await settle(sim2);
    expect(sim2.game.field?.npcs.filter((n) => n.spriteId === 'whis').length).toBe(1);
    expect(sim2.game.field?.npcs.some((n) => n.def.id === 'c10_beerus')).toBe(true);
    // Chapter 9 fuel quest: the lawn Goku/Vegeta never double the active hero.
    const sim3 = new Sim();
    const st3 = sim3.game.state;
    st3.data.chapter = 9;
    for (const id of ['goku', 'vegeta', 'trunks'] as const) st3.join(id, 32);
    st3.set('c09_hopeCrashed');
    st3.set('c09_hopeDestroyed');
    st3.set('c09_cellOut');
    for (const hero of ['goku', 'vegeta', 'trunks'] as const) {
      st3.data.active = hero;
      sim3.start('cc_yard', 23, 22);
      await sim3.tick(2);
      await settle(sim3);
      const npcs = sim3.game.field?.npcs.map((n) => n.spriteId) ?? [];
      expect(npcs.includes('goku'), hero).toBe(hero !== 'goku');
      expect(npcs.includes('vegeta'), hero).toBe(hero !== 'vegeta');
    }
  });

  it('runs every Act 4 NPC talk script in each chapter state without errors', async () => {
    const maps = ['cc_yard', 'cc_gravity', 'gohan_house', 'future_hideout_in', 'future_city', 'u10_sacred', 'zeno_palace', 'kame_island', 'c10_babari', 'c10_lair'];
    // Two story states per chapter: early (fuel quest, before the first trip) and late (everything unlocked).
    const states: Array<{ flags: string[]; quests: string[]; hero: CharId }> = [
      { flags: ['c09_hopeCrashed', 'c09_hopeDestroyed', 'c09_cellOut'], quests: ['c09_q_fuel'], hero: 'gohan' },
      {
        flags: ['c09_hopeCrashed', 'c09_cellOut', 'c09_arrivedFuture', 'c10_u10Arrived', 'c10_sparDone', 'c10_lairDone', 'c11_inFuture'],
        quests: ['c09_q_spar', 'c10_q_ask', 'c10_q_u10', 'c10_q_zeno', 'c10_q_babari', 'c11_q_urn', 'c11_q_survivors'], hero: 'trunks',
      },
    ];
    let ran = 0;
    for (const ch of [9, 10, 11, 12]) {
      for (const state of states) {
        for (const map of maps) {
          const def = resolveMap(map);
          for (const n of def?.npcs ?? []) {
            if (!/^c(09|10|11)_/.test(n.id)) continue;
            const sim = new Sim();
            const st = sim.game.state;
            st.data.chapter = ch;
            for (const id of ['goku', 'vegeta', 'trunks', 'gohan'] as const) st.join(id, 35);
            st.data.active = state.hero;
            for (const f of state.flags) st.set(f);
            for (const qid of state.quests) st.addQuest(qid);
            sim.start(map, n.x, n.y + 1);
            await sim.tick(5);
            await settle(sim, () => true, 60000);
            const npc = sim.game.field?.npcs.find((x) => x.def.id === n.id);
            if (!npc) continue;
            const ok = await sim.run(n.talk, { npc }, BIG);
            ran++;
            expect(sim.errors, `${map}/${n.id} ch${ch}`).toEqual([]);
            expect(ok, `${map}/${n.id} ch${ch} did not finish`).toBe(true);
          }
        }
      }
    }
    expect(ran).toBeGreaterThan(40);
  });

  it('keeps the arena shut while a scripted fight runs (no warps, exits, saves or world signs)', async () => {
    // Each listed fight starts with the player standing right on the map's door warp.
    const doors: Record<string, string> = { c11_blackRoseA: 'future_hideout_in', c09_vegetaSpar: 'cc_inside' };
    const seen: Record<string, { parked: boolean; stayed: boolean }> = {};
    const proto = ScriptApi.prototype;
    const orig = proto.fight;
    proto.fight = async function (this: ScriptApi, type: string, opts?: FightOpts): Promise<FightResult> {
      const to = doors[type];
      if (!to) return orig.call(this, type, opts);
      const f = this.field;
      const w = f.def.warps?.find((x) => x.to === to);
      if (!w) throw new Error(`${type}: no door to ${to} on ${f.def.id}`);
      const p = f.player;
      const [x0, y0] = [p.x, p.y];
      p.x = (w.x + w.w / 2) * 16;
      p.y = w.y * 16 + 14;
      const parked = f.map.objects.filter((o) => o.def.type === 'save' || o.def.type === 'worldSign').every((o) => o.gone);
      const r = await orig.call(this, type, opts);
      seen[type] = { parked, stayed: this.field === f };
      p.x = x0;
      p.y = y0;
      return r;
    };
    try {
      // Chapter 11 opening: Black Rose at the Resistance hatch. The scene must finish and hand back a sane game.
      const sim = new Sim();
      const st = sim.game.state;
      st.data.chapter = 10;
      st.join('goku', 36);
      st.data.active = 'goku';
      sim.start('cc_yard', 21, 8);
      await sim.tick(5);
      const prevDown = sim.game.onPlayerDown;
      expect(await sim.run('c11_start', {}, BIG)).toBe(true);
      expect(sim.errors).toEqual([]);
      expect(seen.c11_blackRoseA).toEqual({ parked: true, stayed: true });
      expect(st.data.journal.c11_q_mafuba).toBe('active');
      expect(sim.game.field?.def.id).toBe('cc_yard');
      expect(st.get('world')).toBe('earth');
      expect(sim.game.lockDepth).toBe(0);
      expect(sim.game.onPlayerDown).toBe(prevDown);

      // Chapter 9 gravity-room spar: backing onto the door does not leave the room mid-fight.
      const sim2 = new Sim();
      const st2 = sim2.game.state;
      st2.data.chapter = 9;
      st2.join('trunks', 31);
      st2.data.active = 'trunks';
      st2.set('noSwitch');
      st2.addQuest('c09_q_spar');
      await enter(sim2, 'cc_gravity', 7, 9);
      const saves = () => sim2.game.field?.map.objects.filter((o) => o.def.type === 'save') ?? [];
      expect(saves().length).toBe(1);
      const prevDown2 = sim2.game.onPlayerDown;
      expect(await talk(sim2, 'c09_vegeta')).toBe(true);
      expect(sim2.errors).toEqual([]);
      expect(seen.c09_vegetaSpar).toEqual({ parked: true, stayed: true });
      expect(st2.data.journal.c09_q_spar).toBe('done');
      expect(sim2.game.field?.def.id).toBe('cc_gravity');
      expect(saves().every((o) => !o.gone)).toBe(true);
      expect(sim2.game.onPlayerDown).toBe(prevDown2);
    } finally {
      proto.fight = orig;
    }
  });

  it('puts gates and saves where the forced characters of Chapters 9-11 can use them', () => {
    // The hound den is shut to Goku in Ch10; Trunks (forced, L37-40) can open it on the third trip in Ch11.
    const lair = resolveMap('c10_lair');
    const gate = lair?.barriers?.find((b) => b.id === 'c10_g_trunks');
    expect(gate?.character).toBe('trunks');
    expect(gate?.level ?? 99).toBeLessThanOrEqual(40);
    expect(lair?.barriers?.some((b) => b.character && b.character !== 'trunks' && b.character !== 'goku')).toBe(false);
    // Capsule Corp's gravity room holds the save point before the Chapter 9 spar and Goku Black.
    expect(resolveMap('cc_gravity')?.objects?.some((o) => o.type === 'save')).toBe(true);
  });

  it('never shows Gohan twice at home when the player is Gohan', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 9;
    for (const id of ['gohan', 'trunks'] as const) st.join(id, 32);
    st.set('c09_hopeCrashed');
    st.addQuest('c09_q_gohan');
    st.data.active = 'gohan';
    await enter(sim, 'gohan_house', 8, 10);
    expect(sim.game.field?.npcs.some((n) => n.spriteId === 'gohan')).toBe(false);
    const lines = recordLines(sim);
    expect(await talk(sim, 'c09_videlH')).toBe(true);
    expect(lines.map((l) => l.text).join(' ')).toContain('Trunks from the future is back');
    st.data.active = 'trunks';
    await enter(sim, 'gohan_house', 8, 10);
    expect(sim.game.field?.npcs.filter((n) => n.spriteId === 'gohan').map((n) => n.def.id)).toEqual(['c09_gohanH']);
    expect(sim.errors).toEqual([]);
  });

  it('lets Roshi collect his ramen coupon after the finale', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 12;
    for (const id of ['goku', 'trunks'] as const) st.join(id, 40);
    st.data.active = 'goku';
    st.set('c11_finaleDone');
    st.set('c11_farewell');
    st.give('c11_coupon', 1, 1);
    const roshis = () => sim.game.field?.npcs.filter((n) => n.spriteId === 'roshi').map((n) => n.def.id) ?? [];
    await enter(sim, 'kame_island', 21, 15);
    expect(roshis()).toEqual(['c11_roshiP']);
    const pow = st.count('pow1');
    expect(await talk(sim, 'c11_roshiP')).toBe(true);
    expect(st.flag('c11_couponJoke')).toBe(true);
    expect(st.count('c11_coupon')).toBe(0);
    expect(st.count('pow1')).toBe(pow + 1);
    // Until the next visit the porch Roshi stands in for the training-hall one.
    expect(await talk(sim, 'c11_roshiP')).toBe(true);
    await enter(sim, 'kame_island', 21, 15);
    expect(roshis()).not.toContain('c11_roshiP');
    expect(roshis().length).toBeLessThanOrEqual(1);
    expect(sim.errors).toEqual([]);
  });

  it('warns before each point of no return and closes the errands the end of the timeline strands', async () => {
    // The finale trigger: "Not yet" backs off without starting anything (and names the open future errands).
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 11;
    for (const id of ['goku', 'vegeta', 'trunks'] as const) st.join(id, 38);
    st.data.active = 'trunks';
    st.set('c11_inFuture');
    st.set('c11_riftSeen');
    st.addQuest('c11_q_rift');
    st.addQuest('c11_q_notes');
    await enter(sim, 'c11_rift_sky', 14, 18);
    const lines = recordLines(sim);
    sim.choice = 1;
    expect(await sim.run('c11_showdown', {}, BIG)).toBe(true);
    expect(sim.errors).toEqual([]);
    expect(st.flag('c11_finaleLock')).toBe(false);
    expect(st.flag('c11_roseBeaten')).toBe(false);
    expect(sim.game.field?.def.id).toBe('c11_rift_sky');
    expect(Math.round(((sim.game.field?.player.y ?? 0) - 14) / 16)).toBe(15);
    expect(sim.game.field?.enemies.some((e) => e.def.id === 'c11_blackClone')).toBe(true);
    expect(lines.some((l) => l.text.includes('Unfinished: Mother\'s notebook'))).toBe(true);

    // The third trip: Bulma names the errands that must be finished in the present before leaving.
    const sim2 = new Sim();
    const st2 = sim2.game.state;
    st2.data.chapter = 11;
    for (const id of ['goku', 'trunks'] as const) st2.join(id, 38);
    st2.data.active = 'trunks';
    st2.set('c09_cellOut');
    st2.addQuest('c11_q_return');
    st2.addQuest('c09_q_homework');
    st2.give('c11_urn', 1, 1);
    st2.give('c11_charm', 1, 1);
    await enter(sim2, 'cc_yard', 31, 10);
    const lines2 = recordLines(sim2);
    sim2.choice = 1;
    expect(await talk(sim2, 'c09_bulmaPad')).toBe(true);
    expect(sim2.errors).toEqual([]);
    expect(lines2.some((l) => l.text.includes('Unfinished in the present: Remedial math'))).toBe(true);
    expect(st2.data.journal.c11_q_return).toBe('active');

    // The farewell takes errands that can never be finished out of the journal; finished ones stay.
    const orig = SCRIPTS.c12_start;
    SCRIPTS.c12_start = async () => undefined;
    try {
      const sim3 = new Sim();
      const st3 = sim3.game.state;
      st3.data.chapter = 11;
      for (const id of ['goku', 'vegeta', 'trunks'] as const) st3.join(id, 40);
      st3.data.active = 'trunks';
      st3.set('noSwitch');
      for (const id of ['c09_q_homework', 'c11_q_notes', 'c11_q_survivors']) st3.addQuest(id);
      st3.completeQuest('c11_q_survivors');
      await enter(sim3, 'cc_yard', 23, 22);
      expect(await sim3.run('c11_epilogue', {}, BIG)).toBe(true);
      expect(sim3.errors).toEqual([]);
      expect(st3.data.journal.c09_q_homework).toBeUndefined();
      expect(st3.data.journal.c11_q_notes).toBeUndefined();
      expect(st3.data.journal.c11_q_survivors).toBe('done');
      expect(st3.data.journalOrder).not.toContain('c09_q_homework');
      expect(openAct4(sim3)).toEqual([]);
      expect(st3.flag('noSwitch')).toBe(false);
    } finally {
      if (orig) SCRIPTS.c12_start = orig;
      else delete SCRIPTS.c12_start;
    }
  });
});
