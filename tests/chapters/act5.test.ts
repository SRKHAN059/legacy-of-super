import { describe, expect, it } from 'vitest';
import { CAST } from '../../src/content/cast';
import { handOff } from '../../src/content/chapters/act5/helpers';
import { SATAN_RULE_GOKU_LEVEL } from '../../src/content/chapters/act5/post';
import { CREATURES } from '../../src/content/creatures';
import { ENEMIES } from '../../src/content/enemies';
import { QUESTS } from '../../src/content/quests';
import { resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { measure } from '../../src/engine/fontdata';
import type { Button } from '../../src/engine/input';
import { EXP_TABLE } from '../../src/game/leveling';
import { SCRIPTS } from '../../src/game/script';
import { parseGrid } from '../../src/game/world';
import { Sim } from '../sim';

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/**
 * Act 5 chain: Chapter 12 → 13 → 14 → credits → post-game, driven headlessly. Each beat is run the way the
 * player reaches it (talk/trigger script on its map); the chain asserts flags, quests, forms, techniques and joins.
 */

const TICKS = 400000;

/** Tick until no script holds the controls (onEnter scripts started by warps finish too). */
async function settle(sim: Sim, max = TICKS): Promise<void> {
  let idle = 0;
  for (let i = 0; i < max && idle < 6; i += 5) {
    await sim.tick(5);
    idle = sim.game.lockDepth === 0 ? idle + 1 : 0;
  }
}

/** Start on a map, let its onEnter scripts finish, then run a script (with the NPC that owns it, if any). */
async function beat(sim: Sim, map: string | null, script: string, x?: number, y?: number): Promise<void> {
  if (map) {
    sim.start(map, x, y);
    await settle(sim);
  }
  const npc = sim.game.field?.npcs.find((n) => n.def.talk === script);
  expect(await sim.run(script, npc ? { npc } : {}, TICKS), `${script} finished`).toBe(true);
  await settle(sim);
  expect(sim.errors, `${script} errors`).toEqual([]);
}

/** Knock out the free-roaming (non-scripted) enemies on the current map, as a player clearing a zone would. */
function pacify(sim: Sim): void {
  const f = sim.game.field;
  if (!f) return;
  for (const e of f.enemies) if (!e.uid && !e.dead) e.dead = true;
}

/** One recorded dialogue line, with who was on the field when it was shown. */
interface Said {
  text: string;
  map: string;
  hero: string;
  npcs: string[];
}

/** Record every dialogue line (and the actors on the field at that moment). */
function record(sim: Sim): Said[] {
  const log: Said[] = [];
  const g = sim.game;
  const orig = g.say.bind(g);
  g.say = (lines) => {
    for (const l of lines) log.push({ text: l.text, map: g.field?.def.id ?? '', hero: g.state.data.active, npcs: g.field?.npcs.map((n) => n.def.id) ?? [] });
    return orig(lines);
  };
  return log;
}

/** Record every credits roll (the full list of lines each time). */
function recordCredits(sim: Sim): string[][] {
  const rolls: string[][] = [];
  const g = sim.game;
  const orig = g.credits.bind(g);
  g.credits = (lines) => {
    rolls.push([...lines]);
    return orig(lines);
  };
  return rolls;
}

/**
 * Drive the game like a player who reads dialogue (A on text boxes, first choice) but never attacks, so a scripted
 * fight stays in progress. `hold` keeps buttons down (walking into an edge). The hero is kept at full HP.
 */
async function drive(sim: Sim, n: number, hold: Button[] = []): Promise<void> {
  let a = false;
  for (let i = 0; i < n; i++) {
    const top = sim.game.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|BeamStruggle|Choice/.test(top)) { a = !a; sim.input.inject('A', a); } else sim.input.inject('A', false);
    for (const b of hold) sim.input.inject(b, true);
    sim.input.poll();
    sim.game.scenes.update(sim.input);
    for (const b of hold) sim.input.inject(b, false);
    const f = sim.game.field;
    if (f) f.player.cs.hp = f.player.cs.hpMax;
    await flush();
  }
}

/** `drive` until a condition holds (fails the test if it never does). */
async function driveUntil(sim: Sim, what: string, cond: () => boolean, max = 30000): Promise<void> {
  for (let i = 0; i < max && !cond(); i += 5) await drive(sim, 5);
  expect(cond(), what).toBe(true);
}

/** The state a scripted fight leaves the player in: control handed over, map sealed. */
function midFight(sim: Sim): boolean {
  return sim.game.allowControl && sim.game.state.flag('act5_busy') && sim.game.scenes.top === sim.game.field;
}

/** Stand the hero on a tile (feet on the tile, facing `dir`). */
function put(sim: Sim, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right' = 'down'): void {
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  f.player.x = x * 16 + 8;
  f.player.y = y * 16 + 14;
  f.player.dir = dir;
}

/**
 * Save on the spot and load it again, the way `Game.continueGame` does (headless saves have no storage).
 * Stands in for every way of leaving a fight: a mid-fight save, a Game Over and reload, or Whis's Charm and back.
 */
function reload(sim: Sim): void {
  const g = sim.game;
  const f = g.field;
  if (!f) throw new Error('no field');
  // The saved data round-trips through JSON; the test keeps the same GameState object so its `st` stays valid.
  const data = JSON.parse(JSON.stringify({ ...g.state.data, map: f.def.id, x: f.player.x, y: f.player.y, dir: f.player.dir }));
  Object.assign(g.state.data, data);
  // Mirrors Game.continueGame(): a reload clears cutscene and fight seals.
  g.lockDepth = 0;
  g.fightDepth = 0;
  g.allowControl = false;
  g.startField(data.map, data.x / 16 - 0.5, data.y / 16 - 0.875, data.dir);
}

/** Map objects that can take the player off the map or open the save menu. */
function exitsAndSaves(sim: Sim): Array<{ gone: boolean }> {
  return sim.game.field?.map.objects.filter((o) => o.def.type === 'flight' || o.def.type === 'worldSign' || o.def.type === 'save') ?? [];
}

function freshSim(chapter: number, level: number): Sim {
  const sim = new Sim();
  const st = sim.game.state;
  st.data.chapter = chapter;
  st.join('goku', level);
  st.data.active = 'goku';
  return sim;
}

describe('act 5 chain (Ch12 → Ch14 → post-game)', () => {
  it('act 5 enemies have valid sprites, phase scripts, minions and balance bands', () => {
    const mine = Object.values(ENEMIES).filter((e) => /^(c12_|c13_|c14_|post_)/.test(e.id));
    expect(mine.length).toBeGreaterThan(40);
    for (const e of mine) {
      expect(!!(CAST[e.sprite] || CREATURES[e.sprite]), `${e.id} sprite`).toBe(true);
      expect(e.end, `${e.id} END`).toBeLessThan(124);
      if (e.boss?.minion) expect(ENEMIES[e.boss.minion], `${e.id} minion`).toBeTruthy();
      for (const ph of e.boss?.phases ?? []) if (ph.onStart) expect(SCRIPTS[ph.onStart], `${e.id} ${ph.onStart}`).toBeTruthy();
    }
    // Finale band (Guide §6: 8200-12000 HP); Jiren is the hardest boss of the tournament.
    const top = mine.filter((e) => e.id.startsWith('c14_') && e.ai === 'boss');
    for (const e of top) expect(e.hp, e.id).toBeGreaterThanOrEqual(8200);
    const jiren = ENEMIES.c14_jiren2;
    for (const e of top) if (!e.id.startsWith('c14_jiren')) expect(e.str + e.pow + e.end, e.id).toBeLessThan(jiren.str + jiren.pow + jiren.end);
  });

  it('plays from c12_start through the credits, the trophies, Mr. Satan and the ZTV ending', async () => {
    const sim = freshSim(11, 40);
    const st = sim.game.state;
    const q = (id: string) => st.data.journal[id];
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const rolls = recordCredits(sim);

    // ---------------- Chapter 12: Days of Peace
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    await beat(sim, null, 'c12_start');
    expect(st.data.chapter).toBe(12);
    expect(q('c12_days')).toBe('active');
    for (const id of ['c12_hit', 'c12_pan', 'c12_saiyaman', 'c12_krillin']) expect(q(id)).toBe('active');
    expect(st.data.regions).toContain('spot_snow');
    expect(st.char('vegeta').joined && st.char('gohan').joined && st.char('piccolo').joined && st.char('trunks').joined).toBe(true);

    // Episode: Hit's contract (Beerus/Whis hint → hotel porter → rooftop at night).
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(st.flag('c12_hitHinted')).toBe(true);
    // Whis is Act 2's garden-table NPC: act 5 never stages a second one.
    expect(sim.game.field?.npcs.filter((n) => n.spriteId === 'whis').length).toBe(1);
    await beat(sim, 'satan_plaza', 'c12_porter_talk', 31, 6);
    expect(sim.game.field?.def.id).toBe('c12_rooftop');
    expect(q('c12_hit')).toBe('done');
    expect(st.flag('c12_finished')).toBe(false);

    // Episode: Pan's first flight (chase, carry, deliver) → second episode closes the chapter → c13_start.
    await beat(sim, 'paozu_valley', 'c12_videl_talk', 8, 8);
    expect(sim.game.field?.def.id).toBe('c12_pan_meadow');
    pacify(sim);
    for (let i = 0; i < 4; i++) await beat(sim, null, 'c12_pan_talk');
    expect(st.flag('c12_panCaught')).toBe(true);
    expect(sim.game.field?.carrying).toBeTruthy();
    // A hit while carrying: Pan wriggles free and flies back to the south-west meadow; catch her again.
    const f12 = sim.game.field;
    if (!f12) throw new Error('no field');
    f12.player.inv = 0;
    expect(f12.damagePlayer(10, 1, f12.player.x + 8, f12.player.y)).toBeGreaterThan(0);
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.flag('c12_panCaught')).toBe(false);
    expect(sim.game.field?.carrying).toBeFalsy();
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c12_pan')).toBe(true);
    await beat(sim, null, 'c12_pan_talk');
    expect(st.flag('c12_panCaught')).toBe(true);
    await beat(sim, null, 'c12_videl_meadow');
    expect(q('c12_pan')).toBe('done');
    expect(q('c12_days')).toBe('done');

    // ---------------- Chapter 13: Universe Survival (Zeno Expo ran inside c13_start)
    expect(st.data.chapter).toBe(13);
    expect(st.flag('defeated:c13_toppo1') || st.flag('c13_expoSeen')).toBe(true);
    expect(q('c13_team')).toBe('active');
    expect(st.data.regions).toContain('spot_monster');
    expect(st.count('c13_contract')).toBe(1);

    await beat(sim, 'satan_plaza', 'c13_krillin_talk', 21, 23);
    expect(q('c13_krillin')).toBe('done');

    await beat(sim, 'kame_island', 'c13_chiaotzu_talk', 16, 14);
    expect(sim.game.field?.def.id).toBe('c13_tien_dojo');
    await beat(sim, null, 'c13_dojo_event');
    expect(q('c13_tien')).toBe('done');

    await beat(sim, 'lookout', 'c13_piccolo_talk', 26, 23);
    expect(q('c13_gohan')).toBe('done');
    expect(st.char('gohan').form).toBe('ultimate');
    expect(st.char('gohan').techs).toContain('kamehameha');
    expect(st.char('piccolo').techs).toContain('hellzoneGrenade');
    expect(st.data.active).toBe('goku');
    expect(st.flag('noSwitch')).toBe(false);

    await beat(sim, 'c13_monster_beach', 'c13_beach_enter', 16, 16);
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(st.flag('c13_17met')).toBe(true);
    await beat(sim, 'c13_monster_camp', 'c13_camp_boss', 20, 12);
    expect(q('c13_17')).toBe('done');
    expect(st.flag('c13_animalsLoose')).toBe(true);
    expect(q('c13_animals')).toBe('active');
    expect(q('c13_frieza')).toBe('active');

    // Bronze: the seven escaped animals.
    const animals: Array<[string, string]> = [
      ['c13_monster_beach', 'c13_ani1'], ['snow_peak', 'c13_ani2'], ['c13_monster_camp', 'c13_ani3'], ['paozu_peaks', 'c13_ani4'],
      ['waste_canyon', 'c13_ani5'], ['c13_baba_lake', 'c13_ani6'], ['paozu_home', 'c13_ani7'],
    ];
    for (const [map, id] of animals) {
      sim.start(map);
      await settle(sim);
      const npc = sim.game.field?.npcs.find((n) => n.def.id === id);
      expect(npc, `${id} on ${map}`).toBeTruthy();
      expect(await sim.run('c13_animal_talk', { npc }, TICKS)).toBe(true);
      expect(st.flag(`c13_ani_${id}`)).toBe(true);
    }
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(q('c13_animals')).toBe('done');

    // The tenth warrior: Beerus & Whis → Hell → Baba → Golden Frieza → Chapter 14 (stage A runs inline).
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(q('c13_frieza')).toBe('done');
    expect(q('c13_team')).toBe('done');

    // Frieza is revived for twenty-four hours: the tournament is the same day, not "in two days".
    expect(said(/In a few hours, in the World of Void/)).toBeGreaterThan(-1);
    expect(said(/In two days/)).toBe(-1);

    // ---------------- Chapter 14: Tournament of Power (gathering at Capsule Corp, then Beerus departs → stage A)
    expect(st.data.chapter).toBe(14);
    // Before departure the gold star points at Capsule Corp (Beerus); the tournament quest itself points at Zeno's palace.
    expect(q('c14_ready')).toBe('active');
    expect(q('c14_top')).toBeUndefined();
    expect(QUESTS.c14_ready.region).toBe('spot_westcity');
    expect(QUESTS.c14_top.region).toBe('spot_zeno');
    // Goku names Gohan team leader at the gathering (Dyspo calls him that later).
    expect(said(/Gohan's our team leader/)).toBeGreaterThan(-1);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(st.flag('c14_stageA')).toBe(false);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'act5_vegeta')).toBe(false);
    await beat(sim, null, 'act5_beerus_talk');
    expect(st.flag('c14_departed')).toBe(true);
    expect(q('c14_ready')).toBe('done');
    expect(q('c14_top')).toBe('active');
    expect(st.flag('c14_stageA')).toBe(true);
    expect(st.flag('act5_busy')).toBe(false);
    expect(st.char('goku').techs).toContain('spiritBomb');
    // Anime order (dbs_story.md eps 98-111): U9 erased → Krillin out → Kale stopped → U10 erased, Tien, Roshi →
    // Frieza eliminates Frost (as the forced guest) → Goku vs Jiren and UI -Sign- → Hit's elimination.
    expect(st.flag('defeated:c14_frost1')).toBe(true);
    const chronoA = [/Universe 9 vanishes/, /Krillin has been eliminated/, /He stopped her\.\.\. with one shot/, /erases Universe 10/,
      /Master Roshi frees Vegeta/, /Frost has been eliminated by Frieza/, /^Jiren! Fight me!/, /^Ultra Instinct -Sign-\./, /Hit traps Jiren/];
    const idxA = chronoA.map((re) => said(re));
    for (const [i, re] of chronoA.entries()) expect(idxA[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idxA.length; i++) expect(idxA[i], `${chronoA[i]} after ${chronoA[i - 1]}`).toBeGreaterThan(idxA[i - 1]);
    expect(log[said(/^\.\.\.said no one with any taste/)]?.hero).toBe('frieza');
    expect(st.char('android17').level).toBeGreaterThanOrEqual(46);
    expect(st.char('frieza').level).toBeGreaterThanOrEqual(47);
    expect(st.flag('noSwitch')).toBe(false);
    // Between relays the stage is a hostile zone again: rival fighters roam until the next relay sweeps them.
    expect(st.flag('fc_topQuiet')).toBe(false);
    sim.start('top_arena_b', 3, 15);
    await settle(sim);
    expect(sim.game.field?.enemies.filter((e) => !e.uid && !e.dead).length).toBeGreaterThan(0);

    await beat(sim, null, 'c14_stageB');
    expect(sim.game.field?.enemies.filter((e) => !e.uid && !e.dead).length).toBe(0);
    expect(st.flag('c14_stageB')).toBe(true);
    expect(st.flag('defeated:c14_frost1')).toBe(true);
    expect(st.flag('c14_reactorDown')).toBe(true);
    expect(st.data.active).toBe('goku');

    // Stage B opens with Kefla (eps 112-116): Frost and Universe 10 are already history.
    const stageBFrom = said(/Told you we'd be back, Universe 7/);
    expect(stageBFrom).toBeGreaterThan(said(/Hit traps Jiren/));
    expect(said(/Universe 4 is erased/)).toBeGreaterThan(stageBFrom);

    await beat(sim, 'top_arena_c', 'c14_stageC', 3, 17);
    expect(st.char('vegeta').form).toBe('ssbe');
    // Stage C (eps 122-131): Vegeta first reaches SSB Evolved against Jiren, then Dyspo takes Gohan out (ep 124)
    // before Vegeta, in SSB Evolved again, eliminates Toppo (eps 125-126); then Mastered Ultra Instinct.
    const chronoC = [/Super Saiyan Blue, Evolved!/, /has achieved SSB Evolved/, /Gohan has been eliminated/, /Toppo is blasted clean off the stage/,
      /Mastered Ultra Instinct!/, /Universe 7 is the winner/];
    const idxC = chronoC.map((re) => said(re));
    for (const [i, re] of chronoC.entries()) expect(idxC[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idxC.length; i++) expect(idxC[i], `${chronoC[i]} after ${chronoC[i - 1]}`).toBeGreaterThan(idxC[i - 1]);
    expect(log.filter((l) => /has achieved SSB Evolved/.test(l.text)).length).toBe(1);
    expect(st.char('vegeta').techs).toContain('finalFlash');
    expect(q('c14_top')).toBe('done');
    expect(st.flag('c14_won')).toBe(true);
    // Relay hand-offs leave the outgoing fighter on the stage: Frieza talks to a knocked-out Goku who is there,
    // and 17 answers with Frieza (and Goku) still standing beside him.
    const getUp = log.find((l) => /^Get up, Goku/.test(l.text));
    expect(getUp?.hero).toBe('frieza');
    expect(getUp?.npcs).toContain('c14_gokuKO');
    const rightHere = log.find((l) => /^Right here\./.test(l.text));
    expect(rightHere?.hero).toBe('android17');
    expect(rightHere?.npcs).toEqual(expect.arrayContaining(['c14_gokuKO', 'c14_friezaHurt']));
    const toGohan = log.find((l) => /the fast one is yours/.test(l.text));
    expect(toGohan?.hero).toBe('gohan');
    expect(toGohan?.npcs).toContain('c14_vegetaC');
    // Every erased universe is shown being erased before the wish restores them.
    const wish = said(/I am Super Shenron/);
    for (const re of [/Universe 9 vanishes/, /erases Universe 10/, /Universe 6 and Universe 2/, /Universe 4 is erased/, /Universe 3 is erased/, /Universe 11 has no fighters left/]) {
      const i = said(re);
      expect(i, String(re)).toBeGreaterThan(-1);
      expect(i, String(re)).toBeLessThan(wish);
    }
    // Goku's level when Universe 7 won is kept for LoG2's Mr. Satan rule.
    expect(st.get('c14_gokuLv')).toBe(st.char('goku').level);
    // The arena is the World of Void throughout (never "Null Realm").
    expect(said(/welcome to the World of Void/)).toBeGreaterThan(-1);
    expect(log.filter((l) => /Null Realm/.test(l.text))).toEqual([]);

    // ---------------- Post-game: free roam starts right after the wish (LoG2 §16); no credits yet.
    expect(st.flag('post_game')).toBe(true);
    expect(st.data.active).toBe('goku');
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(rolls).toEqual([]);
    expect(said(/There is no boat, Marron/)).toBe(-1);
    // The hub NPCs hold the canonical ending: the journal's gold star points at them (LoG2's "Talk to Dende").
    expect(q('post_trueEnd')).toBe('active');
    expect(QUESTS.post_trueEnd.star).toBe('gold');
    expect(q('post_hit')).toBe('active');
    expect(st.char('satan').joined).toBe(false);

    // True ending with Beerus and Whis: Whis's staff shows the epilogue, then the credits roll, then free roam.
    const endFrom = log.length;
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(q('post_trueEnd')).toBe('done');
    expect(rolls.length).toBe(1);
    expect(rolls[0]).toContain('#Universe 7: The Mighty Ten');
    expect(said(/There is no boat, Marron/)).toBeGreaterThanOrEqual(endFrom);
    expect(said(/two Saiyans kept on fighting/)).toBeGreaterThan(said(/There is no boat, Marron/));
    expect(said(/^THE END\./)).toBeGreaterThan(said(/two Saiyans kept on fighting/));
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(st.flag('post_inEnding')).toBe(false);

    // 25 delicacies: Act 5's Beerus never pays Whis's reward; Act 2's Whis gives the charm exactly once.
    st.give('delicacy', 25, 25);
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(st.count('whisStaff')).toBe(0);
    if (SCRIPTS.c04_whis_talk) {
      await beat(sim, 'cc_yard', 'c04_whis_talk', 23, 18);
      expect(st.count('whisStaff')).toBe(1);
      await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
      expect(st.count('whisStaff')).toBe(1);
    }

    // Trophies → Mr. Satan joins on the next hub entry (L40 only if Goku was L48+ when Universe 7 won, else L1).
    for (const t of ['trophyGoku', 'trophyVegeta', 'trophyGohan', 'trophyTrunks', 'trophyPiccolo']) st.give(t, 1, 1);
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.char('satan').joined).toBe(true);
    expect(st.char('satan').level).toBe(Number(st.get('c14_gokuLv') ?? 0) >= SATAN_RULE_GOKU_LEVEL ? 40 : 1);
    expect(q('post_trophies')).toBe('done');
    expect(q('post_ztv')).toBe('active');

    // Alternate ending: Mr. Satan at L50 breaks the ZTV gate, then walks into the courtyard trigger.
    st.join('satan', 50);
    st.data.active = 'satan';
    st.set('gate:satan_plaza:ztv_gate');
    await beat(sim, 'satan_plaza', 'post_ztv_ending', 8, 8);
    expect(q('post_ztv')).toBe('done');
    expect(st.flag('post_ztvSeen')).toBe(true);
    expect(sim.game.field?.def.id).toBe('satan_plaza');
    // The comedic alternative ending rolls its own credits.
    expect(rolls.length).toBe(2);
    expect(rolls[1]).toContain('#The Legend of Mr. Satan');

    // 7 animals → 17 → Jiren's rematch at Zeno's palace (pow5/str5/end5).
    st.data.active = 'goku';
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(q('post_jiren')).toBe('active');
    const before = { pow5: st.count('pow5'), str5: st.count('str5'), end5: st.count('end5') };
    await beat(sim, 'zeno_palace', 'post_jiren_talk', 28, 7);
    expect(q('post_jiren')).toBe('done');
    expect(st.count('pow5')).toBe(before.pow5 + 1);
    expect(st.count('str5')).toBe(before.str5 + 1);
    expect(st.count('end5')).toBe(before.end5 + 1);

    // Hit's no-rules contract on the rooftop.
    await beat(sim, 'c12_rooftop', 'post_hit_talk', 8, 16);
    expect(q('post_hit')).toBe('done');
  });

  it('the other two Chapter 12 episodes (Saiyaman movie, Forest of Terror) also finish the chapter', async () => {
    const sim = freshSim(11, 40);
    const st = sim.game.state;
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    await beat(sim, null, 'c12_start');

    await beat(sim, 'satan_plaza', 'c12_director_plaza', 9, 14);
    expect(st.data.journal.c12_saiyaman).toBe('done');
    expect(st.count('c12_reel')).toBe(1);
    expect(st.char('gohan').outfit).toBeUndefined();
    expect(st.data.active).toBe('goku');
    expect(st.data.chapter).toBe(12);

    await beat(sim, 'kame_island', 'c12_krillin_kame', 23, 14);
    expect(sim.game.field?.def.id).toBe('c12_forest');
    await beat(sim, null, 'c12_forest_boss');
    expect(st.flag('c12_calm')).toBe(true);
    expect(st.count('c12_herb')).toBe(1);
    // The boat lands at Kame House and Master Roshi comes down to the beach for his herb (no talking needed).
    const log = record(sim);
    await beat(sim, null, 'c12_forest_leave');
    expect(log.some((l) => l.map === 'kame_island' && /the Paradise Herb\? Hand it over/.test(l.text))).toBe(true);
    expect(st.data.journal.c12_krillin).toBe('done');
    expect(st.count('c12_herb')).toBe(0);
    expect(st.data.journal.c12_days).toBe('done');
    expect(st.data.chapter).toBe(13);
  });

  it('keeps skipped episodes reachable after the credits and never strands the player', async () => {
    // Post-game, Hit's episode never started: Beerus still gives the assassin hint after the true ending.
    const sim = freshSim(15, 48);
    const st = sim.game.state;
    st.set('post_game');
    st.addQuest('c12_hit');
    st.addQuest('post_trueEnd');
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(st.data.journal.post_trueEnd).toBe('done');
    expect(st.flag('c12_hitHinted')).toBe(false);
    await beat(sim, null, 'act5_beerus_talk');
    expect(st.flag('c12_hitHinted')).toBe(true);
    await beat(sim, 'satan_plaza', 'c12_porter_talk', 31, 6);
    expect(st.data.journal.c12_hit).toBe('done');
    expect(st.data.journal.post_hit).toBe('active');

    // Chapter 14 before departure: the Grand Priest does not send anyone to an empty stage.
    const sim2 = freshSim(14, 45);
    sim2.game.state.addQuest('c14_top');
    await beat(sim2, 'zeno_palace', 'c14_gp_talk', 22, 8);
    expect(sim2.game.field?.def.id).toBe('zeno_palace');
  });

  it('runs every act 5 NPC talk script in early, story and post-game states', async () => {
    const maps = [
      'c12_rooftop', 'c12_pan_meadow', 'c12_film_set', 'c12_forest', 'c13_monster_beach', 'c13_monster_jungle', 'c13_monster_hut',
      'c13_monster_hut_in', 'c13_monster_camp', 'c13_tien_dojo', 'c13_training_wilds', 'c13_baba_lake', 'post_ztv_studio',
      'paozu_valley', 'paozu_home', 'satan_plaza', 'kame_island', 'lookout', 'cc_yard', 'zeno_palace', 'top_arena_a',
    ];
    const talks = new Set<string>();
    for (const id of maps) {
      for (const n of resolveMap(id)?.npcs ?? []) {
        if (/^(c1[234]_|post_|act5_)/.test(n.talk)) talks.add(n.talk);
      }
    }
    expect(talks.size).toBeGreaterThan(20);
    const states: Array<(sim: Sim) => void> = [
      () => undefined,
      (sim) => { sim.game.state.data.chapter = 12; },
      (sim) => { const st = sim.game.state; st.data.chapter = 13; st.addQuest('c13_krillin'); st.addQuest('c13_tien'); st.addQuest('c13_gohan'); st.addQuest('c13_17'); st.set('c13_animalsLoose'); },
      (sim) => { const st = sim.game.state; st.data.chapter = 15; st.set('post_game'); st.join('satan', 40); st.data.active = 'satan'; },
    ];
    for (const prep of states) {
      for (const sid of talks) {
        expect(SCRIPTS[sid], sid).toBeTruthy();
        const sim = freshSim(0, 1);
        prep(sim);
        sim.start('c13_monster_hut', 16, 12);
        await settle(sim);
        expect(await sim.run(sid, {}, TICKS), `${sid} finished`).toBe(true);
        await settle(sim);
        expect(sim.errors, `${sid} errors`).toEqual([]);
      }
    }
  });

  it('act 5 placements stand on open ground and key spots are reachable', async () => {
    const CASES: Array<[string, [number, number], Array<[number, number]>]> = [
      ['c12_pan_meadow', [19, 25], [[8, 7], [29, 4], [33, 20], [6, 21], [21, 24]]],
      ['c12_forest', [20, 30], [[20, 6], [16, 17], [20, 33], [28, 6]]],
      ['c12_film_set', [20, 21], [[19, 24], [20, 12], [3, 22]]],
      ['c12_rooftop', [8, 16], [[9, 19], [27, 8]]],
      ['c13_monster_beach', [16, 16], [[16, 0], [30, 11]]],
      ['c13_monster_jungle', [16, 32], [[21, 0], [43, 11], [8, 30]]],
      ['c13_monster_hut', [1, 11], [[16, 10], [19, 8], [10, 17]]],
      ['c13_monster_camp', [21, 26], [[20, 10], [30, 23]]],
      ['c13_tien_dojo', [18, 23], [[18, 19], [33, 11]]],
      ['c13_training_wilds', [18, 15], [[33, 6], [6, 13]]],
      ['c13_baba_lake', [18, 23], [[4, 20], [18, 14], [15, 6]]],
      ['post_ztv_studio', [10, 9], [[11, 4], [9, 11]]],
      ['satan_plaza', [27, 28], [[31, 5], [8, 14], [20, 23], [14, 23], [8, 12]]],
      ['kame_island', [20, 23], [[24, 14], [16, 13]]],
      ['lookout', [22, 28], [[27, 23], [22, 11]]],
      ['cc_yard', [21, 9], [[25, 16], [20, 18], [17, 19], [23, 17]]],
      ['zeno_palace', [20, 26], [[29, 7], [23, 6]]],
      ['paozu_home', [31, 10], [[35, 21], [21, 9], [35, 8]]],
      ['top_arena_a', [3, 15], [[2, 16], [22, 19]]],
      ['top_arena_b', [1, 15], [[3, 15], [12, 15], [38, 22]]],
      ['top_arena_c', [1, 15], [[3, 17], [8, 15]]],
    ];
    for (const [id, [sx, sy], goals] of CASES) {
      const sim = new Sim();
      sim.start(id);
      const f = sim.game.field;
      if (!f) throw new Error(id);
      const open = (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
      const m = resolveMap(id);
      for (const n of m?.npcs ?? []) if (/^(c1[234]_|post_|act5_)/.test(n.id)) expect(open(n.x, n.y), `${id}: npc ${n.id}`).toBe(true);
      if (/^(c1[234]_|post_)/.test(id)) for (const e of m?.enemies ?? []) expect(open(e.x, e.y), `${id}: enemy ${e.type} ${e.x},${e.y}`).toBe(true);
      const seen = new Set<string>([`${sx},${sy}`]);
      const queue: Array<[number, number]> = [[sx, sy]];
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = next[0] + dx;
          const ny = next[1] + dy;
          const k = `${nx},${ny}`;
          if (seen.has(k) || nx < 0 || ny < 0 || nx >= f.map.cols || ny >= f.map.rows || !open(nx, ny)) continue;
          seen.add(k);
          queue.push([nx, ny]);
        }
      }
      for (const [gx, gy] of goals) {
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${gx + dx},${gy + dy}`));
        expect(near, `${id}: ${gx},${gy} reachable from ${sx},${sy}`).toBe(true);
      }
    }
  });
});

describe('act 5 fights cannot strand the player', () => {
  it('tournament stage A: exits shut mid-fight, and leaving or reloading restarts the relay', async () => {
    const sim = freshSim(13, 45);
    const st = sim.game.state;
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    await beat(sim, null, 'c14_start');
    const npc = sim.game.field?.npcs.find((n) => n.def.id === 'act5_beerus');
    expect(npc).toBeTruthy();
    void sim.game.runScript('act5_beerus_talk', { npc });
    await driveUntil(sim, 'stage A wave fight', () => sim.game.field?.def.id === 'top_arena_a' && midFight(sim));
    expect(st.flag('c14_departed') && st.flag('c14_opened') && !st.flag('c14_stageA')).toBe(true);
    // Flight circles and the save disc are sealed, so pressing A (also the attack button) on them does nothing.
    expect(exitsAndSaves(sim).length).toBeGreaterThan(0);
    expect(exitsAndSaves(sim).every((o) => o.gone)).toBe(true);
    put(sim, 3, 15, 'up');
    expect(sim.game.field?.tryInteract()).toBe(false);
    put(sim, 6, 8, 'down');
    expect(sim.game.field?.tryInteract()).toBe(false);
    // Walking off the east edge into the central ring does nothing until stage A is won.
    put(sim, 43, 15, 'right');
    await drive(sim, 40, ['right']);
    expect(sim.game.field?.def.id).toBe('top_arena_a');

    // Leave mid-fight (save + reload stands in for Whis's Charm and the Grand Priest's return trip): stage A restarts.
    reload(sim);
    expect(st.flag('act5_busy')).toBe(false);
    // Wait on the relay itself, not only on the lock count (the abandoned pre-reload script also unwinds now).
    for (let i = 0; i < TICKS && !st.flag('c14_stageA'); i += 5) await sim.tick(5);
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.flag('c14_stageA')).toBe(true);
    expect(st.flag('noSwitch')).toBe(false);
    expect(st.flag('fc_topQuiet')).toBe(false);
    expect(st.flag('act5_busy')).toBe(false);
    expect(exitsAndSaves(sim).every((o) => !o.gone)).toBe(true);
    // Now the way east is open.
    put(sim, 43, 15, 'right');
    await drive(sim, 40, ['right']);
    expect(sim.game.field?.def.id).toBe('top_arena_b');
  });

  it('the Grand Priest sends a player who left mid-tournament back to the right ring', async () => {
    const sim = freshSim(14, 45);
    const st = sim.game.state;
    for (const f of ['c14_departed', 'c14_opened']) st.set(f);
    st.addQuest('c14_top');
    st.set('noSwitch');
    st.data.active = 'goku';
    // Mid-tournament on Earth: Beerus is in the stands, Bulma points the way, the journal star is at Zeno's palace.
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'act5_beerus')).toBe(false);
    const log = record(sim);
    await beat(sim, null, 'act5_bulma_talk');
    expect(log.some((l) => /Zeno's palace/.test(l.text))).toBe(true);
    await beat(sim, 'zeno_palace', 'c14_gp_talk', 22, 8);
    expect(st.flag('c14_stageA')).toBe(true);
    expect(st.flag('noSwitch')).toBe(false);
    await beat(sim, 'zeno_palace', 'c14_gp_talk', 22, 8);
    expect(sim.game.field?.def.id).toBe('top_arena_b');
  });

  it('stage B and C trigger bands cannot be walked around, and the next ring stays shut until they are won', () => {
    for (const [id, trig] of [['top_arena_b', 'c14_stageB_t'], ['top_arena_c', 'c14_stageC_t']] as const) {
      const sim = new Sim();
      sim.game.state.data.chapter = 14;
      sim.start(id, 1, 15);
      const f = sim.game.field;
      if (!f) throw new Error(id);
      const t = resolveMap(id)?.triggers?.find((x) => x.id === trig);
      if (!t) throw new Error(trig);
      const inBand = (x: number, y: number) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h;
      const open = (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 }) && !inBand(x, y);
      const seen = new Set(['1,15']);
      const queue: Array<[number, number]> = [[1, 15]];
      while (queue.length) {
        const [x, y] = queue.shift() as [number, number];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (seen.has(`${nx},${ny}`) || nx < 0 || ny < 0 || nx >= f.map.cols || ny >= f.map.rows || !open(nx, ny)) continue;
          seen.add(`${nx},${ny}`);
          queue.push([nx, ny]);
        }
      }
      const beyond = [...seen].some((k) => Number(k.split(',')[0]) > t.x + t.w);
      expect(beyond, `${id}: east of ${trig} reachable without crossing it`).toBe(false);
    }
    const st = new Sim().game.state;
    st.data.chapter = 14;
    st.set('c14_departed');
    st.set('c14_stageA');
    const east = resolveMap('top_arena_b')?.exits?.east;
    const isOpen = () => st.check(east?.showIf) && !(east?.hideIf && st.check(east.hideIf));
    expect(isOpen()).toBe(false);
    st.set('c14_stageB');
    expect(isOpen()).toBe(true);
    st.set('act5_busy');
    expect(isOpen()).toBe(false);
  });

  it('the dojo, camp and forest events re-arm after being left mid-fight (no one-shot triggers)', async () => {
    // ---- Tien's dojo
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    st.addQuest('c13_tien');
    sim.start('c13_tien_dojo', 18, 23);
    await settle(sim);
    put(sim, 18, 20, 'up');
    await driveUntil(sim, 'dojo students fight', () => midFight(sim));
    expect(exitsAndSaves(sim).every((o) => o.gone)).toBe(true);
    expect(st.flag('trig:c13_dojoEvent')).toBe(false);
    reload(sim);
    await settle(sim);
    put(sim, 18, 23, 'up');
    await drive(sim, 5);
    put(sim, 18, 20, 'up');
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.data.journal.c13_tien).toBe('done');

    // ---- Poacher camp: the south exit is shut mid-fight; the event resumes after a reload.
    const sim2 = freshSim(13, 44);
    const st2 = sim2.game.state;
    st2.addQuest('c13_17');
    st2.set('c13_17met');
    sim2.start('c13_monster_camp', 21, 25);
    await settle(sim2);
    put(sim2, 20, 10, 'up');
    await driveUntil(sim2, 'poacher boss fight', () => midFight(sim2));
    put(sim2, 21, 26, 'down');
    await drive(sim2, 40, ['down']);
    expect(sim2.game.field?.def.id).toBe('c13_monster_camp');
    reload(sim2);
    await settle(sim2);
    put(sim2, 21, 20, 'up');
    await drive(sim2, 5);
    const log2 = record(sim2);
    put(sim2, 20, 10, 'up');
    await settle(sim2);
    expect(sim2.errors).toEqual([]);
    expect(st2.data.journal.c13_17).toBe('done');
    expect(st2.flag('c13_animalsLoose')).toBe(true);
    // The boss breaks off at 25% and runs for his ship before 17 shoots it down.
    expect(ENEMIES.c13_poacherBoss.boss?.endAt).toBeGreaterThan(0);
    expect(log2.some((l) => /I'm out of here/.test(l.text))).toBe(true);

    // Camp interrupted after the poachers but before 17's spar: crossing the trigger again goes straight to the spar.
    const sim3 = freshSim(13, 44);
    const st3 = sim3.game.state;
    st3.addQuest('c13_17');
    for (const f of ['c13_17met', 'c13_bossDone', 'c13_poachersGone', 'c13_animalsLoose']) st3.set(f);
    sim3.start('c13_monster_camp', 21, 25);
    await settle(sim3);
    const log3 = record(sim3);
    put(sim3, 20, 10, 'up');
    await settle(sim3);
    expect(st3.data.journal.c13_17).toBe('done');
    expect(log3.some((l) => /Snare them both/.test(l.text))).toBe(false);

    // ---- Forest of Terror: the pier is shut mid-fight; the clearing re-arms after a reload.
    const sim4 = freshSim(12, 41);
    const st4 = sim4.game.state;
    st4.addQuest('c12_krillin');
    sim4.start('c12_forest', 20, 30);
    await settle(sim4);
    put(sim4, 20, 5, 'up');
    await driveUntil(sim4, 'illusion fight', () => midFight(sim4));
    put(sim4, 20, 34, 'down');
    await drive(sim4, 30, ['down']);
    expect(sim4.game.field?.def.id).toBe('c12_forest');
    put(sim4, 20, 28, 'up');
    reload(sim4);
    await settle(sim4);
    put(sim4, 20, 12, 'up');
    await drive(sim4, 5);
    put(sim4, 20, 5, 'up');
    await settle(sim4);
    expect(sim4.errors).toEqual([]);
    expect(st4.flag('c12_herbGot')).toBe(true);
    expect(st4.count('c12_herb')).toBe(1);
  });

  it('the rooftop stairs and the film-lot gate stay shut during their fights, and controls come back after', async () => {
    // ---- Hit's rooftop
    const sim = freshSim(12, 41);
    const st = sim.game.state;
    st.addQuest('c12_hit');
    st.set('c12_hitHinted');
    st.join('vegeta', 41);
    st.data.active = 'vegeta';
    sim.start('satan_plaza', 31, 6);
    await settle(sim);
    const porter = sim.game.field?.npcs.find((n) => n.def.id === 'c12_porter');
    void sim.game.runScript('c12_porter_talk', { npc: porter });
    await driveUntil(sim, 'Hit fight', () => sim.game.field?.def.id === 'c12_rooftop' && midFight(sim));
    expect(st.data.active).toBe('goku');
    put(sim, 9, 19, 'down');
    await drive(sim, 30);
    expect(sim.game.field?.def.id).toBe('c12_rooftop');
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.data.journal.c12_hit).toBe('done');
    expect(st.data.active).toBe('vegeta');
    expect(sim.game.lockDepth).toBe(0);
    expect(sim.game.field?.locked).toBe(false);
    put(sim, 9, 17, 'down');
    await drive(sim, 5);
    put(sim, 9, 19, 'down');
    await drive(sim, 40);
    expect(sim.game.field?.def.id).toBe('satan_plaza');

    // ---- The Saiyaman film lot
    const sim2 = freshSim(12, 41);
    const st2 = sim2.game.state;
    sim2.start('satan_plaza', 9, 14);
    await settle(sim2);
    const dir = sim2.game.field?.npcs.find((n) => n.def.id === 'c12_directorP');
    void sim2.game.runScript('c12_director_plaza', { npc: dir });
    await driveUntil(sim2, 'stuntman fight', () => sim2.game.field?.def.id === 'c12_film_set' && midFight(sim2));
    put(sim2, 20, 24, 'down');
    await drive(sim2, 30, ['down']);
    expect(sim2.game.field?.def.id).toBe('c12_film_set');
    await settle(sim2);
    expect(sim2.errors).toEqual([]);
    expect(st2.data.journal.c12_saiyaman).toBe('done');
    expect(st2.flag('noSwitch')).toBe(false);
    expect(sim2.game.field?.locked).toBe(false);
    put(sim2, 20, 22, 'down');
    await drive(sim2, 5);
    put(sim2, 20, 24, 'down');
    await drive(sim2, 40, ['down']);
    expect(sim2.game.field?.def.id).toBe('satan_plaza');
  });

  it('post-game training trips to the stage have a way back to the palace', async () => {
    const sim = freshSim(15, 48);
    const st = sim.game.state;
    for (const f of ['post_game', 'c14_departed', 'c14_opened', 'c14_stageA', 'c14_stageB', 'c14_stageC', 'c14_won']) st.set(f);
    await beat(sim, 'zeno_palace', 'c14_gp_talk', 22, 8);
    expect(sim.game.field?.def.id).toBe('top_arena_a');
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'act5_gpStage')).toBe(true);
    await beat(sim, null, 'act5_gp_stage_talk');
    expect(sim.game.field?.def.id).toBe('zeno_palace');
  });
});

describe('act 5 continuity', () => {
  it('Krillin\'s comeback follows Krillin: Roshi takes the herb, and the episode is re-voiced after he joins the team', async () => {
    // Chapter 13, Krillin out on patrol, herb in hand: Master Roshi takes it on the beach, alone.
    const sim = freshSim(13, 43);
    const st = sim.game.state;
    st.addQuest('c12_krillin');
    st.addQuest('c13_krillin');
    st.set('c12_herbGot');
    st.give('c12_herb', 1, 1);
    const log = record(sim);
    sim.start('kame_island', 20, 22);
    await settle(sim);
    expect(sim.errors).toEqual([]);
    expect(st.data.journal.c12_krillin).toBe('done');
    expect(st.count('c12_herb')).toBe(0);
    expect(log.some((l) => /Krillin phoned from his patrol/.test(l.text))).toBe(true);
    expect(sim.game.field?.npcs.some((n) => /krillin/i.test(n.def.id))).toBe(false);

    // Recruited without playing the episode: the old "purse snatcher" Krillin is gone; a Mighty Ten Krillin offers it.
    const sim2 = freshSim(13, 44);
    const st2 = sim2.game.state;
    st2.addQuest('c12_krillin');
    st2.addQuest('c13_krillin');
    st2.completeQuest('c13_krillin');
    sim2.start('kame_island', 20, 22);
    await settle(sim2);
    const ids = sim2.game.field?.npcs.map((n) => n.def.id) ?? [];
    expect(ids).toContain('act5_krillinK2');
    expect(ids).not.toContain('c12_krillinK');
    const log2 = record(sim2);
    await beat(sim2, null, 'c12_krillin_kame');
    expect(log2.some((l) => /purse snatcher/.test(l.text))).toBe(false);
    expect(log2.some((l) => /signed up to fight for the whole universe/.test(l.text))).toBe(true);
    expect(sim2.game.field?.def.id).toBe('c12_forest');
    expect(sim2.game.field?.npcs.map((n) => n.def.id)).toContain('c12_krillinF2');

    // Post-game: Krillin is home; an unplayed episode is offered as a veteran's nightmare.
    const sim3 = freshSim(15, 48);
    const st3 = sim3.game.state;
    st3.set('post_game');
    st3.set('c14_won');
    st3.addQuest('c12_krillin');
    st3.addQuest('c13_krillin');
    st3.completeQuest('c13_krillin');
    sim3.start('kame_island', 20, 22);
    await settle(sim3);
    expect(sim3.game.field?.npcs.filter((n) => /krillin/i.test(n.def.id)).map((n) => n.def.id)).toEqual(['post_krillinK']);
    const log3 = record(sim3);
    await beat(sim3, null, 'post_krillin_talk');
    expect(log3.some((l) => /falling off that stage/.test(l.text))).toBe(true);
    expect(sim3.game.field?.def.id).toBe('c12_forest');
  });

  it('17, Goten and the Monster Island babysitters react to the tournament and the post-game', async () => {
    const sim = freshSim(15, 48);
    const st = sim.game.state;
    for (const f of ['post_game', 'c14_won', 'c14_departed', 'c13_17met', 'c13_bossDone', 'c13_17Joined', 'c13_animalsLoose', 'c13_ani_c13_ani1', 'c13_ani_c13_ani2', 'c13_ani_c13_ani3']) st.set(f);
    st.addQuest('c13_17');
    st.completeQuest('c13_17');
    sim.start('c13_monster_beach', 16, 16);
    await settle(sim);
    const beach = sim.game.field?.npcs.map((n) => n.def.id) ?? [];
    for (const id of ['c13_goten', 'c13_trunksK', 'c13_marron']) expect(beach, id).not.toContain(id);
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    expect(sim.game.field?.npcs.map((n) => n.def.id)).toContain('act5_goten');
    const log = record(sim);
    await beat(sim, null, 'act5_goten_talk');
    expect(log.some((l) => /Uncle 17/.test(l.text))).toBe(true);
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(log.some((l) => /boat|cruise ship/.test(l.text))).toBe(true);
    expect(log.some((l) => /3 of 7 animals/.test(l.text))).toBe(true);

    // Tournament day (before departure): 17 talks about the tournament, not only the animals.
    const sim2 = freshSim(14, 45);
    const st2 = sim2.game.state;
    for (const f of ['c13_17met', 'c13_bossDone', 'c13_17Joined', 'c13_animalsLoose']) st2.set(f);
    const log2 = record(sim2);
    await beat(sim2, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(log2.some((l) => /Tournament day/.test(l.text))).toBe(true);
    // While the tournament runs, 17 is not at his station.
    st2.set('c14_departed');
    sim2.start('c13_monster_hut', 16, 12);
    await settle(sim2);
    expect(sim2.game.field?.npcs.some((n) => n.def.id === 'c13_17')).toBe(false);
  });

  it('hub chatter and the assassin hint address the active hero, not always Goku', async () => {
    const lines = async (prep: (sim: Sim) => void, map: string, script: string, x?: number, y?: number): Promise<string[]> => {
      const sim = freshSim(12, 42);
      prep(sim);
      const log = record(sim);
      await beat(sim, map, script, x, y);
      return log.map((l) => l.text);
    };
    const asGohan = (chapter: number, flags: string[] = []) => (sim: Sim): void => {
      const st = sim.game.state;
      st.data.chapter = chapter;
      st.join('gohan', 42);
      st.data.active = 'gohan';
      for (const f of flags) st.set(f);
    };
    const team = (sim: Sim): void => { asGohan(13)(sim); sim.game.state.addQuest('c13_team'); sim.game.state.completeQuest('c13_team'); };
    const chichi = await lines(team, 'paozu_home', 'act5_chichi_talk', 31, 10);
    expect(chichi.join(' ')).toMatch(/When he gets home/);
    expect(chichi.join(' ')).not.toMatch(/Goku, you are sleeping/);
    const goten = await lines(asGohan(13), 'paozu_home', 'act5_goten_talk', 31, 10);
    expect(goten[0]).toMatch(/^Big brother, can Trunks and I fight/);
    const bulma = await lines(asGohan(13), 'cc_yard', 'act5_bulma_talk', 22, 20);
    expect(bulma.join(' ')).toMatch(/Go find the rest, Gohan!/);
    const hint = await lines((sim) => { asGohan(12)(sim); sim.game.state.addQuest('c12_hit'); }, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(hint.join(' ')).toMatch(/contract on Goku's life/);
    expect(hint.join(' ')).not.toMatch(/your life, Goku/);
    const vegetaAsGohan = await lines(asGohan(12), 'cc_yard', 'act5_vegeta_talk', 22, 20);
    expect(vegetaAsGohan.join(' ')).not.toMatch(/Kakarot/);
    // Goku still gets the original lines.
    const asGoku = await lines((sim) => { sim.game.state.addQuest('c12_hit'); }, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect(asGoku.join(' ')).toMatch(/contract on your life, Goku/);
  });

  it('Baba only mentions Frieza\'s restored life after the tournament', async () => {
    const say = async (prep: (sim: Sim) => void): Promise<string> => {
      const sim = freshSim(14, 45);
      prep(sim);
      const log = record(sim);
      await beat(sim, 'c13_baba_lake', 'c13_baba_talk', 15, 7);
      return log.map((l) => l.text).join(' ');
    };
    const before = await say((sim) => { sim.game.state.addQuest('c13_frieza'); sim.game.state.completeQuest('c13_frieza'); sim.game.state.set('c14_departed'); });
    expect(before).toMatch(/clock is ticking/);
    expect(before).not.toMatch(/pulled strings/);
    const after = await say((sim) => { sim.game.state.set('c14_won'); sim.game.state.set('post_game'); });
    expect(after).toMatch(/pulled strings/);
  });

  it('Mr. Satan joins at L40 only if Goku was L48+ when Universe 7 won (LoG2 rule), otherwise at L1', async () => {
    // LoG2: Goku L45+ when Cell fell, a 4.92M EXP push past the Cell Games' L40 gate. Chapter 14 starts at L45; the
    // matching mark costs about as much (not the 15.3M of five more levels on the steep end of the curve).
    expect(SATAN_RULE_GOKU_LEVEL).toBe(48);
    const log2 = EXP_TABLE[45] - EXP_TABLE[40];
    const here = EXP_TABLE[SATAN_RULE_GOKU_LEVEL] - EXP_TABLE[45];
    expect(here / log2).toBeGreaterThan(0.75);
    expect(here / log2).toBeLessThan(1.5);
    for (const [lv, expected] of [[48, 40], [50, 40], [47, 1]] as const) {
      const sim = freshSim(15, 50);
      const st = sim.game.state;
      st.set('post_game');
      st.set('c14_gokuLv', lv);
      st.addQuest('post_trophies');
      for (const t of ['trophyGoku', 'trophyVegeta', 'trophyGohan', 'trophyTrunks', 'trophyPiccolo']) st.give(t, 1, 1);
      sim.start('cc_yard', 22, 20);
      await settle(sim);
      expect(sim.errors).toEqual([]);
      expect(st.char('satan').level, `Goku L${lv} at the win`).toBe(expected);
    }
  });

  it('act 5 maps have character level gates guarding capsule caches', () => {
    const GATES: Array<[string, string, string, [number, number]]> = [
      ['c12_forest', 'c12_g_goku', 'c12_forestCache', [20, 30]],
      ['c13_monster_jungle', 'c13_g_gohan', 'c13_jungleCache', [16, 32]],
      ['c13_training_wilds', 'c13_g_piccolo', 'c13_wildCache', [18, 15]],
      ['c13_tien_dojo', 'c13_g_vegeta', 'c13_dojoCache', [18, 23]],
    ];
    for (const [map, gate, chest, [sx, sy]] of GATES) {
      const def = resolveMap(map);
      const g = def?.barriers?.find((b) => b.id === gate);
      expect(g?.character, `${map} ${gate}`).toBeTruthy();
      const c = def?.objects?.find((o) => o.type === 'chest' && o.id === chest);
      if (!c) throw new Error(`${map}: no chest ${chest}`);
      const reach = (broken: boolean): boolean => {
        const sim = new Sim();
        if (broken) sim.game.state.set(`gate:${map}:${gate}`);
        sim.start(map);
        const f = sim.game.field;
        if (!f) throw new Error(map);
        const open = (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
        const seen = new Set([`${sx},${sy}`]);
        const queue: Array<[number, number]> = [[sx, sy]];
        while (queue.length) {
          const [x, y] = queue.shift() as [number, number];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (seen.has(`${nx},${ny}`) || nx < 0 || ny < 0 || nx >= f.map.cols || ny >= f.map.rows || !open(nx, ny)) continue;
            seen.add(`${nx},${ny}`);
            queue.push([nx, ny]);
          }
        }
        return [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has(`${c.x + dx},${c.y + dy}`));
      };
      expect(reach(false), `${map}: ${chest} behind ${gate} while closed`).toBe(false);
      expect(reach(true), `${map}: ${chest} reachable once ${gate} breaks`).toBe(true);
    }
  });
});

/** Step the game like `drive`, but without topping the hero's HP up (to see what a fight starts with). */
async function stepUntil(sim: Sim, cond: () => boolean, max = 20000): Promise<void> {
  let a = false;
  for (let i = 0; i < max && !cond(); i++) {
    const top = sim.game.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|Choice/.test(top)) { a = !a; sim.input.inject('A', a); } else sim.input.inject('A', false);
    sim.input.poll();
    sim.game.scenes.update(sim.input);
    await flush();
  }
}

describe('act 5 audit fixes', () => {
  it('boss fights never refill HP/EP first; a relay hand-off refreshes only the fighter stepping in', async () => {
    // Hit's rematch: Goku walks in hurt and stays hurt (LoG2: no refills before a boss; recovery pots on the roof).
    const sim = freshSim(15, 48);
    const st = sim.game.state;
    st.set('post_game');
    st.addQuest('c12_hit');
    st.completeQuest('c12_hit');
    st.addQuest('post_hit');
    sim.start('c12_rooftop', 8, 16);
    await settle(sim);
    const goku = st.char('goku');
    goku.hp = Math.floor(goku.hpMax / 2);
    goku.ep = Math.floor(goku.epMax / 3);
    const npc = sim.game.field?.npcs.find((n) => n.def.id === 'post_hitN');
    expect(npc).toBeTruthy();
    void sim.game.runScript('post_hit_talk', { npc });
    await stepUntil(sim, () => midFight(sim));
    expect(midFight(sim)).toBe(true);
    expect(goku.hp).toBeLessThanOrEqual(Math.floor(goku.hpMax / 2));
    expect(goku.ep).toBeLessThan(goku.epMax);
    // Every act 5 boss arena has breakable recovery pots or rocks instead (LoG2 §12).
    for (const id of ['c12_rooftop', 'c12_film_set', 'c12_forest', 'c13_expo', 'c13_tien_dojo', 'c13_monster_camp', 'c13_training_wilds', 'c13_baba_lake']) {
      expect(resolveMap(id)?.objects?.filter((o) => o.type === 'breakable' && !o.item).length, id).toBeGreaterThanOrEqual(2);
    }

    // A relay hand-off: the fresh fighter steps in at full strength; nobody else is touched.
    const sim2 = freshSim(14, 45);
    const st2 = sim2.game.state;
    st2.join('gohan', 45);
    st2.join('vegeta', 45);
    sim2.start('c13_monster_hut', 16, 12);
    await settle(sim2);
    for (const id of ['goku', 'gohan', 'vegeta'] as const) { st2.char(id).hp = 10; st2.char(id).ep = 1; }
    SCRIPTS.zz_act5_handoff = async (s) => { await handOff(s, 'gohan', { out: { id: 'zz_goku', name: 'Goku' } }); };
    expect(await sim2.run('zz_act5_handoff', {}, TICKS)).toBe(true);
    delete SCRIPTS.zz_act5_handoff;
    expect(sim2.errors).toEqual([]);
    expect(st2.data.active).toBe('gohan');
    expect(st2.char('gohan').hp).toBe(st2.char('gohan').hpMax);
    expect(st2.char('gohan').ep).toBe(st2.char('gohan').epMax);
    expect(st2.char('goku').hp).toBe(10);
    expect(st2.char('vegeta').hp).toBe(10);
  });

  it('the Forest of Terror can be revisited after Krillin\'s comeback, so its Goku L42 cache is never lost', async () => {
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    for (const f of ['c12_herbGot', 'c12_calm']) st.set(f);
    st.addQuest('c12_krillin');
    st.completeQuest('c12_krillin');
    sim.start('kame_island', 20, 22);
    await settle(sim);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'act5_krillinK1')).toBe(true);
    await beat(sim, null, 'c12_krillin_kame');
    expect(sim.game.field?.def.id).toBe('c12_forest');
    expect(sim.game.field?.map.objects.some((o) => o.def.type === 'chest' && o.def.id === 'c12_forestCache' && !o.gone)).toBe(true);
    expect(sim.game.field?.map.gates.some((g) => g.def.id === 'c12_g_goku' && g.def.level === 42 && !g.broken)).toBe(true);
    await beat(sim, null, 'c12_forest_leave');
    expect(sim.game.field?.def.id).toBe('kame_island');
    expect(st.data.journal.c12_krillin).toBe('done');

    // Post-game Krillin offers the same boat trip.
    const sim2 = freshSim(15, 48);
    const st2 = sim2.game.state;
    for (const f of ['post_game', 'c14_won', 'c12_herbGot', 'c12_calm']) st2.set(f);
    st2.addQuest('c12_krillin');
    st2.completeQuest('c12_krillin');
    sim2.start('kame_island', 20, 22);
    await settle(sim2);
    await beat(sim2, null, 'post_krillin_talk');
    expect(sim2.game.field?.def.id).toBe('c12_forest');
  });

  it('act 5 journal titles fit the journal row whole', () => {
    const mine = Object.values(QUESTS).filter((q) => /^(c1[234]_|post_)/.test(q.id));
    expect(mine.length).toBeGreaterThan(15);
    for (const q of mine) {
      // pause.ts cuts titles over 44 characters; the row has 212 px from x=22.
      expect(q.title.length, q.id).toBeLessThanOrEqual(44);
      expect(measure(q.title), q.id).toBeLessThanOrEqual(212);
    }
  });

  it('act 5 locations use one name each (region = world map spot name)', () => {
    for (const id of ['c13_tien_dojo', 'c13_training_wilds', 'c13_baba_lake', 'c13_monster_beach']) {
      const spot = Object.values(SPOTS).find((sp) => sp.map === id);
      expect(spot, id).toBeTruthy();
      expect(resolveMap(id)?.region, id).toBe(spot?.name);
    }
  });

  it('the poacher camp and the film lot have no screen-sized stretches of bare ground', () => {
    // No 6x6-tile window (most of a 15x10-tile screen's open middle) is plain walkable ground of one terrain with
    // nothing on it: no prop or decal, object or NPC.
    const N = 6;
    for (const id of ['c13_monster_camp', 'c12_film_set']) {
      const sim = new Sim();
      sim.game.state.data.chapter = 13;
      sim.start(id);
      const f = sim.game.field;
      const def = resolveMap(id);
      if (!f || !def) throw new Error(id);
      const terrain = parseGrid(def);
      const busy = new Set<string>();
      for (const p of f.map.props) {
        for (let y = Math.floor(p.y / 16); y <= Math.floor((p.y + p.art.bmp.height - 1) / 16); y++) {
          for (let x = Math.floor(p.x / 16); x <= Math.floor((p.x + p.art.bmp.width - 1) / 16); x++) busy.add(`${x},${y}`);
        }
      }
      for (const o of def.objects ?? []) busy.add(`${o.x},${o.y}`);
      for (const n of def.npcs ?? []) busy.add(`${n.x},${n.y}`);
      const bare = (x: number, y: number) => !busy.has(`${x},${y}`) && !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
      const empty: string[] = [];
      for (let y = 0; y + N <= terrain.length; y++) {
        for (let x = 0; x + N <= terrain[0].length; x++) {
          let all = true;
          for (let dy = 0; dy < N && all; dy++) for (let dx = 0; dx < N && all; dx++) all = bare(x + dx, y + dy) && terrain[y + dy][x + dx] === terrain[y][x];
          if (all) empty.push(`${x},${y}`);
        }
      }
      expect(empty, `${id}: bare ${N}x${N} stretches`).toEqual([]);
    }
  });
});

// ------------------------------------------------------------------------------------------------ Chapter 13 interludes

/** BFS over open tiles of the current field from a seed; returns the set of reached "x,y" keys. */
function reachable(sim: Sim, sx: number, sy: number): Set<string> {
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  const open = (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = next[0] + dx;
      const ny = next[1] + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= f.map.cols || ny >= f.map.rows || !open(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** True when a tile or one of its four neighbours was reached (NPCs and props block their own tile). */
function near(seen: Set<string>, x: number, y: number): boolean {
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
}

/** A Chapter 13 save with every recruit in and the tenth warrior still to find. */
function friezaReady(level = 44): Sim {
  const sim = freshSim(13, level);
  const st = sim.game.state;
  for (const id of ['vegeta', 'gohan', 'piccolo', 'trunks'] as const) st.join(id, level - 2);
  st.char('vegeta').form = 'ssb';
  st.char('gohan').form = 'ultimate';
  st.set('c13_expoSeen');
  st.addQuest('c13_team');
  for (const q of ['c13_krillin', 'c13_tien', 'c13_gohan', 'c13_17', 'c13_leader']) { st.addQuest(q); st.completeQuest(q); }
  st.set('c13_friezaIntro');
  st.addQuest('c13_frieza');
  return sim;
}

describe('Chapter 13 interludes: Goku vs. Gohan, Universe 6, the gated animals', () => {
  it('Goku vs. Gohan (ep 90) plays as Goku the moment Tien and Gohan are both in, and Gohan leads the team', async () => {
    // Tien first, then Gohan's training (played from Piccolo's side): the spar follows on the plateau.
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    st.join('gohan', 42);
    st.join('piccolo', 42);
    st.addQuest('c13_tien');
    st.completeQuest('c13_tien');
    st.addQuest('c13_gohan');
    st.data.active = 'piccolo';
    const log = record(sim);
    await beat(sim, 'lookout', 'c13_gohanL_talk', 26, 23);
    expect(st.data.journal.c13_gohan).toBe('done');
    expect(st.data.journal.c13_leader).toBe('done');
    expect(QUESTS.c13_leader.star).toBe('silver');
    expect(sim.game.field?.def.id).toBe('c13_training_wilds');
    // Played as Goku, then handed back to the hero who started it, free to switch again.
    const leader = log.find((l) => /Gohan is the leader of Team Universe 7/.test(l.text));
    expect(leader?.hero).toBe('goku');
    expect(log.findIndex((l) => /Two on two/.test(l.text))).toBeGreaterThan(log.findIndex((l) => /The Gohan I remember/.test(l.text)));
    expect(log.findIndex((l) => /Senzu Bean/.test(l.text))).toBeGreaterThan(log.findIndex((l) => /Two on two/.test(l.text)));
    expect(st.data.active).toBe('piccolo');
    expect(st.flag('noSwitch')).toBe(false);
    expect(st.flag('act5_busy')).toBe(false);
    for (const id of ['c13_gohanR', 'c13_gohanR2', 'c13_piccoloR', 'c13_tienR']) expect(sim.game.field?.npcs.some((n) => n.def.id === id), id).toBe(false);
    expect(log.some((l) => /wants him to lead the team/.test(l.text))).toBe(true);

    // Gohan first, then Tien: the dojo hands over to the plateau.
    const sim2 = freshSim(13, 44);
    const st2 = sim2.game.state;
    st2.join('gohan', 42);
    st2.join('piccolo', 42);
    st2.addQuest('c13_gohan');
    st2.completeQuest('c13_gohan');
    st2.addQuest('c13_tien');
    await beat(sim2, 'c13_tien_dojo', 'c13_dojo_event', 18, 20);
    expect(st2.data.journal.c13_tien).toBe('done');
    expect(st2.data.journal.c13_leader).toBe('done');
    expect(sim2.game.field?.def.id).toBe('c13_training_wilds');
    expect(st2.data.active).toBe('goku');

    // Only one of the two in: no spar yet.
    const sim3 = freshSim(13, 44);
    const st3 = sim3.game.state;
    st3.addQuest('c13_tien');
    await beat(sim3, 'c13_tien_dojo', 'c13_dojo_event', 18, 20);
    expect(st3.data.journal.c13_tien).toBe('done');
    expect(st3.data.journal.c13_leader).toBeUndefined();
    expect(sim3.game.field?.def.id).toBe('c13_tien_dojo');
  });

  it('Universe 6 (eps 88-93) cuts in between Goku\'s Frieza plan and Hell: Cabba recruits Caulifla and Kale', async () => {
    const sim = friezaReady();
    const st = sim.game.state;
    const veg = st.char('vegeta');
    const before = { str: veg.str, pow: veg.pow, end: veg.end };
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);

    // Gold story beat, recorded in the Journal; the chapter still hands over to the tournament.
    expect(QUESTS.c13_u6.star).toBe('gold');
    expect(st.data.journal.c13_u6).toBe('done');
    expect(st.flag('c13_u6Done')).toBe(true);
    expect(st.flag('c13_u6KaleCalmed')).toBe(true);
    expect(st.data.journal.c13_frieza).toBe('done');
    expect(st.data.chapter).toBe(14);
    // Canon order: the plan, Universe 6 (Renso, the gang, the hideout, Caulifla's Super Saiyan, the spar, Kale), Hell.
    const order = [/Frieza!$/, /Meanwhile, in Universe 6/, /Seventy rival fighters/, /her potential is bigger/, /Fresh meat/, /your hair just turned GOLD/,
      /Like\.\.\. THIS/, /We'll call this one a draw/, /TAKE YOU AWAY/, /Super Saiyan\.\.\. TWO/, /Cabbage, Cauliflower and Kale/,
      /presents himself at King Yemma/, /Come to gloat/];
    const idx = order.map((re) => said(re));
    for (const [i, re] of order.entries()) expect(idx[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(idx[i - 1]);
    // The episode visits three places, all played as Cabba (Vegeta's stand-in); Goku never meets the U6 Saiyans
    // before the tournament.
    const u6 = log.slice(0, idx[idx.length - 2]).filter((l) => /^c13_(champa_terrace|sadala_quarter|sadala_crags)$/.test(l.map));
    expect(new Set(u6.map((l) => l.map))).toEqual(new Set(['c13_champa_terrace', 'c13_sadala_quarter', 'c13_sadala_crags']));
    expect(u6.every((l) => l.hero === 'vegeta')).toBe(true);
    expect(log.some((l) => /^c13_sadala/.test(l.map) && l.hero === 'goku')).toBe(false);
    // Vegeta gets his own look, form and stats back (the EXP Cabba earned stays, so stats can only have grown).
    expect(veg.outfit).toBeUndefined();
    expect(veg.form).toBe('ssb');
    expect(veg.level).toBeGreaterThanOrEqual(42);
    for (const k of ['str', 'pow', 'end'] as const) expect(veg[k] - before[k], k).toBeGreaterThanOrEqual(0);
    for (const f of ['c13_u6Stash', 'c13_u6Boost', 'c13_u6Rampage', 'act5_busy']) expect(st.flag(f), f).toBe(false);
    expect(sim.errors).toEqual([]);

    // The episode on its own: Cabba steps in fresh, and Vegeta's HP and EP are what they were; Goku is forced for Hell.
    const sim2 = friezaReady();
    const st2 = sim2.game.state;
    const v2 = st2.char('vegeta');
    v2.hp = Math.round(v2.hpMax * 0.6);
    v2.ep = Math.round(v2.epMax * 0.5);
    const [hp, ep, str] = [v2.hp, v2.ep, v2.str];
    sim2.start('cc_yard', 25, 17);
    await settle(sim2);
    expect(await sim2.run('c13_u6_episode', {}, TICKS)).toBe(true);
    expect([v2.hp, v2.ep, v2.outfit, v2.form]).toEqual([hp, ep, undefined, 'ssb']);
    expect(v2.str).toBeGreaterThanOrEqual(str);
    expect(st2.data.active).toBe('goku');
    expect(st2.flag('noSwitch')).toBe(true);
    expect(sim2.errors).toEqual([]);
    // Asking again never replays it.
    const log2 = record(sim2);
    expect(await sim2.run('c13_u6_episode', {}, TICKS)).toBe(true);
    expect(log2.length).toBe(0);
  });

  it('berserk Kale cannot be hurt; reaching Caulifla and pressing A makes her step in', async () => {
    const { SADALA } = await import('../../src/content/chapters/act5/c13_maps');
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    st.join('vegeta', 42);
    st.data.active = 'vegeta';
    sim.start('c13_sadala_crags', 13, 14);
    await settle(sim);
    let done = false;
    void sim.game.runScript('c13_u6_kale').then(() => { done = true; });
    await driveUntil(sim, 'Kale rampage', () => st.flag('c13_u6Rampage') && midFight(sim));
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const kale = f.enemies.find((e) => e.uid === 'c13_kale1');
    expect(kale).toBeTruthy();
    if (!kale) return;
    const hp = kale.hp;
    expect(f.applyDamage(kale, 99, 400, { x: 0, y: 0 }, 0, false)).toBe(0);
    expect(kale.hp).toBe(hp);
    // Caulifla stands at the east rim inside the A-trigger; a press beside her ends the rampage before the timer.
    const caul = f.npcs.find((n) => n.def.id === 'c13_cauliflaC2');
    expect(caul).toBeTruthy();
    const [cx, cy] = SADALA.crags.caulifla;
    expect([Math.floor((caul?.x ?? 0) / 16), Math.floor(((caul?.y ?? 0) - 14) / 16)]).toEqual([cx, cy]);
    put(sim, cx - 1, cy, 'right');
    expect(f.timer && f.timer.frames > 0).toBe(true);
    expect(f.tryInteract()).toBe(true);
    expect(st.flag('c13_u6Shouted')).toBe(true);
    for (let i = 0; i < 40000 && !done; i += 5) await drive(sim, 5);
    expect(done).toBe(true);
    expect(st.flag('c13_u6KaleCalmed')).toBe(true);
    expect(st.flag('act5_busy')).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('seven escaped animals in all; three fled into old regions, behind gates only one fighter can break', async () => {
    const { ANIMALS } = await import('../../src/content/chapters/act5/c13');
    const { MAPS } = await import('../../src/content/registry');
    const found = new Map<string, string>();
    for (const id of Object.keys(MAPS)) {
      for (const n of resolveMap(id)?.npcs ?? []) {
        if (n.talk !== 'c13_animal_talk') continue;
        expect(found.has(n.id), `${n.id} placed twice`).toBe(false);
        found.set(n.id, id);
      }
    }
    expect([...found.keys()].sort()).toEqual(Object.keys(ANIMALS).sort());
    // Four stay on Chapter 13's own maps and Mt. Paozu; three sit behind old hubs' coloured gates.
    const GATED: Array<[string, string, string, string, number, [number, number]]> = [
      ['c13_ani5', 'waste_canyon', 'eb_g25_vegeta', 'vegeta', 25, [3, 13]],
      ['c13_ani2', 'snow_peak', 'g40_goku', 'goku', 40, [18, 30]],
      ['c13_ani4', 'paozu_peaks', 'g15', 'goku', 15, [20, 30]],
    ];
    for (const [ani, map, gate, who, level, [sx, sy]] of GATED) {
      expect(found.get(ani), ani).toBe(map);
      const def = resolveMap(map);
      const npc = def?.npcs?.find((n) => n.id === ani);
      const bar = def?.barriers?.find((b) => b.id === gate);
      expect(npc && bar, `${ani} / ${gate}`).toBeTruthy();
      if (!npc || !bar) continue;
      expect([bar.character, bar.level]).toEqual([who, level]);
      expect(npc.showIf).toBe('c13_animalsLoose');
      const sim = freshSim(13, 44);
      sim.game.state.set('c13_animalsLoose');
      sim.start(map, sx, sy);
      await settle(sim);
      const f = sim.game.field;
      if (!f) throw new Error(map);
      expect(f.npcs.some((n) => n.def.id === ani && !n.hidden), `${ani} visible`).toBe(true);
      expect(near(reachable(sim, sx, sy), npc.x, npc.y), `${ani} sealed behind ${gate}`).toBe(false);
      const g = f.map.gates.find((x) => x.def.id === gate);
      if (g) f.map.openGate(g);
      expect(near(reachable(sim, sx, sy), npc.x, npc.y), `${ani} reachable once ${gate} is broken`).toBe(true);
    }
    // 17 points at the region and the barrier's colour.
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    for (const f of ['c13_17met', 'c13_bossDone', 'c13_17Joined', 'c13_animalsLoose', 'c13_ani_c13_ani1']) st.set(f);
    const log = record(sim);
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    expect(log.some((l) => /Baby Dino: in a warm valley full of dinosaurs on Highland Peak/.test(l.text))).toBe(true);
  });

  it('post-game: Cabba visits Capsule Corp, Sadala opens on the space map, and Caulifla and Kale get their rematch', async () => {
    const sim = freshSim(15, 50);
    const st = sim.game.state;
    st.set('post_game');
    st.join('vegeta', 49);
    // Before the tournament nobody from Universe 6 is on Sadala's streets or at Capsule Corp.
    for (const id of ['c13_sadala_quarter', 'c13_sadala_crags']) {
      for (const n of resolveMap(id)?.npcs ?? []) expect(n.showIf, `${id} ${n.id}`).toBe('post_game');
      for (const e of resolveMap(id)?.enemies ?? []) expect(e.showIf, `${id} ${e.type}`).toBe('post_game');
      for (const ex of Object.values(resolveMap(id)?.exits ?? {})) expect(ex?.showIf).toBe('post_game&!act5_busy');
    }
    expect(resolveMap('cc_yard')?.npcs?.find((n) => n.id === 'c13_cabbaCC')?.showIf).toBe('post_game');

    await beat(sim, 'cc_yard', 'c13_cabba_cc', 29, 18);
    expect(st.data.regions).toContain('c13_spot_sadala');
    expect(st.data.journal.c13_sadala).toBe('active');
    expect(QUESTS.c13_sadala.star).toBe('bronze');
    expect(SPOTS.c13_spot_sadala.world).toBe('space');
    expect(resolveMap(SPOTS.c13_spot_sadala.map)?.region).toBe(SPOTS.c13_spot_sadala.name);

    const spot = SPOTS.c13_spot_sadala;
    sim.start(spot.map, spot.tx, spot.ty);
    await settle(sim);
    for (const id of ['c13_caulifla', 'c13_kale', 'c13_renso', 'c13_guard']) expect(sim.game.field?.npcs.some((n) => n.def.id === id && !n.hidden), id).toBe(true);
    const pow = st.count('pow3');
    await beat(sim, null, 'c13_sadala_caulifla');
    expect(st.data.journal.c13_sadala).toBe('done');
    expect(st.count('pow3')).toBe(pow + 1);
    expect(sim.game.field?.enemies.filter((e) => !e.dead).length).toBe(0);
    for (const id of ['c13_caulifla', 'c13_kale']) expect(sim.game.field?.npcs.some((n) => n.def.id === id && !n.hidden), id).toBe(true);
    expect(st.flag('act5_busy')).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('new Chapter 13 sprites have scouter readings, and the new maps are open, connected and dressed', async () => {
    const { SCANS } = await import('../../src/content/scans');
    const { SADALA } = await import('../../src/content/chapters/act5/c13_maps');
    for (const id of ['c13_cauliflaSSJ', 'c13_kaleBerserk', 'c13_renso', 'c13_gangPunk', 'c13_gangBrute', 'c13_gangSlinger', 'c13_sadalan',
      'c13_sadalanF', 'c13_sadalaGuard', 'c13_sadalaPtero', 'c13_cragHound', 'caulifla', 'kale']) {
      expect(SCANS[id], id).toBeTruthy();
      expect(!!(CAST[id] || CREATURES[id]), `${id} sprite`).toBe(true);
    }
    const CASES: Array<[string, [number, number], Array<[number, number]>]> = [
      ['c13_champa_terrace', SADALA.terrace.arrive, [SADALA.terrace.champa, SADALA.terrace.vados]],
      ['c13_sadala_quarter', SADALA.quarter.arrive, [SADALA.quarter.renso, SADALA.quarter.gate, SADALA.quarter.throne, SADALA.quarter.kale,
        SADALA.quarter.henchman, ...SADALA.quarter.gang, [45, 15], [26, 30]]],
      ['c13_sadala_crags', SADALA.crags.arrive, [SADALA.crags.centre, SADALA.crags.caulifla, SADALA.crags.kaleHide, [0, 14]]],
    ];
    for (const [id, [sx, sy], goals] of CASES) {
      const sim = freshSim(15, 50);
      sim.game.state.set('post_game');
      sim.start(id, sx, sy);
      const f = sim.game.field;
      const def = resolveMap(id);
      if (!f || !def) throw new Error(id);
      const open = (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
      for (const n of def.npcs ?? []) {
        expect(open(n.x, n.y), `${id}: npc ${n.id}`).toBe(true);
        if (CAST[n.sprite]) expect(SCANS[n.sprite], `${id}: scan for ${n.sprite}`).toBeTruthy();
      }
      for (const e of def.enemies ?? []) expect(open(e.x, e.y), `${id}: enemy ${e.type}`).toBe(true);
      const seen = reachable(sim, sx, sy);
      for (const [gx, gy] of goals) {
        expect(open(gx, gy) || near(seen, gx, gy), `${id}: ${gx},${gy} open`).toBe(true);
        expect(near(seen, gx, gy), `${id}: ${gx},${gy} reachable`).toBe(true);
      }
    }
    // The set-piece trigger wraps Caulifla's tile.
    const t = resolveMap('c13_sadala_crags')?.triggers?.find((x) => x.id === 'c13_u6ShoutT');
    const [cx, cy] = SADALA.crags.caulifla;
    expect(t && cx >= t.x && cx < t.x + t.w && cy >= t.y && cy < t.y + t.h).toBe(true);
    // No screen-sized stretch of bare ground in Sadala (the camp / film lot rule).
    const N = 6;
    for (const id of ['c13_sadala_quarter', 'c13_sadala_crags']) {
      const sim = new Sim();
      sim.start(id);
      const f = sim.game.field;
      const def = resolveMap(id);
      if (!f || !def) throw new Error(id);
      const terrain = parseGrid(def);
      const busy = new Set<string>();
      for (const p of f.map.props) {
        for (let y = Math.floor(p.y / 16); y <= Math.floor((p.y + p.art.bmp.height - 1) / 16); y++) {
          for (let x = Math.floor(p.x / 16); x <= Math.floor((p.x + p.art.bmp.width - 1) / 16); x++) busy.add(`${x},${y}`);
        }
      }
      for (const o of def.objects ?? []) busy.add(`${o.x},${o.y}`);
      for (const n of def.npcs ?? []) busy.add(`${n.x},${n.y}`);
      const bare = (x: number, y: number) => !busy.has(`${x},${y}`) && !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
      const empty: string[] = [];
      for (let y = 0; y + N <= terrain.length; y++) {
        for (let x = 0; x + N <= terrain[0].length; x++) {
          let all = true;
          for (let dy = 0; dy < N && all; dy++) for (let dx = 0; dx < N && all; dx++) all = bare(x + dx, y + dy) && terrain[y + dy][x + dx] === terrain[y][x];
          if (all) empty.push(`${x},${y}`);
        }
      }
      expect(empty, `${id}: bare ${N}x${N} stretches`).toEqual([]);
    }
  });
});

// ============================================================================================ Chapter 14 set pieces

/** An enemy by uid on the current field. */
type C14Foe = import('../../src/game/enemy').Enemy;

/** Chapter 14 mid-tournament state for running one set piece on its own: the party at the band, guests ready. */
function c14Sim(active: 'goku' | 'gohan' | 'piccolo' | 'android17'): Sim {
  const sim = freshSim(14, 45);
  const st = sim.game.state;
  for (const id of ['vegeta', 'gohan', 'piccolo'] as const) st.join(id, 45);
  st.join('android17', 46);
  st.join('frieza', 47);
  // Departed but no relay on the way (so the west ring's onEnter does not restart stage A), rivals cleared.
  st.set('c14_departed');
  st.set('fc_topQuiet');
  st.addQuest('c14_top');
  st.data.active = active;
  return sim;
}

/** Start a set piece the way its relay does, then read dialogue (never attacking) until its fight is on. */
async function c14IntoFight(sim: Sim, map: string, script: string): Promise<() => boolean> {
  sim.start(map, 22, 16);
  await settle(sim);
  let finished = false;
  void sim.game.runScript(script).then(() => { finished = true; });
  await driveUntil(sim, `${script} fight`, () => midFight(sim));
  return () => finished;
}

function c14Foe(sim: Sim, uid: string): C14Foe {
  const e = sim.game.field?.enemies.find((x) => x.uid === uid);
  if (!e) throw new Error(`no enemy ${uid} on ${sim.game.field?.def.id}`);
  return e;
}

/** A blow big enough to bring an enemy to its scripted end (or knock it out). */
function c14Finish(sim: Sim, e: C14Foe): void {
  sim.game.field?.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
}

/** Set-piece cutscene actors (and living enemies) still standing on the field. */
function c14Leftovers(sim: Sim): string[] {
  const f = sim.game.field;
  if (!f) return [];
  return [
    ...f.npcs.filter((n) => /^c14_/.test(n.def.id)).map((n) => n.def.id),
    ...f.enemies.filter((e) => !e.dead && e.state !== 'dying').map((e) => e.uid ?? e.def.id),
  ];
}

describe('Chapter 14 set pieces (eps 101-119)', () => {
  it('the relays play every set piece in anime order, each with its own fighter, and clean up after themselves', async () => {
    const sim = freshSim(13, 45);
    const st = sim.game.state;
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    await beat(sim, null, 'c14_start');
    await beat(sim, null, 'act5_beerus_talk');
    // Stage A (eps 98-111) ran inline from the departure.
    for (const f of ['c14_stageA', 'c14_prideDone', 'c14_fireballsDone', 'c14_dyspoTagDone', 'c14_hitOut']) expect(st.flag(f), f).toBe(true);
    expect(st.data.journal.c14_top).toBe('active');
    const chronoA = [/He stopped her\.\.\. with one shot/, /Justice is efficient today/, /Universe 11 has lost five Pride Troopers/,
      /Kakunsa has been eliminated/, /erases Universe 10/, /A team-up with Hit/, /K'nsi has been eliminated/, /Master Roshi frees Vegeta/,
      /Frost has been eliminated by Frieza/, /^Ultra Instinct -Sign-\./, /Hit traps Jiren in a Time Prison/, /Hit has been eliminated/];
    const idxA = chronoA.map(said);
    for (const [i, re] of chronoA.entries()) expect(idxA[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idxA.length; i++) expect(idxA[i], `${chronoA[i]} after ${chronoA[i - 1]}`).toBeGreaterThan(idxA[i - 1]);
    // Each set piece is played by the fighter canon gives it.
    expect(log[said(/^Sweetheart\. Right\./)]?.hero).toBe('android17');
    expect(log[said(/A team-up with Hit/)]?.hero).toBe('goku');
    expect(log[said(/^Back off, red suits!/)]?.hero).toBe('goku');
    expect(log[said(/Rest, Goku\. This one is my job/)]?.npcs).toContain('c14_hitJ');
    expect(c14Leftovers(sim)).toEqual([]);
    expect(st.flag('act5_busy') || st.flag('noSwitch')).toBe(false);
    expect(sim.game.field?.player.formActive).toBeNull();

    // Stage B (eps 113-121).
    sim.start('top_arena_b', 3, 15);
    await settle(sim);
    await beat(sim, null, 'c14_stageB');
    for (const f of ['c14_stageB', 'c14_ribrianneDone', 'c14_namekDone', 'c14_gamisalasDone']) expect(st.flag(f), f).toBe(true);
    expect(st.data.journal.c14_top).toBe('active');
    const chronoB = [/Told you we'd be back/, /Kefla is knocked out/, /Don't lecture me about love/, /Android 18 kicks Ribrianne out/,
      /blast Rozie off the stage/, /Our universe needs you gone/, /Saonel and Pirina are blasted off/, /Universe 6 and Universe 2/,
      /You breathe far too loudly/, /Gamisalas has been eliminated/, /eliminated by Damom/, /Universe 4 is erased/, /Universe 3 is erased/];
    const idxB = chronoB.map(said);
    for (const [i, re] of chronoB.entries()) expect(idxB[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idxB.length; i++) expect(idxB[i], `${chronoB[i]} after ${chronoB[i - 1]}`).toBeGreaterThan(idxB[i - 1]);
    expect(log[said(/Don't lecture me about love/)]?.hero).toBe('android17');
    expect(log[said(/Neither can we\. Piccolo, together!/)]?.hero).toBe('gohan');
    expect(log[said(/You breathe far too loudly/)]?.hero).toBe('piccolo');
    expect(c14Leftovers(sim)).toEqual([]);
    expect(st.data.active).toBe('goku');
    expect(sim.game.field?.player.hidden).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('Pride Troopers (ep 101): Kahseral cannot be hurt until his four troopers fall', async () => {
    const { SQUAD } = await import('../../src/content/chapters/act5/c14_enemies');
    const sim = c14Sim('goku');
    const st = sim.game.state;
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_pride');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const boss = c14Foe(sim, 'c14_kahseral1');
    expect(f.applyDamage(boss, 255, 400, { x: 0, y: 0 }, 0, false)).toBe(0);
    expect(boss.hp).toBe(boss.maxHp);
    for (const uid of SQUAD) c14Finish(sim, c14Foe(sim, uid));
    await driveUntil(sim, 'formation broken', () => st.flag('c14_squadDown'));
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    expect(f.applyDamage(boss, 40, 1, { x: 0, y: 0 }, 0, false)).toBeGreaterThan(0);
    c14Finish(sim, boss);
    await driveUntil(sim, 'Kale finishes it', done, 60000);
    expect(st.flag('c14_prideDone')).toBe(true);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Kamikaze Fireballs (ep 102): all three transform at the first phase change; the two in the back cannot be hit', async () => {
    const sim = c14Sim('goku');
    const st = sim.game.state;
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_fireballs');
    expect(st.data.active).toBe('android17');
    const kak = c14Foe(sim, 'c14_kakunsa1');
    const bri = c14Foe(sim, 'c14_brianneE');
    const roz = c14Foe(sim, 'c14_sankaE');
    expect(bri.def.invulnerable && roz.def.invulnerable).toBe(true);
    expect([kak.spriteId, bri.spriteId, roz.spriteId]).toEqual(['c14_suroas', 'c14_brianne', 'c14_sanka']);
    kak.hp = Math.floor(kak.maxHp * 0.8);
    await driveUntil(sim, 'transformation', () => st.flag('c14_fireballsUp'));
    expect([kak.spriteId, bri.spriteId, roz.spriteId]).toEqual(['c14_kakunsa', 'ribrianne', 'c14_rozie']);
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    c14Finish(sim, kak);
    await driveUntil(sim, 'Kakunsa thrown out', done, 60000);
    expect(st.flag('c14_fireballsDone')).toBe(true);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Goku and Hit vs Dyspo (ep 104): Hit fights on his own, freezing K\'nsi first, and Goku fights in Super Saiyan God', async () => {
    const sim = c14Sim('android17');
    const st = sim.game.state;
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_dyspoTag');
    expect(st.data.active).toBe('goku');
    expect(sim.game.field?.player.formActive).toBe('ssg');
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c14_hitD')).toBe(true);
    const knsi = c14Foe(sim, 'c14_knsi1');
    const dyspo = c14Foe(sim, 'c14_dyspoA1');
    let froze = false;
    for (let i = 0; i < 1200 && !froze; i += 2) {
      await drive(sim, 2);
      froze = knsi.frozen > 0;
    }
    // The hero never attacked: Hit's Time-Skip landed on K'nsi (his preferred target) and froze him in time.
    expect(froze).toBe(true);
    expect(knsi.hp < knsi.maxHp || knsi.dead || knsi.state === 'dying').toBe(true);
    expect(dyspo.hp).toBe(dyspo.maxHp);
    c14Finish(sim, dyspo);
    await driveUntil(sim, 'Dyspo pulls back', done, 60000);
    expect(st.flag('c14_dyspoTagDone')).toBe(true);
    expect(sim.game.field?.player.formActive).toBeNull();
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Saonel and Pirina (ep 118): a downed twin regenerates unless the other falls in time; the twist is revealed', async () => {
    const { TWIN } = await import('../../src/content/chapters/act5/c14_assist');
    const { TWIN_EXP } = await import('../../src/content/chapters/act5/c14_enemies');
    const sim = c14Sim('android17');
    const st = sim.game.state;
    const log = record(sim);
    const done = await c14IntoFight(sim, 'top_arena_b', 'c14_namek');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.data.active).toBe('gohan');
    expect(f.npcs.some((n) => n.def.id === 'c14_piccoloN')).toBe(true);
    const sao = c14Foe(sim, 'c14_saonel1');
    const pir = c14Foe(sim, 'c14_pirina1');
    // Canon's twist at the first phase change: every Namekian of their world fused into the two of them.
    sao.hp = Math.floor(sao.maxHp * 0.6);
    await driveUntil(sim, 'the twist', () => st.flag('c14_namekTwist'));
    expect(log.some((l) => /every warrior of our planet fused into the two of us/.test(l.text))).toBe(true);
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    // One twin down alone: a regeneration window opens, and the bar shows the twin still standing.
    c14Finish(sim, sao);
    expect(sao.ended).toBe(true);
    await drive(sim, 2);
    expect(f.timer?.label).toBe(TWIN.label);
    expect(f.boss).toBe(pir);
    await driveUntil(sim, 'Saonel regenerates', () => !sao.ended, 1200);
    expect(sao.hp).toBe(Math.round(sao.maxHp * TWIN.regen));
    expect(f.timer).toBeNull();
    // Both down together: the fight ends, and the pair pays one reward.
    const exp0 = st.char('gohan').exp;
    c14Finish(sim, sao);
    c14Finish(sim, pir);
    await driveUntil(sim, 'blasted off together', done, 60000);
    expect(st.char('gohan').exp - exp0).toBeGreaterThanOrEqual(TWIN_EXP);
    expect(st.flag('c14_namekDone')).toBe(true);
    expect(log.some((l) => /Universe 6 and Universe 2 have no fighters left/.test(l.text))).toBe(true);
    // Piccolo stays on the stage for the next set piece (Gamisalas takes over from him).
    expect(c14Leftovers(sim)).toEqual(['c14_piccoloN']);
    expect(sim.errors).toEqual([]);
  });

  it('Ribrianne (eps 117-118): Android 18 fights alongside 17, and Ribrianne grows into Super Ribrianne', async () => {
    const sim = c14Sim('goku');
    const st = sim.game.state;
    const done = await c14IntoFight(sim, 'top_arena_b', 'c14_ribrianne');
    expect(st.data.active).toBe('android17');
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c14_18R')).toBe(true);
    const rib = c14Foe(sim, 'c14_ribrianne1');
    // The hero never attacks: Android 18 wears Ribrianne down on her own.
    for (let i = 0; i < 1500 && rib.hp === rib.maxHp; i += 5) await drive(sim, 5);
    expect(rib.hp).toBeLessThan(rib.maxHp);
    rib.hp = Math.floor(rib.maxHp * 0.7);
    await driveUntil(sim, 'Super Ribrianne', () => rib.spriteId === 'c14_superRibrianne');
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    c14Finish(sim, rib);
    await driveUntil(sim, 'Ribrianne and Rozie out', done, 60000);
    expect(st.flag('c14_ribrianneDone')).toBe(true);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Gamisalas (ep 119): invisible except for his cues; standing still lets Piccolo hear him; the cloak drops when he falls', async () => {
    const { CLOAK, cloakLevel } = await import('../../src/content/chapters/act5/c14_assist');
    // The cue rules: unseen by default; the strongest current cue wins.
    const quiet = { windup: false, reveal: 0, listen: 0, flicker: 0 };
    expect(cloakLevel(quiet)).toBe(1);
    expect(cloakLevel({ ...quiet, flicker: 2 })).toBeLessThan(1);
    expect(cloakLevel({ ...quiet, windup: true })).toBeLessThanOrEqual(0.5);
    expect(cloakLevel({ ...quiet, listen: CLOAK.listen - 1 })).toBe(1);
    expect(cloakLevel({ ...quiet, listen: CLOAK.listen })).toBeLessThan(0.5);
    expect(cloakLevel({ ...quiet, reveal: 1, windup: true })).toBeLessThanOrEqual(0.2);

    const sim = c14Sim('gohan');
    const st = sim.game.state;
    const log = record(sim);
    const done = await c14IntoFight(sim, 'top_arena_b', 'c14_gamisalas');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.data.active).toBe('piccolo');
    const gam = c14Foe(sim, 'c14_gamisalas1');
    expect(gam.cloak).toBeGreaterThanOrEqual(0.5);
    // Hold him in place so nothing interrupts the hero standing still; after a second Piccolo hears him.
    gam.frozen = 100000;
    await drive(sim, CLOAK.listen + 4);
    expect(gam.cloak).toBeLessThan(0.5);
    // A landed blow shows where he is...
    expect(f.applyDamage(gam, 30, 1, { x: 0, y: 0 }, 0, false)).toBeGreaterThan(0);
    await drive(sim, 1);
    expect(gam.cloak).toBeLessThanOrEqual(0.2);
    // ...but once the hero is on the move again and the reveal has passed, he is hard to see.
    await drive(sim, CLOAK.reveal + 4, ['right']);
    expect(gam.cloak).toBeGreaterThanOrEqual(0.5);
    gam.frozen = 0;
    c14Finish(sim, gam);
    await drive(sim, 1);
    expect(gam.cloak).toBe(0);
    await driveUntil(sim, 'Gamisalas, then Piccolo, out', done, 60000);
    expect(st.flag('c14_gamisalasDone')).toBe(true);
    for (const re of [/Gamisalas has been eliminated/, /Piccolo has been eliminated by Damom/, /Universe 4 is erased/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    expect(f.player.hidden).toBe(false);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('a cloaked enemy is drawn without its ground shadow and at the cloak\'s opacity; a hit flash shows through', async () => {
    const { Enemy } = await import('../../src/game/enemy');
    const e = new Enemy('c14_gamisalas', 100, 100);
    const ops: Array<{ op: string; alpha: number }> = [];
    const target: Record<string, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(target, {
      get(t, p: string) {
        if (p in t) return t[p];
        return () => { ops.push({ op: p, alpha: Number(t.globalAlpha) }); };
      },
      set(t, p: string, v) { t[p] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const drawn = (): number | undefined => {
      ops.length = 0;
      e.draw(ctx, 0, 0);
      return ops.filter((o) => o.op === 'drawImage').at(-1)?.alpha;
    };
    const shadow = (): boolean => {
      ops.length = 0;
      e.drawShadow(ctx, 0, 0);
      return ops.some((o) => o.op === 'fill');
    };
    expect(drawn()).toBe(1);
    expect(shadow()).toBe(true);
    e.cloak = 1;
    expect(drawn()).toBe(0);
    expect(shadow()).toBe(false);
    e.cloak = 0.4;
    expect(drawn()).toBeCloseTo(0.6);
    expect(shadow()).toBe(true);
    e.cloak = 1;
    e.flash = 3;
    expect(drawn()).toBe(1);
    expect(e.alpha).toBe(1);
  });

  it('set-piece bosses are fair for the fighter the story forces into them (LoG2 boss hit ratios)', async () => {
    const { CHARACTERS, FORMS } = await import('../../src/content/characters');
    const { CHAPTER_MIN_LEVEL, FORCED_LEVEL_GAP } = await import('../../src/content/chapters/common');
    const { damage, ENEMY_POWER, MELEE_POWER, enemyPowerScale } = await import('../../src/game/leveling');
    type Who = 'goku' | 'gohan' | 'piccolo' | 'android17';
    const avg = (power: number, mult: number, stat: number, end: number): number => {
      let sum = 0;
      for (let r = 0; r < 26; r++) sum += damage({ power, mult, stat, end, res: 1, crit: false, r26: r });
      return sum / 26;
    };
    /** Mean-roll stats of a character at a level (LoG2 level-up growth means). */
    const statsAt = (id: Who, lv: number) => {
      const d = CHARACTERS[id];
      let hp = d.base.hp;
      for (let l = 1; l < lv; l++) hp += Math.floor((hp * (3604 + 655)) / 65536);
      const g = (k: 'str' | 'end') => d.base[k] + Math.floor(((lv - 1) * (d.growth[k][0] + d.growth[k][1])) / 2 / 256);
      return { hp, str: g('str'), end: g('end') };
    };
    const band = CHAPTER_MIN_LEVEL[14];
    const forced = band - FORCED_LEVEL_GAP;
    // [boss, fighter, level, form, max ratio]: twins must fall together, so each half gets half the budget.
    const cases: Array<[string, Who, number, string | null, number]> = [
      ['c14_kahseral', 'goku', band, 'ssb', 4], ['c14_kakunsa', 'android17', 46, null, 4], ['c14_dyspoA', 'goku', band, 'ssg', 4],
      ['c14_ribrianne', 'android17', 46, null, 4], ['c14_gamisalas', 'piccolo', forced, 'unweighted', 4],
      ['c14_saonel', 'gohan', forced, 'ultimate', 2.5], ['c14_pirina', 'gohan', forced, 'ultimate', 2.5],
    ];
    for (const [id, who, lv, form, max] of cases) {
      const b = ENEMIES[id];
      const h = statsAt(who, lv);
      const bonus = form ? Number(FORMS[form].bonus) : 0;
      const hitsToEnd = (b.hp * (1 - (b.boss?.endAt ?? 0))) / avg(MELEE_POWER, 1, h.str + bonus, b.end);
      const hitsToKo = h.hp / avg(ENEMY_POWER, enemyPowerScale(b.str), b.str, h.end + bonus);
      const ratio = hitsToEnd / hitsToKo;
      expect(ratio, `${id} vs ${who} L${lv}`).toBeLessThanOrEqual(max);
      expect(ratio, `${id} vs ${who} L${lv}`).toBeGreaterThan(1);
      // Headliners stay above them: every set-piece boss is weaker than Kefla.
      expect(b.str + b.pow + b.end, id).toBeLessThan(ENEMIES.c14_kefla.str + ENEMIES.c14_kefla.pow + ENEMIES.c14_kefla.end);
    }
  });

  it('the stage is a LoG2 hostile zone populated by the universes still standing', () => {
    const U11 = ['c14_pride', 'fc_topGunner', 'c14_prideLancer'];
    const ERASED_IN_A = ['c14_u9Wolf', 'c14_u10Fighter'];
    const roster = (map: string, chapter: number, flags: string[]): string[] => {
      const sim = new Sim();
      sim.game.state.data.chapter = chapter;
      for (const fl of flags) sim.game.state.set(fl);
      sim.start(map);
      return (sim.game.field?.enemies ?? []).filter((e) => !e.uid).map((e) => e.def.id);
    };
    // Between the first two relays: Universes 2, 3, 4 and 11, never the erased 9 and 10.
    for (const map of ['top_arena_a', 'top_arena_b']) {
      const mid = roster(map, 14, ['c14_departed', 'c14_stageA']);
      expect(mid.length, map).toBeGreaterThanOrEqual(10);
      expect(mid.filter((t) => ERASED_IN_A.includes(t)), map).toEqual([]);
      expect(new Set(mid).size, map).toBeGreaterThanOrEqual(4);
    }
    // After the central ring: only Universe 11's Pride Troopers (stage C's are west of its trigger band).
    for (const [map, min] of [['top_arena_a', 8], ['top_arena_b', 8], ['top_arena_c', 3]] as const) {
      const late = roster(map, 14, ['c14_departed', 'c14_stageA', 'c14_stageB']);
      expect(late.length, map).toBeGreaterThanOrEqual(min);
      expect(late.filter((t) => !U11.includes(t)), map).toEqual([]);
    }
    const bandC = resolveMap('top_arena_c')?.triggers?.find((t) => t.id === 'c14_stageC_t');
    for (const e of resolveMap('top_arena_c')?.enemies ?? []) if (e.showIf?.includes('c14_stageB')) expect(e.x, `${e.type}@${e.x},${e.y}`).toBeLessThan(bandC?.x ?? 0);
    // Post-game: every restored universe trains on all three rings.
    const post = ['top_arena_a', 'top_arena_b', 'top_arena_c'].map((m) => roster(m, 15, ['post_game', 'c14_won']));
    for (const r of post) expect(r.length).toBeGreaterThanOrEqual(12);
    for (const t of ERASED_IN_A) expect(post.flat()).toContain(t);
    // Staged fights still clear the stage.
    expect(roster('top_arena_b', 14, ['fc_topQuiet'])).toEqual([]);
    // Every spawn stands on open ground, at least five tiles from the ring's save disc.
    for (const map of ['top_arena_a', 'top_arena_b', 'top_arena_c']) {
      const sim = new Sim();
      sim.game.state.data.chapter = 14;
      sim.game.state.set('fc_topQuiet');
      sim.start(map);
      const f = sim.game.field;
      const def = resolveMap(map);
      if (!f || !def) throw new Error(map);
      const saves = (def.objects ?? []).filter((o) => o.type === 'save');
      expect(saves.length, map).toBeGreaterThan(0);
      for (const e of def.enemies ?? []) {
        const where = `${map} ${e.type}@${e.x},${e.y}`;
        expect(f.col.blocked({ x: e.x * 16 + 3, y: e.y * 16 + 8, w: 10, h: 6 }), where).toBe(false);
        for (const o of saves) expect(Math.hypot(e.x - o.x, e.y - o.y), where).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('every new Chapter 14 sprite has a Scouter entry', async () => {
    const { SCANS } = await import('../../src/content/scans');
    const sprites = ['c14_kahseral', 'c14_tupper', 'c14_zoiray', 'c14_kettle', 'c14_vewon', 'c14_knsi', 'c14_brianne', 'c14_sanka', 'c14_suroas',
      'c14_rozie', 'c14_kakunsa', 'c14_superRibrianne', 'c14_saonel', 'c14_pirina', 'c14_damom', 'ribrianne', 'gamisalas'];
    for (const id of sprites) {
      expect(CAST[id], id).toBeTruthy();
      expect(SCANS[id]?.name, id).toBeTruthy();
      expect(SCANS[id]?.desc.length, id).toBeGreaterThan(20);
    }
    // A fighter's cutscene actor reads exactly like the fighter itself (regular troopers at their trimmed HP).
    const { enemyMaxHp } = await import('../../src/game/enemy');
    const looks: Array<[string, string]> = [
      ['c14_kahseral', 'c14_kahseral'], ['c14_tupper', 'c14_tupper'], ['c14_zoiray', 'c14_zoiray'], ['c14_kettle', 'c14_kettle'],
      ['c14_vewon', 'c14_vewon'], ['c14_knsi', 'c14_knsi'], ['c14_kakunsa', 'c14_kakunsa'], ['c14_ribrianne', 'ribrianne'],
      ['c14_saonel', 'c14_saonel'], ['c14_pirina', 'c14_pirina'], ['c14_gamisalas', 'gamisalas'],
    ];
    for (const [id, sprite] of looks) {
      const e = ENEMIES[id];
      const sc = SCANS[sprite];
      expect([sc?.name, sc?.hp, sc?.str, sc?.pow, sc?.end], id).toEqual([e.name, enemyMaxHp(e), e.str, e.pow, e.end]);
    }
  });
});
