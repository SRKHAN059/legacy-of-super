import { describe, expect, it } from 'vitest';
import { portrait } from '../../src/art/registry';
import { CAST } from '../../src/content/cast';
import { EPISODES, EPISODES_NEEDED } from '../../src/content/chapters/act5/c12';
import { BALLGAME, CATCH_RADIUS, MVP_BONUS, MVP_MAX, SLIDE_WINDOW, START_RUNS, SWEET_SPOT, SWING_WINDOW } from '../../src/content/chapters/act5/c12_baseball';
import { EP, POD_OUT, WISH_BALLS } from '../../src/content/chapters/act5/c12_eps_maps';
import { COOLANT_MAX } from '../../src/content/chapters/act5/c12_wish';
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
      ['c13_monster_beach', 'c13_ani1'], ['snow_peak', 'c13_ani2'], ['c13_monster_camp', 'c13_ani3'], ['kame_reef', 'c13_ani4'],
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
      // The jungle's north trail has a Gohan story gate (common.ts STORY_GATES), broken here; tests/full_game.test.ts
      // checks that it walls the poacher camp off until then.
      sim.game.state.set('gate:c13_monster_jungle:c13_g_north');
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

  it('Universe 6, part one (eps 88-89): Cabba recruits Caulifla as soon as Tien or Gohan is in, then the story cuts back', async () => {
    // Tien joins first: the cutaway plays at the end of the dojo event, as Cabba, and hands back to the dojo.
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    for (const id of ['vegeta', 'gohan', 'piccolo'] as const) st.join(id, 42);
    st.char('vegeta').form = 'ssb';
    const veg = st.char('vegeta');
    veg.hp = Math.round(veg.hpMax * 0.7);
    const [hp, str] = [veg.hp, veg.str];
    st.addQuest('c13_tien');
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    await beat(sim, 'c13_tien_dojo', 'c13_dojo_event', 18, 20);
    expect(st.data.journal.c13_tien).toBe('done');
    expect(QUESTS.c13_u6.star).toBe('gold');
    expect(st.data.journal.c13_u6).toBe('done');
    expect(st.data.journal.c13_u6kale).toBeUndefined();
    const order = [/Tien Shinhan\. Do you remember Yurin/, /Meanwhile, in Universe 6/, /Seventy rival fighters/, /her potential is bigger/, /Fresh meat/,
      /your hair just turned GOLD/, /go away with him/, /Back in Universe 7/, /The Mighty Ten: \d+ of 10/];
    const idx = order.map((re) => said(re));
    for (const [i, re] of order.entries()) expect(idx[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(idx[i - 1]);
    // Played as Cabba (Vegeta's stand-in) on Champa's planet and in the old quarter; nobody from Universe 7 is there.
    const u6 = log.slice(idx[1], idx[7]).filter((l) => /^c13_(champa_terrace|sadala_quarter)$/.test(l.map));
    expect(new Set(u6.map((l) => l.map))).toEqual(new Set(['c13_champa_terrace', 'c13_sadala_quarter']));
    expect(u6.every((l) => l.hero === 'vegeta')).toBe(true);
    // Back where the player was, as who they were, free to switch; Vegeta keeps his look, form, HP and EXP.
    expect(sim.game.field?.def.id).toBe('c13_tien_dojo');
    expect(st.data.active).toBe('goku');
    expect(st.flag('noSwitch')).toBe(false);
    expect([veg.outfit, veg.form, veg.hp]).toEqual([undefined, 'ssb', hp]);
    expect(veg.str).toBeGreaterThanOrEqual(str);
    for (const f of ['c13_u6Stash', 'c13_u6Boost', 'act5_busy', 'act5_prev_u6']) expect(st.flag(f), f).toBe(false);
    expect(sim.errors).toEqual([]);

    // Gohan's training next: Goku vs. Gohan follows, and the recruiting cutaway never replays.
    st.addQuest('c13_gohan');
    await beat(sim, 'lookout', 'c13_piccolo_talk', 26, 23);
    expect(st.data.journal.c13_leader).toBe('done');
    expect(log.filter((l) => /^Meanwhile, in Universe 6/.test(l.text)).length).toBe(1);

    // Gohan first instead: it plays after his training, before Tien has even been asked.
    const sim2 = freshSim(13, 44);
    const st2 = sim2.game.state;
    for (const id of ['vegeta', 'gohan', 'piccolo'] as const) st2.join(id, 42);
    st2.addQuest('c13_gohan');
    await beat(sim2, 'lookout', 'c13_piccolo_talk', 26, 23);
    expect(st2.data.journal.c13_u6).toBe('done');
    expect(st2.data.journal.c13_leader).toBeUndefined();
    expect(sim2.game.field?.def.id).toBe('c13_training_wilds');
    expect(st2.data.active).toBe('goku');

    // Krillin or 17 alone does not cut away (the anime cuts to Sadala in Gohan's and Tien's episodes).
    const sim3 = freshSim(13, 44);
    const st3 = sim3.game.state;
    st3.join('vegeta', 42);
    st3.addQuest('c13_krillin');
    await beat(sim3, 'satan_plaza', 'c13_krillin_talk', 21, 23);
    expect(st3.data.journal.c13_krillin).toBe('done');
    expect(st3.data.journal.c13_u6).toBeUndefined();
  });

  it('Universe 6, part two (eps 92-93) cuts in between Goku\'s Frieza plan and Hell: Caulifla\'s Super Saiyan, then Kale', async () => {
    const sim = friezaReady();
    const st = sim.game.state;
    st.addQuest('c13_u6');
    st.completeQuest('c13_u6');
    const veg = st.char('vegeta');
    const before = { str: veg.str, pow: veg.pow, end: veg.end };
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);

    // Gold story beat, recorded in the Journal; the chapter still hands over to the tournament.
    expect(QUESTS.c13_u6kale.star).toBe('gold');
    expect(st.data.journal.c13_u6kale).toBe('done');
    expect(st.flag('c13_u6KaleCalmed')).toBe(true);
    expect(st.data.journal.c13_frieza).toBe('done');
    expect(st.data.chapter).toBe(14);
    // Canon order: the plan, Universe 6 (Caulifla's Super Saiyan, the spar, Kale, Caulifla talks her down, Champa
    // hears that Hit has brought Frost in), then Hell. Part one is not replayed.
    const order = [/Frieza!$/, /Meanwhile, in Universe 6\. A few days later/, /Like\.\.\. THIS/, /We'll call this one a draw/, /TAKE YOU AWAY/,
      /KALE! STOP!/, /Look at me! It's me/, /it's just GONE/, /Hit has returned with Frost/, /Cabbage, Cauliflower and Kale/,
      /presents himself at King Yemma/, /Come to gloat/];
    const idx = order.map((re) => said(re));
    for (const [i, re] of order.entries()) expect(idx[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(idx[i - 1]);
    expect(said(/Seventy rival fighters/)).toBe(-1);
    // Caulifla's Super Saiyan 2 belongs to the tournament (Goku shows her in ep 100), not to Sadala.
    expect(log.some((l) => /Super Saiyan\W*(2|TWO)/i.test(l.text) && /^c13_(champa|sadala)/.test(l.map))).toBe(false);
    // The crags are played as Cabba (Vegeta's stand-in); Goku never meets the U6 Saiyans before the tournament.
    const u6 = log.slice(idx[1], idx[idx.length - 2]).filter((l) => /^c13_(champa_terrace|sadala_crags)$/.test(l.map));
    expect(new Set(u6.map((l) => l.map))).toEqual(new Set(['c13_champa_terrace', 'c13_sadala_crags']));
    expect(u6.every((l) => l.hero === 'vegeta')).toBe(true);
    expect(log.some((l) => /^c13_sadala/.test(l.map) && l.hero === 'goku')).toBe(false);
    // Vegeta gets his own look, form and stats back (the EXP Cabba earned stays, so stats can only have grown).
    expect(veg.outfit).toBeUndefined();
    expect(veg.form).toBe('ssb');
    expect(veg.level).toBeGreaterThanOrEqual(42);
    for (const k of ['str', 'pow', 'end'] as const) expect(veg[k] - before[k], k).toBeGreaterThanOrEqual(0);
    for (const f of ['c13_u6Stash', 'c13_u6Boost', 'c13_u6Rampage', 'c13_u6Shouted', 'act5_busy', 'act5_prev_u6']) expect(st.flag(f), f).toBe(false);
    expect(sim.errors).toEqual([]);

    // A save from before part one existed (Gohan and Tien already in): both parts play here, in order.
    const sim2 = friezaReady();
    const st2 = sim2.game.state;
    const log2 = record(sim2);
    const said2 = (re: RegExp) => log2.findIndex((l) => re.test(l.text));
    await beat(sim2, 'cc_yard', 'act5_beerus_talk', 25, 17);
    expect([st2.data.journal.c13_u6, st2.data.journal.c13_u6kale, st2.data.journal.c13_frieza]).toEqual(['done', 'done', 'done']);
    const seq = [/Frieza!$/, /Seventy rival fighters/, /your hair just turned GOLD/, /A few days later/, /Like\.\.\. THIS/, /Come to gloat/].map(said2);
    for (let i = 1; i < seq.length; i++) expect(seq[i], `step ${i}`).toBeGreaterThan(seq[i - 1]);
    expect(said2(/Back in Universe 7\.\.\.$/)).toBe(-1);
    expect(sim2.errors).toEqual([]);

    // The episode on its own: Cabba steps in fresh, and Vegeta's HP and EP are what they were; Goku stays forced.
    const sim3 = friezaReady();
    const st3 = sim3.game.state;
    st3.addQuest('c13_u6');
    st3.completeQuest('c13_u6');
    const v3 = st3.char('vegeta');
    v3.hp = Math.round(v3.hpMax * 0.6);
    v3.ep = Math.round(v3.epMax * 0.5);
    const [hp, ep, str] = [v3.hp, v3.ep, v3.str];
    sim3.start('cc_yard', 25, 17);
    await settle(sim3);
    st3.set('noSwitch');
    expect(await sim3.run('c13_u6_episode', {}, TICKS)).toBe(true);
    expect([v3.hp, v3.ep, v3.outfit, v3.form]).toEqual([hp, ep, undefined, 'ssb']);
    expect(v3.str).toBeGreaterThanOrEqual(str);
    expect(st3.data.active).toBe('goku');
    expect(st3.flag('noSwitch')).toBe(true);
    expect(sim3.errors).toEqual([]);
    // Asking again never replays it.
    const log3 = record(sim3);
    expect(await sim3.run('c13_u6_episode', {}, TICKS)).toBe(true);
    expect(log3.length).toBe(0);
  });

  it('a Saiyan who has transformed on screen speaks with the transformed portrait (Caulifla, Kale)', async () => {
    const sim = friezaReady();
    const st = sim.game.state;
    st.addQuest('c13_u6');
    st.completeQuest('c13_u6');
    const faces: Array<{ text: string; portrait: unknown }> = [];
    const g = sim.game;
    const orig = g.say.bind(g);
    g.say = (lines) => {
      for (const l of lines) faces.push({ text: l.text, portrait: l.portrait });
      return orig(lines);
    };
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    const face = (re: RegExp): unknown => faces.find((f) => re.test(f.text))?.portrait;
    // Before the change: the everyday faces.
    expect(face(/A tingle in my back\.\.\. Like/)).toBe(portrait('caulifla', 'shout'));
    expect(face(/You're going to leave me behind/)).toBe(portrait('kale', 'sad'));
    // Golden Caulifla and berserk Kale on screen: the dialogue box shows the same look.
    expect(face(/punch a hole in the planet/)).toBe(portrait('c13_cauliflaSSJ', 'happy'));
    expect(face(/^KALE! STOP!/)).toBe(portrait('c13_cauliflaSSJ', 'shout'));
    expect(face(/^GRAAAAH!/)).toBe(portrait('c13_kaleBerserk', 'shout'));
    expect(face(/^\.\.\.Sis\.\.\.$/)).toBe(portrait('c13_kaleBerserk', 'sad'));
    expect(sim.errors).toEqual([]);
  });

  it('berserk Kale cannot be hurt; reaching Caulifla and pressing A makes her step in', async () => {
    const { SADALA } = await import('../../src/content/chapters/act5/c13_maps');
    const sim = freshSim(13, 44);
    const st = sim.game.state;
    st.join('vegeta', 42);
    st.data.active = 'vegeta';
    sim.start('c13_sadala_crags', 13, 14);
    await settle(sim);
    const log = record(sim);
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
    expect(st.flag('c13_u6Shouted')).toBe(false);
    // Cabba's plea, then Caulifla throws herself between them and talks Kale down (no Super Saiyan 2 yet).
    const at = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    expect(at(/Caulifla, PLEASE/)).toBeGreaterThan(-1);
    expect(at(/KALE! STOP!/)).toBeGreaterThan(at(/Caulifla, PLEASE/));
    expect(at(/Look at me! It's me/)).toBeGreaterThan(at(/KALE! STOP!/));
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
    // Four stay on Chapter 13's own maps and Mt. Paozu; three sit behind old hubs' coloured gates, each one a
    // different fighter's (LoG2's gated Namekians made you rotate the party).
    const GATED: Array<[string, string, string, string, number, [number, number]]> = [
      ['c13_ani5', 'waste_canyon', 'eb_g25_vegeta', 'vegeta', 25, [3, 13]],
      ['c13_ani2', 'snow_peak', 'g40_goku', 'goku', 40, [18, 30]],
      ['c13_ani4', 'kame_reef', 'ea_g25_gohan', 'gohan', 25, [10, 12]],
    ];
    expect(new Set(GATED.map((g) => g[3])).size).toBe(GATED.length);
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
    // Cabba stands on open lawn the player can walk up to.
    const cabba = resolveMap('cc_yard')?.npcs?.find((n) => n.id === 'c13_cabbaCC');
    const yard = sim.game.field;
    if (!cabba || !yard) throw new Error('no Cabba at Capsule Corp');
    expect(yard.col.blocked({ x: cabba.x * 16 + 3, y: cabba.y * 16 + 8, w: 10, h: 6 })).toBe(false);
    expect(near(reachable(sim, 25, 17), cabba.x, cabba.y)).toBe(true);
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

  it('Chapter 13 interlude fights are fair for the fighter the story forces into them (LoG2 boss hit ratios)', async () => {
    const { CHARACTERS, FORMS } = await import('../../src/content/characters');
    const { CHAPTER_MIN_LEVEL, FORCED_LEVEL_GAP } = await import('../../src/content/chapters/common');
    const { damage, ENEMY_POWER, MELEE_POWER, enemyPowerScale } = await import('../../src/game/leveling');
    const { enemyMaxHp } = await import('../../src/game/enemy');
    const avg = (power: number, mult: number, stat: number, end: number): number => {
      let sum = 0;
      for (let r = 0; r < 26; r++) sum += damage({ power, mult, stat, end, res: 1, crit: false, r26: r });
      return sum / 26;
    };
    /** Mean-roll stats of a character at a level (LoG2 level-up growth means). */
    const statsAt = (id: 'goku' | 'vegeta', lv: number) => {
      const d = CHARACTERS[id];
      let hp = d.base.hp;
      for (let l = 1; l < lv; l++) hp += Math.floor((hp * (3604 + 655)) / 65536);
      const g = (k: 'str' | 'end') => d.base[k] + Math.floor(((lv - 1) * (d.growth[k][0] + d.growth[k][1])) / 2 / 256);
      return { hp, str: g('str'), end: g('end') };
    };
    // Cabba is Vegeta at the forced floor: base in the gang brawl, Super Saiyan (+10, no Z form) against Caulifla.
    // Goku meets Gohan at the chapter's band start in Super Saiyan Blue; the post-game rematch is at the post band.
    const forced = CHAPTER_MIN_LEVEL[13] - FORCED_LEVEL_GAP;
    const ssj = Number(FORMS.ssj.bonus);
    const ssb = Number(FORMS.ssb.bonus);
    const cases: Array<[string, 'goku' | 'vegeta', number, number, number]> = [
      ['c13_gangPunk', 'vegeta', forced, 0, 3], ['c13_gangBrute', 'vegeta', forced, 0, 3], ['c13_gangSlinger', 'vegeta', forced, 0, 3],
      ['c13_cauliflaSSJ', 'vegeta', forced, ssj, 3.6], ['c13_gohanTag', 'goku', CHAPTER_MIN_LEVEL[13], ssb, 4],
      ['c13_gohanUltimate', 'goku', CHAPTER_MIN_LEVEL[13], ssb, 4], ['c13_cauliflaRematch', 'vegeta', CHAPTER_MIN_LEVEL[15], ssb, 4],
      ['c13_kaleRematch', 'goku', CHAPTER_MIN_LEVEL[15], ssb, 4],
    ];
    for (const [id, who, lv, bonus, max] of cases) {
      const b = ENEMIES[id];
      const h = statsAt(who, lv);
      const atk = Math.max(b.str, b.pow);
      const hitsToEnd = (enemyMaxHp(b) * (1 - (b.boss?.endAt ?? 0))) / avg(MELEE_POWER, 1, h.str + bonus, b.end);
      const hitsToKo = h.hp / avg(ENEMY_POWER, enemyPowerScale(atk), atk, h.end + bonus);
      const ratio = hitsToEnd / hitsToKo;
      expect(ratio, `${id} vs ${who} L${lv}`).toBeLessThanOrEqual(max);
      expect(ratio, `${id} vs ${who} L${lv}`).toBeGreaterThan(1);
    }
    // Berserk Kale is a survival set piece: nothing the player does can hurt her, and the timer is the way out.
    expect(ENEMIES.c13_kaleBerserk.boss?.vulnerableIf).toBe('c13_u6KaleCalmed');
    expect(ENEMIES.c13_kaleBerserk.exp).toBe(0);
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
    const sprites = ['c14_kahseral', 'c14_tupper', 'c14_zoiray', 'c14_kettle', 'c14_cocotte', 'c14_knsi', 'c14_brianne', 'c14_sanka', 'c14_suroas',
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
      ['c14_cocotte', 'c14_cocotte'], ['c14_knsi', 'c14_knsi'], ['c14_kakunsa', 'c14_kakunsa'], ['c14_ribrianne', 'ribrianne'],
      ['c14_saonel', 'c14_saonel'], ['c14_pirina', 'c14_pirina'], ['c14_gamisalas', 'gamisalas'],
    ];
    for (const [id, sprite] of looks) {
      const e = ENEMIES[id];
      const sc = SCANS[sprite];
      expect([sc?.name, sc?.hp, sc?.str, sc?.pow, sc?.end], id).toEqual([e.name, enemyMaxHp(e), e.str, e.pow, e.end]);
    }
  });
});

// ------------------------------------------------------------------------------------------------ Chapter 14 review

/** A Chapter 14 stage save with fixed dice: the same seed rolls the same stats and plays the same fight. */
async function c14Seeded(active: 'goku' | 'gohan' | 'piccolo' | 'android17', seed: number): Promise<Sim> {
  const { Rng } = await import('../../src/engine/math');
  const { CHAPTER_MIN_LEVEL, FORCED_LEVEL_GAP } = await import('../../src/content/chapters/common');
  const sim = new Sim();
  const st = sim.game.state;
  st.data.seed = seed;
  st.rng = new Rng(seed);
  st.data.chapter = 14;
  const band = CHAPTER_MIN_LEVEL[14];
  // The story's own levels: Goku and Vegeta at the band start, Gohan and Piccolo at the forced floor (a playthrough
  // that never rotated them arrives there), the guests at their join levels.
  st.join('goku', band);
  st.join('vegeta', band);
  for (const id of ['gohan', 'piccolo'] as const) st.join(id, band - FORCED_LEVEL_GAP);
  st.join('android17', 46);
  st.join('frieza', 47);
  st.set('c14_departed');
  st.set('fc_topQuiet');
  st.addQuest('c14_top');
  st.data.active = active;
  return sim;
}

/** What a fair-play run of a set piece cost. */
interface C14Run {
  finished: boolean;
  died: boolean;
  /** Frames the player had control in a fight. */
  fightFrames: number;
  /** HP refills the bot needed (a Senzu Bean each, taken below 20% HP). */
  senzu: number;
  /** HP lost, summed over the whole run. */
  lost: number;
  hpMax: number;
}

/**
 * Play a set piece like a player who never dodges: read dialogue, then in a fight walk (running, around the void) to
 * the nearest enemy that can be hurt, punch it with the A combo, fire ki blasts when lined up at range, and eat a
 * Senzu Bean below 20% HP. Every hit both ways uses the real damage rules.
 */
async function c14FairPlay(sim: Sim, script: string, maxFrames = 60 * 60 * 4): Promise<C14Run> {
  const run: C14Run = { finished: false, died: false, fightFrames: 0, senzu: 0, lost: 0, hpMax: 0 };
  void sim.game.runScript(script).then(() => { run.finished = true; });
  const g = sim.game;
  let toggle = false;
  let lastHp = -1;
  const press = (b: Button, on = true) => sim.input.inject(b, on);
  for (let i = 0; i < maxFrames && !run.finished; i++) {
    const top = g.scenes.top?.constructor.name ?? '';
    const f = g.field;
    for (const b of ['left', 'right', 'up', 'down', 'A', 'B'] as const) press(b, false);
    if (/Dialogue|TitleCard|BeamStruggle|Choice/.test(top)) {
      toggle = !toggle;
      press('A', toggle);
    } else if (/GameOver/.test(top)) {
      run.died = true;
      break;
    } else if (f && g.allowControl && top === 'Field') {
      const p = f.player;
      run.fightFrames++;
      run.hpMax = p.cs.hpMax;
      if (lastHp >= 0 && p.cs.hp < lastHp) run.lost += lastHp - p.cs.hp;
      if (p.state === 'dead') { run.died = true; break; }
      if (p.cs.hp < p.cs.hpMax * 0.2) { p.cs.hp = p.cs.hpMax; run.senzu++; }
      lastHp = p.cs.hp;
      const hittable = f.enemies.filter((e) => !e.dead && e.state !== 'dying' && !e.ended && !e.hidden && !e.puppet && !e.def.invulnerable);
      const open = hittable.filter((e) => !e.def.boss?.vulnerableIf || g.state.check(e.def.boss.vulnerableIf));
      const pool = open.length ? open : hittable;
      let t: C14Foe | null = null;
      for (const e of pool) if (!t || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(t.x - p.x, t.y - p.y)) t = e;
      if (t) {
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        toggle = !toggle;
        if (Math.abs(dy) < 7 && Math.abs(dx) > 40 && Math.abs(dx) < 150 && p.cs.ep > 10) { p.dir = dx > 0 ? 'right' : 'left'; press('B', toggle); }
        else if (Math.abs(dx) < 7 && Math.abs(dy) > 40 && Math.abs(dy) < 120 && p.cs.ep > 10) { p.dir = dy > 0 ? 'down' : 'up'; press('B', toggle); }
        else if (Math.abs(dy) < 9 && Math.abs(dx) < 24) { p.dir = dx > 0 ? 'right' : 'left'; press('A', toggle); }
        else if (Math.abs(dx) < 9 && Math.abs(dy) < 34) { p.dir = dy > 0 ? 'down' : 'up'; press('A', toggle); }
        else {
          // Next step of the shortest walk to the tile beside the target (the void and props are in the way).
          let gx = t.x - Math.sign(dx || 1) * 16;
          let gy = t.y;
          const hx = Math.floor(p.x / 16);
          const hy = Math.floor((p.y - 14) / 16);
          const ex = Math.floor(gx / 16);
          const ey = Math.floor((gy - 14) / 16);
          const seen = reachable(sim, hx, hy);
          if (seen.has(`${ex},${ey}`)) {
            const prev = new Map<string, string>();
            const queue: Array<[number, number]> = [[hx, hy]];
            prev.set(`${hx},${hy}`, '');
            while (queue.length && !prev.has(`${ex},${ey}`)) {
              const [cx, cy] = queue.shift() as [number, number];
              for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const k = `${cx + sx},${cy + sy}`;
                if (prev.has(k) || !seen.has(k)) continue;
                prev.set(k, `${cx},${cy}`);
                queue.push([cx + sx, cy + sy]);
              }
            }
            const path: string[] = [];
            for (let k = `${ex},${ey}`; k && k !== `${hx},${hy}`; k = prev.get(k) ?? '') path.unshift(k);
            for (const k of path) {
              const [tx, ty] = k.split(',').map(Number);
              gx = tx * 16 + 8;
              gy = ty * 16 + 14;
              if (Math.abs(gx - p.x) > 3 || Math.abs(gy - p.y) > 3) break;
            }
          }
          let held: Button | null = null;
          if (gx - p.x > 2) held = 'right';
          else if (gx - p.x < -2) held = 'left';
          if (held) press(held);
          if (gy - p.y > 2) { press('down'); held = held ?? 'down'; } else if (gy - p.y < -2) { press('up'); held = held ?? 'up'; }
          if (!held) { held = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; press(held); }
          // Hold the run (a double-tap held down).
          (p as unknown as { runBtn: Button | null }).runBtn = held;
        }
      }
    } else lastHp = -1;
    sim.input.poll();
    g.scenes.update(sim.input);
    await flush();
  }
  return run;
}

describe('Chapter 14 review: staging, canon and fair play', () => {
  it('every fighter is staged on ground the hero can walk to, clear of the void where the platform allows', async () => {
    const { FIGHT_MARGIN, onStage } = await import('../../src/content/chapters/act5/c14_kit');
    const { ScriptApi } = await import('../../src/game/script');
    const offsets: Array<[number, number]> = [[4, -3], [2, -4], [7, -1], [6, -4], [3, 2], [5, 0], [0, -5]];
    for (const map of ['top_arena_a', 'top_arena_b', 'top_arena_c']) {
      const sim = c14Sim('goku');
      sim.start(map, 22, 16);
      const f = sim.game.field;
      if (!f) throw new Error(map);
      const sa = new ScriptApi(sim.game, {});
      const stageTiles = reachable(sim, Math.floor(f.player.x / 16), Math.floor((f.player.y - 14) / 16));
      expect(stageTiles.size, map).toBeGreaterThan(700);
      const voidNear = (x: number, y: number) => {
        for (let dy = -FIGHT_MARGIN; dy <= FIGHT_MARGIN; dy++) for (let dx = -FIGHT_MARGIN; dx <= FIGHT_MARGIN; dx++) if ((f.map.grid[y + dy]?.[x + dx] ?? 'void') === 'void') return true;
        return false;
      };
      const stranded: string[] = [];
      const atEdge: string[] = [];
      for (const k of stageTiles) {
        const [x, y] = k.split(',').map(Number);
        // Every other tile both ways keeps the run short; the tiles next to the floating rocks are always checked.
        const edge = (map === 'top_arena_a' && x <= 6 && y <= 8) || (map === 'top_arena_b' && x >= 26 && y <= 8);
        if (!edge && (x % 2 !== 0 || y % 2 !== 0)) continue;
        put(sim, x, y);
        for (const [dx, dy] of offsets) {
          const [ax, ay] = onStage(sa, x + dx, y + dy);
          const [bx, by] = onStage(sa, x + dx, y + dy, FIGHT_MARGIN);
          if (!stageTiles.has(`${ax},${ay}`) || !stageTiles.has(`${bx},${by}`)) stranded.push(`hero ${k} +${dx},${dy}`);
          if (voidNear(bx, by)) atEdge.push(`hero ${k} +${dx},${dy} -> ${bx},${by}`);
        }
      }
      expect(stranded, map).toEqual([]);
      expect(atEdge, map).toEqual([]);
    }
  });

  it('a set piece started beside a floating rock still puts every fighter within reach', async () => {
    // From these tiles the plain nearest-free-tile search used to drop fighters onto the floating rocks.
    for (const [map, x, y, script, active, uids] of [
      ['top_arena_a', 3, 6, 'c14_pride', 'goku', ['c14_kahseral1', 'c14_tupper1', 'c14_zoiray1', 'c14_kettle1', 'c14_cocotte1']],
      ['top_arena_b', 28, 4, 'c14_gamisalas', 'gohan', ['c14_gamisalas1']],
      ['top_arena_b', 29, 5, 'c14_ribrianne', 'goku', ['c14_ribrianne1']],
    ] as const) {
      const sim = c14Sim(active);
      sim.start(map, 22, 16);
      await settle(sim);
      put(sim, x, y);
      let finished = false;
      void sim.game.runScript(script).then(() => { finished = true; });
      await driveUntil(sim, `${script} fight`, () => midFight(sim));
      const f = sim.game.field;
      if (!f) throw new Error(map);
      const seen = reachable(sim, Math.floor(f.player.x / 16), Math.floor((f.player.y - 14) / 16));
      for (const uid of uids) {
        const e = c14Foe(sim, uid);
        expect(near(seen, Math.floor(e.x / 16), Math.floor((e.y - 14) / 16)), `${script}: ${uid} within reach`).toBe(true);
      }
      // Bring them down (the squad first: Kahseral can only be hurt once his formation is broken).
      await driveUntil(sim, `${script} finished`, () => {
        for (const e of f.enemies) if (e.uid && (uids as readonly string[]).includes(e.uid) && !e.dead && !e.ended) c14Finish(sim, e);
        return finished;
      }, 60000);
      expect(sim.errors).toEqual([]);
    }
  });

  it('Goku shows Caulifla Super Saiyan 2 at the tournament (ep 100), right before Kale goes berserk', async () => {
    const sim = c14Sim('goku');
    const st = sim.game.state;
    st.clear('fc_topQuiet');
    const log = record(sim);
    sim.start('top_arena_a', 22, 19);
    await settle(sim);
    await beat(sim, null, 'c14_stageA');
    expect(st.flag('c14_stageA')).toBe(true);
    const at = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const order = [/Teach me by losing/, /Super Saiyan 2!/, /Like THIS\?!/, /I won't let anyone take you away from me/, /He stopped her\.\.\. with one shot/];
    const idx = order.map(at);
    for (const [i, re] of order.entries()) expect(idx[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(idx[i - 1]);
    expect(log[idx[1]].hero).toBe('goku');
    expect(sim.game.field?.player.formActive).toBeNull();
    expect(sim.errors).toEqual([]);
  });

  it('the Pride Trooper squad is the one the story bible names for ep 101, and Kahseral calls no reinforcements', async () => {
    const { SQUAD } = await import('../../src/content/chapters/act5/c14_enemies');
    expect(SQUAD.map((uid) => ENEMIES[uid.replace(/1$/, '')]?.name)).toEqual(['Tupper', 'Zoiray', 'Kettle', 'Cocotte']);
    const kahseral = ENEMIES.c14_kahseral.boss;
    expect(kahseral?.minion).toBeUndefined();
    expect(kahseral?.phases.some((p) => p.moves.includes('summon'))).toBe(false);
  });

  it('Hit is thrown out of the ring; Jiren is not: he walks away across the stage', async () => {
    const { ScriptApi } = await import('../../src/game/script');
    const sim = c14Sim('goku');
    const st = sim.game.state;
    sim.start('top_arena_a', 22, 16);
    await settle(sim);
    const walks: Array<[string, number, number]> = [];
    const walk = ScriptApi.prototype.walk;
    ScriptApi.prototype.walk = function (this: InstanceType<typeof ScriptApi>, id: string, x: number, y: number, speed?: number) {
      walks.push([id, x, y]);
      return walk.call(this, id, x, y, speed);
    };
    try {
      await beat(sim, null, 'c14_hitJiren');
    } finally {
      ScriptApi.prototype.walk = walk;
    }
    const grid = sim.game.field?.map.grid ?? [];
    const last = (id: string) => walks.filter((w) => w[0] === id).at(-1);
    const hit = last('c14_hitJ');
    const jiren = last('c14_jiren1');
    expect(hit && grid[hit[2]]?.[hit[1]] === undefined ? 'void' : hit && grid[hit[2]][hit[1]]).toBe('void');
    expect(jiren && grid[jiren[2]]?.[jiren[1]]).not.toBe('void');
    expect(jiren && grid[jiren[2]]?.[jiren[1]]).toBeTruthy();
    expect(st.flag('c14_hitOut')).toBe(true);
    expect(c14Leftovers(sim)).toEqual([]);
  });

  it('the Fireballs hanging back in ep 102 read on the Scouter as they do when they fight for real', async () => {
    const { SCANS } = await import('../../src/content/scans');
    const { enemyMaxHp } = await import('../../src/game/enemy');
    for (const [escort, sprite] of [['c14_brianneEscort', 'ribrianne'], ['c14_rozieEscort', 'c14_rozie']] as const) {
      const e = ENEMIES[escort];
      const sc = SCANS[sprite];
      expect([e.name, enemyMaxHp(e), e.str, e.pow, e.end], escort).toEqual([sc?.name, sc?.hp, sc?.str, sc?.pow, sc?.end]);
    }
    expect(ENEMIES.c14_ribrianne.pow).toBe(ENEMIES.c14_brianneEscort.pow);
  });

  it('a bot that fights with the real damage rules wins every set piece, and none of them is a walkover', async () => {
    const cases: Array<[string, string, 'goku' | 'gohan' | 'piccolo' | 'android17']> = [
      ['top_arena_a', 'c14_pride', 'goku'], ['top_arena_a', 'c14_fireballs', 'goku'], ['top_arena_a', 'c14_dyspoTag', 'android17'],
      ['top_arena_b', 'c14_ribrianne', 'goku'], ['top_arena_b', 'c14_namek', 'android17'], ['top_arena_b', 'c14_gamisalas', 'gohan'],
    ];
    for (const [map, script, active] of cases) {
      for (const seed of [11, 4242]) {
        const sim = await c14Seeded(active, seed);
        sim.start(map, 22, 16);
        await settle(sim);
        const r = await c14FairPlay(sim, script);
        const what = `${script} seed ${seed}: ${JSON.stringify(r)}`;
        expect(r.finished && !r.died, what).toBe(true);
        expect(r.senzu, what).toBeLessThanOrEqual(4);
        // Not a walkover: even a fighter who wins takes real damage.
        expect(r.lost, what).toBeGreaterThanOrEqual(r.hpMax * 0.15);
        expect(sim.errors, what).toEqual([]);
      }
    }
  }, 120000);
});

// ================================================================================================ the Zeno Expo

/** The party a story run brings to the Zeno Expo (Goku L37 in Blue, Gohan benched at L19), three Senzu. */
function expoSim(flags: string[] = []): Sim {
  const sim = freshSim(13, 37);
  const st = sim.game.state;
  const goku = st.char('goku');
  goku.form = 'ssb';
  goku.techs = ['kiBlast', 'kamehameha', 'godKamehameha'];
  goku.charged = true;
  st.join('vegeta', 29);
  st.char('vegeta').form = 'ssb';
  st.join('gohan', 19);
  st.char('gohan').form = 'ssj';
  st.learn('gohan', 'masenko');
  st.join('piccolo', 24);
  st.join('trunks', 35);
  st.data.inv.senzu = 3;
  for (const f of flags) st.set(f);
  return sim;
}

/** Start the Expo from Capsule Corp (Beerus's way back in) and read dialogue until the bout against `uid` is on. */
async function expoIntoFight(sim: Sim, uid: string): Promise<() => boolean> {
  sim.start('cc_yard', 22, 18);
  await settle(sim);
  let finished = false;
  void sim.game.runScript('c13_expo').then(() => { finished = true; });
  await driveUntil(sim, `${uid} bout`, () => midFight(sim) && !!sim.game.field?.enemies.some((e) => e.uid === uid && !e.dead), 60000);
  return () => finished;
}

/** Expo bookkeeping flags (a finished Expo leaves only `c13_expoSeen`). */
const EXPO_FLAGS = ['c13_expoMet', 'c13_expoOpened', 'c13_expoBuu', 'c13_expoGohan', 'c13_expoBergamo', 'c13_expoToppo'];

describe('Chapter 13: the Zeno Expo (eps 78-82)', () => {
  it('plays from the end of Chapter 12 through every bout in the anime\'s order, then the team planning', async () => {
    const sim = expoSim();
    const st = sim.game.state;
    st.data.chapter = 12;
    const goku = st.char('goku');
    const techs = [...goku.techs];
    const log = record(sim);
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    await beat(sim, null, 'c13_start');
    const order = [
      /Grand Priest himself comes/, /Trio de Dangers/, /welcome to the Zeno Expo/, /first match! Majin Buu/, /winner is Majin Buu/,
      /second match! Son Gohan/, /This match is a draw/, /Supreme Kai's Senzu Beans/, /erased\. Along with its gods/,
      /final match! Son Goku/, /enemy of every universe/, /winner of the Zeno Expo: Universe 7/, /I am Toppo/, /Justice\.\.\. CRUSHER/,
      /That is enough!/, /warrior named Jiren/, /shake hands with evil/, /rules of the Tournament of Power/, /ten warriors/,
      /unless you were born with wings/, /forty Earth hours/, /Bulla/,
    ];
    let at = -1;
    for (const re of order) {
      const i = log.findIndex((l, k) => k > at && re.test(l.text));
      expect(i, `${re} after line ${at}`).toBeGreaterThan(at);
      at = i;
    }
    // Universe 9 is met at Zeno's palace, the bouts happen in the World of Void.
    expect(log.find((l) => /Trio de Dangers!/.test(l.text))?.map).toBe('zeno_palace');
    expect(log.find((l) => /first match/.test(l.text))?.map).toBe('c13_expo');
    expect(st.data.chapter).toBe(13);
    expect(st.data.journal.c13_expo).toBe('done');
    expect(st.data.journal.c13_team).toBe('active');
    expect(st.flag('c13_expoSeen')).toBe(true);
    for (const f of EXPO_FLAGS) expect(st.flag(f), f).toBe(false);
    for (const k of ['c13_expoBuuStash', 'c13_expoBuuRage', 'c13_expoBlind', 'c13_expoLavAir']) expect(st.get(k), k).toBeUndefined();
    // Goku is himself again, free to switch, and Gohan was put on the field at the Chapter 13 forced floor.
    expect(st.data.active).toBe('goku');
    expect(st.flag('noSwitch')).toBe(false);
    expect(goku.outfit).toBeUndefined();
    expect(goku.techs).toEqual(techs);
    expect(goku.form).toBe('ssb');
    expect(st.char('gohan').level).toBeGreaterThanOrEqual(39);
    // The Supreme Kai's bag tops the pouch up to three (LoG2's carry limit).
    expect(st.count('senzu')).toBe(3);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.field?.tintOverride).toBeUndefined();
    expect(sim.errors).toEqual([]);
  });

  it('Buu vs. Basil (ep 79): Buu is played over Goku, his rubber body, the crossfire, Danger Doping, then Goku is back', async () => {
    const { RUBBER } = await import('../../src/content/chapters/act5/c13_expo');
    const sim = expoSim(['c13_expoMet', 'c13_expoOpened']);
    const st = sim.game.state;
    const goku = st.char('goku');
    const before = { techs: [...goku.techs], form: goku.form };
    const log = record(sim);
    await expoIntoFight(sim, 'c13_basil1');
    const stats = { str: goku.str, pow: goku.pow };
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(f.def.id).toBe('c13_expo');
    // Both Zenos, the gods and angels of Universes 6, 7 and 9, and the hooded figure of Universe 11 watch from the balcony.
    for (const id of ['c13_zeno', 'c13_zenoF', 'c13_gp', 'c13_beerusX', 'c13_whisX', 'c13_champaX', 'c13_vadosX', 'c13_sidraX', 'c13_rohX', 'c13_mojitoX']) {
      expect(f.npcs.some((n) => n.def.id === id), id).toBe(true);
    }
    expect(f.npcs.find((n) => n.def.id === 'c13_toppoX')?.silhouette).toBe(true);
    // Majin Buu: his sprite and kit over a forced Goku, no Z form.
    expect(st.data.active).toBe('goku');
    expect(st.flag('noSwitch')).toBe(true);
    expect(goku.outfit).toBe('majinBuu');
    expect(f.player.spriteId).toBe('majinBuu');
    expect(goku.techs).toEqual(['kiBlast', 'kamehameha']);
    expect(goku.form).toBeNull();
    expect(f.player.canTransform).toBe(false);
    expect(goku.level).toBeGreaterThanOrEqual(39);
    const basil = c14Foe(sim, 'c13_basil1');
    // Rubber body: once per bout, a beating that leaves Buu low snaps him back together.
    basil.frozen = 100000;
    goku.hp = Math.floor(goku.hpMax * 0.3);
    await stepUntil(sim, () => goku.hp > goku.hpMax * 0.5, 10);
    expect(goku.hp).toBeGreaterThanOrEqual(Math.round(goku.hpMax * RUBBER.to));
    goku.hp = Math.floor(goku.hpMax * 0.3);
    await stepUntil(sim, () => false, 10);
    expect(goku.hp).toBe(Math.floor(goku.hpMax * 0.3));
    // Phase two: the blast through Buu and the crossfire that floors Mr. Satan make him furious.
    basil.frozen = 0;
    const str0 = goku.str;
    basil.hp = Math.floor(basil.maxHp * 0.69);
    await driveUntil(sim, 'Buu\'s anger', () => st.get('c13_expoBuuRage') !== undefined && midFight(sim));
    expect(goku.str).toBe(str0 + 8);
    expect(f.npcs.find((n) => n.def.id === 'c13_satanX')?.scriptPose).toBe('ko');
    for (const re of [/hole clean through Buu's belly/, /Win the match/, /Mind where you send those/, /BUU\.\.\. MAD/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    // The hooded figure speaks without a face or a name: Toppo is not revealed until he jumps into the ring.
    expect(f.npcs.find((n) => n.def.id === 'c13_toppoX')?.silhouette).toBe(true);
    // Phase three (canon): Buu knocks Basil out of the ring, but Universe 7's ring-out rule does not count at the Expo;
    // Basil crawls back in, asks Roh for "that", and the "tonic" pumps him into Danger Doping.
    basil.hp = Math.floor(basil.maxHp * 0.39);
    await driveUntil(sim, 'Danger Doping', () => basil.def.id === 'c13_basilDoped' && midFight(sim));
    expect(basil.spriteId).toBe('c13_basilDoped');
    expect(f.boss?.def.name).toBe('Basil (Danger Doping)');
    expect(basil.def.str).toBeGreaterThan(ENEMIES.c13_basil.str);
    for (const re of [/That's a ring-out!/, /Universe 7's rules do not apply here/, /We want to see more/, /Give me\.\.\. THAT/, /Purely medicinal/, /anything goes/, /Danger Doping!/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    // He fights on from inside the ring.
    expect(f.voidAt(basil.x, basil.y)).toBe(false);
    // Wolfgang Pressure, then Buu's full-power Kamehameha ends it; the drug wears off; Goku gets his own body, kit and
    // stats back before Gohan's bout.
    c14Finish(sim, basil);
    await driveUntil(sim, 'Gohan\'s bout', () => midFight(sim) && st.data.active === 'gohan', 60000);
    for (const re of [/Wolfgang\.\.\. PRESSURE/, /Kaaa\.\.\. meee\.\.\. haaa/, /Danger Doping wears off/, /winner is Majin Buu/, /Buu make you all better/, /as good as new/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    // Buu healed Mr. Satan in the stands.
    expect(f.npcs.find((n) => n.def.id === 'c13_satanX')?.scriptPose ?? null).toBeNull();
    expect(st.flag('c13_expoBuu')).toBe(true);
    expect(goku.outfit).toBeUndefined();
    expect(goku.techs).toEqual(before.techs);
    expect(goku.form).toBe(before.form);
    expect([goku.str, goku.pow]).toEqual([stats.str, stats.pow]);
    expect(st.get('c13_expoBuuRage')).toBeUndefined();
    expect(st.get('c13_expoBuuStash')).toBeUndefined();
    expect(sim.errors).toEqual([]);
  });

  it('Gohan vs. Lavender (ep 80): the mist blinds Gohan, the cues and the Super Saiyan radar, then a double knock-out draw', async () => {
    const { TOXIN, lavenderCloak } = await import('../../src/content/chapters/act5/c13_expo');
    // The cue rules: unseen by default, a Super Saiyan reads him like a radar, and he cannot be heard in the air.
    const quiet = { radar: false, windup: false, listening: false, airborne: false, reveal: 0, flicker: 0 };
    expect(lavenderCloak(quiet)).toBe(1);
    expect(lavenderCloak({ ...quiet, radar: true })).toBe(0);
    expect(lavenderCloak({ ...quiet, windup: true })).toBeLessThan(0.5);
    expect(lavenderCloak({ ...quiet, listening: true })).toBeLessThan(0.5);
    expect(lavenderCloak({ ...quiet, listening: true, airborne: true })).toBe(1);
    expect(lavenderCloak({ ...quiet, reveal: 1 })).toBeLessThanOrEqual(0.25);

    const sim = expoSim(['c13_expoMet', 'c13_expoOpened', 'c13_expoBuu']);
    const st = sim.game.state;
    const gohan = st.char('gohan');
    const log = record(sim);
    await expoIntoFight(sim, 'c13_lavender1');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.data.active).toBe('gohan');
    expect(st.flag('noSwitch')).toBe(true);
    expect(gohan.level).toBeGreaterThanOrEqual(39);
    const lav = c14Foe(sim, 'c13_lavender1');
    expect(lav.cloak).toBe(0);
    expect(f.tintOverride).toBeUndefined();
    // The mist: darkened view, Lavender out of sight.
    lav.hp = Math.floor(lav.maxHp * 0.79);
    await driveUntil(sim, 'the mist', () => st.flag('c13_expoBlind') && midFight(sim));
    expect(log.some((l) => /my eyes/.test(l.text))).toBe(true);
    const blindTint = f.tintOverride;
    expect(blindTint).toBeTruthy();
    lav.frozen = 100000;
    await drive(sim, 12, ['right']);
    expect(lav.cloak).toBeGreaterThanOrEqual(0.6);
    // Standing still, Gohan hears him.
    await drive(sim, TOXIN.listen + 4);
    expect(lav.cloak).toBeLessThan(0.5);
    // The toxin works on its own...
    gohan.hp = gohan.hpMax;
    await stepUntil(sim, () => false, 600);
    const lost = gohan.hpMax - gohan.hp;
    expect(lost).toBeGreaterThan(0);
    // ...three times faster while Super Saiyan reads his ki, and then Lavender has nowhere to hide. The first time,
    // Gohan says so and Whis warns about the poison (once per Expo).
    f.player.formActive = 'ssj';
    f.player.refreshSprite();
    await driveUntil(sim, 'Whis\'s warning', () => log.some((l) => /pumps the poison through him faster/.test(l.text)) && midFight(sim));
    expect(st.flag('c13_expoRadar')).toBe(true);
    gohan.hp = gohan.hpMax;
    await stepUntil(sim, () => false, 600);
    expect(gohan.hpMax - gohan.hp).toBeGreaterThan(lost * 2);
    expect(lav.cloak).toBe(0);
    expect(f.tintOverride).not.toBe(blindTint);
    f.player.formActive = null;
    f.player.refreshSprite();
    // It never knocks him out by itself.
    gohan.hp = 2;
    await stepUntil(sim, () => false, 300);
    expect(gohan.hp).toBe(1);
    gohan.hp = gohan.hpMax;
    // Phase three: Lavender takes to the air, and there are no footsteps left to hear.
    lav.frozen = 0;
    lav.hp = Math.floor(lav.maxHp * 0.49);
    await driveUntil(sim, 'Lavender airborne', () => st.flag('c13_expoLavAir') && midFight(sim));
    lav.frozen = 100000;
    // Past both the listening time and the reveal from the HP drop that started this phase.
    await drive(sim, Math.max(TOXIN.listen, TOXIN.reveal) + 4);
    expect(lav.z).toBeGreaterThan(0);
    expect(lav.cloak).toBeGreaterThanOrEqual(0.6);
    // Canon's ending: the full-nelson slam, both down, a draw; Goku's Senzu Bean; the stakes told to every god.
    st.data.inv.senzu = 0;
    lav.frozen = 0;
    c14Finish(sim, lav);
    await driveUntil(sim, 'Bergamo\'s bout', () => midFight(sim) && !!f.enemies.some((e) => e.uid === 'c13_bergamo1'), 60000);
    for (const re of [/Let the poison take you/, /this close, I can't miss/, /This match is a draw/, /Supreme Kai's Senzu Beans/, /erased\. Along with its gods/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    expect(st.flag('c13_expoGohan')).toBe(true);
    expect(st.flag('c13_expoBlind')).toBe(false);
    expect(f.tintOverride).toBeUndefined();
    expect(st.data.active).toBe('goku');
    expect(st.count('senzu')).toBe(2);
    expect(sim.errors).toEqual([]);
  });

  it('Goku vs. Bergamo (ep 81): he grows in two visible steps as he absorbs blows; Kaio-ken ends it; Toppo\'s bout is a draw', async () => {
    const sim = expoSim(['c13_expoMet', 'c13_expoOpened', 'c13_expoBuu', 'c13_expoGohan']);
    const st = sim.game.state;
    const log = record(sim);
    const done = await expoIntoFight(sim, 'c13_bergamo1');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const berg = c14Foe(sim, 'c13_bergamo1');
    expect(berg.def.id).toBe('c13_bergamo');
    const w0 = berg.frame().width;
    const h0 = berg.body().h;
    // First step at 80%: half again his size, harder hits.
    berg.hp = Math.floor(berg.maxHp * 0.79);
    await driveUntil(sim, 'Bergamo grows', () => berg.def.id === 'c13_bergamoL' && midFight(sim));
    expect(berg.frame().width).toBe(Math.round(w0 * 1.5));
    expect(berg.body().h).toBeGreaterThan(h0);
    expect(berg.def.str).toBeGreaterThan(ENEMIES.c13_bergamo.str);
    expect(f.boss?.def.name).toBe('Bergamo (Grown)');
    expect(f.col.blocked(berg.box())).toBe(false);
    // Second step at 55%: a giant, the strongest and the slowest.
    berg.hp = Math.floor(berg.maxHp * 0.54);
    await driveUntil(sim, 'Bergamo is a giant', () => berg.def.id === 'c13_bergamoXL' && midFight(sim));
    expect(berg.frame().width).toBe(w0 * 2);
    expect(berg.def.str).toBeGreaterThan(ENEMIES.c13_bergamoL.str);
    expect(berg.def.speed).toBeLessThan(ENEMIES.c13_bergamo.speed);
    expect(f.col.blocked(berg.box())).toBe(false);
    for (const re of [/limitless/, /blind spots/]) expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    // The finish: Blue Kaio-ken Kamehameha against the Wolfgang Penetrator, a knock-out, then Toppo jumps down uninvited.
    c14Finish(sim, berg);
    await driveUntil(sim, 'Toppo\'s bout', () => midFight(sim) && !!f.enemies.some((e) => e.uid === 'c13_toppo1' && !e.dead), 60000);
    for (const re of [/Kaio-ken/, /Wolfgang\.\.\. PENETRATOR/, /winner of the Zeno Expo/, /Justice\.\.\. TORNADO/, /lasts in my grip/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    expect(st.flag('c13_expoBergamo')).toBe(true);
    expect(f.npcs.find((n) => n.def.id === 'c13_bergamoX')?.frame().width).toBe(w0);
    // Toppo: Goku in Blue (he broke the bear hug with it), a short bout on the Grand Priest's clock.
    expect(f.player.formActive).toBe('ssb');
    expect(f.timer?.label).toBe('MATCH');
    c14Foe(sim, 'c13_toppo1').frozen = 1000000;
    await driveUntil(sim, 'the Expo ends', done, 60 * 60 * 2);
    // The Grand Priest stops it as Goku charges a Kamehameha; then the tournament's rules (ep 82).
    for (const re of [/proud uniform of the Pride Troopers/, /go all out too! Kaio-ken/, /Haaa\.\.\. meee/, /That is enough!/, /warrior named Jiren/, /shake hands with evil/, /No killing\. No weapons/, /ten warriors/, /Bulla/]) {
      expect(log.some((l) => re.test(l.text)), String(re)).toBe(true);
    }
    expect(st.flag('c13_expoSeen')).toBe(true);
    expect(st.data.journal.c13_expo).toBe('done');
    expect(st.data.journal.c13_team).toBe('active');
    for (const fl of EXPO_FLAGS) expect(st.flag(fl), fl).toBe(false);
    expect(st.flag('noSwitch')).toBe(false);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.field?.player.formActive).toBeNull();
    expect(sim.errors).toEqual([]);
  });

  it('a knock-out at the Expo is never a Game Over: Zeno wants an encore, and the Grand Priest stops Toppo\'s bout', async () => {
    const sim = expoSim(['c13_expoMet', 'c13_expoOpened']);
    const st = sim.game.state;
    const goku = st.char('goku');
    const log = record(sim);
    await expoIntoFight(sim, 'c13_basil1');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const first = c14Foe(sim, 'c13_basil1');
    first.hp = Math.floor(first.maxHp * 0.8);
    f.player.inv = 0;
    goku.hp = 1;
    f.damagePlayer(500, 1, f.player.x + 8, f.player.y);
    await driveUntil(sim, 'the encore', () => log.some((l) => /Again! Again!/.test(l.text)) && midFight(sim));
    const second = c14Foe(sim, 'c13_basil1');
    expect(second).not.toBe(first);
    expect(second.hp).toBe(second.maxHp);
    expect(second.def.id).toBe('c13_basil');
    expect(goku.hp).toBe(goku.hpMax);
    expect(goku.outfit).toBe('majinBuu');
    expect(sim.game.scenes.top?.constructor.name).not.toMatch(/GameOver/);

    // Toppo knocks Goku down: the Grand Priest calls it a draw and the Expo carries on.
    const sim2 = expoSim(['c13_expoMet', 'c13_expoOpened', 'c13_expoBuu', 'c13_expoGohan', 'c13_expoBergamo']);
    const st2 = sim2.game.state;
    const log2 = record(sim2);
    const done = await expoIntoFight(sim2, 'c13_toppo1');
    const f2 = sim2.game.field;
    if (!f2) throw new Error('no field');
    // A resumed Expo seats Goku on the balcony first: he must be down in the ring, within reach of Toppo.
    const toppo = c14Foe(sim2, 'c13_toppo1');
    expect(Math.floor((f2.player.y - 14) / 16), 'Goku in the ring').toBeGreaterThanOrEqual(8);
    expect(f2.voidAt(f2.player.x, f2.player.y)).toBe(false);
    expect(Math.hypot(toppo.x - f2.player.x, toppo.y - f2.player.y)).toBeLessThan(16 * 8);
    f2.player.inv = 0;
    st2.char('goku').hp = 1;
    f2.damagePlayer(500, 1, f2.player.x + 8, f2.player.y);
    await driveUntil(sim2, 'the Expo ends', done, 60000);
    expect(log2.some((l) => /That is enough!/.test(l.text))).toBe(true);
    expect(st2.flag('c13_expoSeen')).toBe(true);
    expect(st2.char('goku').hp).toBe(st2.char('goku').hpMax);
    expect(sim.errors).toEqual([]);
    expect(sim2.errors).toEqual([]);
  });

  it('the Expo\'s new faces have scouter readings, Bergamo\'s growth steps up in size and power, and Buu earns Goku no EXP', async () => {
    const { scanNpc, GENERIC_SCAN_KEY } = await import('../../src/content/scans');
    const { scaledSprite } = await import('../../src/content/chapters/act5/c13_expo');
    for (const id of ['c13_roh', 'c13_sidra', 'c13_basilDoped', 'basil', 'lavender', 'bergamo']) {
      expect(scanNpc(id).id, id).not.toBe(`npc:${GENERIC_SCAN_KEY}`);
      expect(portrait(id), id).toBeTruthy();
    }
    expect(scanNpc('c13_basilDoped').id).toBe('npc:basil');
    // Growth: one fight (shared phases and end), each step stronger and slower than the last.
    const steps = ['c13_bergamo', 'c13_bergamoL', 'c13_bergamoXL'].map((id) => ENEMIES[id]);
    for (const e of steps) expect(e.boss).toBe(steps[0].boss);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].str, steps[i].id).toBeGreaterThan(steps[i - 1].str);
      expect(steps[i].speed, steps[i].id).toBeLessThan(steps[i - 1].speed);
      expect(steps[i].hp).toBe(steps[0].hp);
    }
    expect(ENEMIES.c13_basilDoped.boss).toBe(ENEMIES.c13_basil.boss);
    const base = scaledSprite('bergamo', 1).idle.down;
    expect(scaledSprite('bergamo', 2).idle.down.width).toBe(base.width * 2);
    expect(scaledSprite('bergamo', 2).idle.down.height).toBe(base.height * 2);
    // Buu's bout pays nothing: Goku only lent him his stats. The others pay like Chapter 13's bosses.
    expect(ENEMIES.c13_basil.exp).toBe(0);
    expect(ENEMIES.c13_basilDoped.exp).toBe(0);
    for (const id of ['c13_lavender', 'c13_bergamo']) expect(ENEMIES[id].exp, id).toBeGreaterThanOrEqual(80000);
    expect(QUESTS.c13_expo?.star).toBe('gold');
    expect(SPOTS[QUESTS.c13_expo?.region ?? '']).toBeTruthy();
  });
});

// ============================================================================================ Chapter 14, eps 103-107

/** One dialogue line with the look the hero had on the field when it was shown (a guest costume shows here). */
interface Seen {
  text: string;
  hero: string;
  look: string;
}

/** Record every dialogue line with the active character and the player's sprite at that moment. */
function recordLooks(sim: Sim): Seen[] {
  const log: Seen[] = [];
  const g = sim.game;
  const orig = g.say.bind(g);
  g.say = (lines) => {
    for (const l of lines) log.push({ text: l.text, hero: g.state.data.active, look: g.field?.player.spriteId ?? '' });
    return orig(lines);
  };
  return log;
}

/** A mid-tournament save for the veterans' episodes: Goku at the level cap (no level-up muddles a stat check), in Blue. */
function c14Veteran(): Sim {
  const sim = c14Sim('goku');
  const goku = sim.game.state.char('goku');
  sim.game.state.join('goku', 50);
  goku.form = 'ssb';
  goku.techs = ['kiBlast', 'kamehameha', 'godKamehameha', 'spiritBomb'];
  goku.selected = 2;
  return sim;
}

/** Leave Goku hurt and low on ki right before a guest episode (the test sim refills HP while the player has control). */
function c14Worn(sim: Sim): void {
  const goku = sim.game.state.char('goku');
  goku.hp = Math.floor(goku.hpMax * 0.6);
  goku.ep = Math.floor(goku.epMax * 0.5);
}

/** A set piece started by `c14Run`: whether it has finished, and Goku's state the moment it did. */
interface C14Episode {
  done: () => boolean;
  /** Goku when the script ended (before the test's own driving refills HP). */
  after: () => ReturnType<typeof gokuSelf> | null;
}

/**
 * Start a set piece on the stage the sim stands on (no map restart, so a test can set the hero up right before it),
 * then read dialogue until its fight is on.
 */
async function c14Run(sim: Sim, script: string): Promise<C14Episode> {
  const { GUEST_STASH } = await import('../../src/content/chapters/act5/c14_guests');
  let finished = false;
  let after: ReturnType<typeof gokuSelf> | null = null;
  // Until the guest costume is on, nothing may refill the hero (the sim and drive() top HP up in their own turns).
  sim.fair = true;
  void sim.game.runScript(script).then(() => { finished = true; after = gokuSelf(sim); });
  for (let i = 0; i < 3000 && sim.game.state.get(GUEST_STASH) === undefined; i++) await sim.tick(1);
  sim.fair = false;
  await driveUntil(sim, `${script} fight`, () => midFight(sim));
  return { done: () => finished, after: () => after };
}

/** What Goku must get back when a guest costume comes off. */
function gokuSelf(sim: Sim): { hp: number; ep: number; form: string | null; techs: string[]; selected: number; outfit: string | undefined } {
  const c = sim.game.state.char('goku');
  return { hp: c.hp, ep: c.ep, form: c.form, techs: [...c.techs], selected: c.selected, outfit: c.outfit };
}

describe('Chapter 14, the middle of the west ring (eps 103-107)', () => {
  it('stage A plays Obni, Roshi, the snipers and Frost\'s trap in anime order, each with the fighter canon gives it', async () => {
    const { GUEST_STASH } = await import('../../src/content/chapters/act5/c14_guests');
    const sim = freshSim(13, 45);
    const st = sim.game.state;
    const log = recordLooks(sim);
    const at = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    await beat(sim, null, 'c14_start');
    const before = gokuSelf(sim);
    await beat(sim, null, 'act5_beerus_talk');
    expect(st.flag('c14_stageA')).toBe(true);
    const order = [
      /Kakunsa has been eliminated/, /Only the real Obni casts a shadow/, /A cross-counter!/, /throws Obni out of the ring/, /a locket/,
      /Zeno erases Universe 10/, /A team-up with Hit/,
      /Universe 4 has been waiting for exactly that/, /Caway leaps off the stage/, /Evil Containment Wave\.\.\. MAFUBA!/, /That was neat!/,
      /Caway and Dercori have been eliminated/, /Master Roshi swells to Max Power/,
      /Ganos is blasted off the stage/, /His heart has stopped/, /still in the tournament\. Barely/, /always the good student, Tien/,
      /Reflection!/, /MULTI-FORM!/, /follow his shots back to the nest/, /fires straight down at the stage/, /Tien drags Harmira off the stage/,
      /Galick Gun blasts Prum/, /Not twice, old man/, /sucks Vegeta into Master Roshi's jar/,
      /Master Roshi frees Vegeta from Frost's trap/, /Master Roshi steps off the stage/, /Frost has been eliminated by Frieza/,
    ];
    const idx = order.map(at);
    for (const [i, re] of order.entries()) expect(idx[i], String(re)).toBeGreaterThan(-1);
    for (let i = 1; i < idx.length; i++) expect(idx[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(idx[i - 1]);
    // The fighters: Gohan for Obni; Master Roshi and Tien as guests worn over Goku.
    expect(log[at(/Only the real Obni casts a shadow/)].hero).toBe('gohan');
    expect(log[at(/Two lovely young ladies/)]).toMatchObject({ hero: 'goku', look: 'roshi' });
    expect(log[at(/Big muscles won't save you/)]).toMatchObject({ hero: 'goku', look: 'c14_roshiMax' });
    expect(log[at(/Rest - I'll keep watch/)]).toMatchObject({ hero: 'goku', look: 'tien' });
    expect(log[at(/Give that back!/)]).toMatchObject({ hero: 'goku', look: 'roshi' });
    expect(log[at(/Frieza\. You and I are the same/)].hero).toBe('frieza');
    // Magetta goes out either way: thrown out by the freed Vegeta, or already knocked out in the fight.
    expect(at(/Vegeta blasts Magetta|Magetta already out of the ring/)).toBeGreaterThan(at(/Master Roshi frees Vegeta/));
    // Universe 7's count goes down with each of its own.
    expect(at(/nine fighters remain/)).toBeLessThan(at(/eight fighters remain/));
    expect(at(/eight fighters remain/)).toBeLessThan(at(/seven fighters remain/));
    for (const f of ['c14_obniDone', 'c14_roshiDone', 'c14_snipersDone', 'c14_frostTrapDone']) expect(st.flag(f), f).toBe(true);
    for (const q of ['c14_epObni', 'c14_epRoshi', 'c14_epSnipers', 'c14_epFrostTrap']) expect(st.data.journal[q], q).toBe('done');
    // Goku is himself again: no costume, his own Z form, every technique he had (plus the Spirit Bomb from Jiren).
    const goku = st.char('goku');
    expect(goku.outfit).toBeUndefined();
    expect(st.get(GUEST_STASH)).toBeUndefined();
    expect(goku.form).toBe(before.form);
    expect(goku.techs).toEqual(expect.arrayContaining(before.techs));
    expect(goku.techs).toContain('spiritBomb');
    expect(c14Leftovers(sim)).toEqual([]);
    expect(st.flag('act5_busy') || st.flag('noSwitch')).toBe(false);
    expect(sim.game.field?.player.hidden).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('Obni (ep 103): only the real Obni casts a shadow; afterimages vanish at a touch or fade by themselves; a cross-counter and a Kamehameha throw him out', async () => {
    const { MIRAGE } = await import('../../src/content/chapters/act5/c14_obni');
    const { OBNI_IMAGE } = await import('../../src/content/chapters/act5/c14_enemies');
    const sim = c14Sim('android17');
    const st = sim.game.state;
    const log = record(sim);
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_obni');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.data.active).toBe('gohan');
    const obni = c14Foe(sim, 'c14_obni1');
    // The void cannot take him mid-fight: canon's finish is the scripted end.
    expect(f.canRingOut(obni)).toBe(false);
    const images = () => f.enemies.filter((e) => e.def.id === OBNI_IMAGE && !e.dead && e.state !== 'dying');
    await driveUntil(sim, 'afterimages', () => images().length >= 2, 20000);
    await drive(sim, 2);
    const [first, ...rest] = images();
    // Faint, and too faint to cast a shadow (Enemy.drawShadow); the real Obni is solid.
    expect(first.cloak).toBe(MIRAGE.cloak);
    expect(MIRAGE.cloak).toBeGreaterThan(0.5);
    expect(obni.cloak).toBe(0);
    // They run a circle around the hero.
    const p = f.player;
    await drive(sim, 60);
    for (const e of rest) if (!e.dead) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(MIRAGE.radius + 24);
    // One touch and an afterimage is gone, for no EXP and no drop; the others fade on their own.
    const exp0 = st.char('gohan').exp;
    f.applyDamage(first, 30, 1, { x: 0, y: 0 }, 0, false);
    expect(first.dead || first.state === 'dying').toBe(true);
    expect(st.char('gohan').exp).toBe(exp0);
    await drive(sim, MIRAGE.life);
    for (const e of rest) expect(e.dead || e.state === 'dying', 'faded').toBe(true);
    c14Finish(sim, obni);
    await driveUntil(sim, 'the cross-counter', done, 60000);
    const i = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const end = [/lets the punch come/, /A cross-counter!/, /Ka\.\.\. me\.\.\. ha\.\.\. me/, /throws Obni out of the ring/, /a locket/, /Zeno erases Universe 10\.\.\. and the locket fades/];
    for (let k = 0; k < end.length; k++) expect(i(end[k]), String(end[k])).toBeGreaterThan(k ? i(end[k - 1]) : -1);
    expect(st.flag('c14_obniDone')).toBe(true);
    expect(st.data.journal.c14_epObni).toBe('done');
    expect(images()).toEqual([]);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Master Roshi (ep 105) is worn over Goku with his own look and moves; Caway and Dercori go canon\'s way; Max Power comes and goes exactly; Ganos turns into a bird', async () => {
    const { GUEST_STASH, ROSHI, takeOffGuest } = await import('../../src/content/chapters/act5/c14_guests');
    const { ScriptApi } = await import('../../src/game/script');
    const sim = c14Veteran();
    const st = sim.game.state;
    const goku = st.char('goku');
    const base = [goku.str, goku.pow, goku.end];
    const log = record(sim);
    sim.start('top_arena_a', 22, 16);
    await settle(sim);
    c14Worn(sim);
    const self = gokuSelf(sim);
    const { done } = await c14Run(sim, 'c14_roshi');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.data.active).toBe('goku');
    expect(goku.outfit).toBe('roshi');
    expect(f.player.spriteId).toBe('roshi');
    expect(goku.techs).toEqual(ROSHI.techs);
    expect(goku.form).toBeNull();
    expect(f.player.canTransform).toBe(false);
    // A fresh fighter steps into the relay.
    expect(goku.hp).toBe(goku.hpMax);
    expect(typeof st.get(GUEST_STASH)).toBe('string');
    // Caway and Dercori first. Worn down, a fighter stops dazed on the stage (no knockout, no ring-out) and drops out
    // of the fight, which goes on until both are.
    const caway = c14Foe(sim, 'c14_caway1');
    c14Finish(sim, caway);
    await drive(sim, 2);
    expect([caway.dead, caway.def.invulnerable, caway.puppet, f.canRingOut(caway)]).toEqual([false, true, true, false]);
    expect(ENEMIES.c14_caway.invulnerable).toBeUndefined();
    expect(midFight(sim) && f.enemies.some((e) => e.uid === 'c14_dercori1' && !e.ended)).toBe(true);
    c14Finish(sim, c14Foe(sim, 'c14_dercori1'));
    await driveUntil(sim, 'Ganos', () => midFight(sim) && f.enemies.some((e) => e.uid === 'c14_ganos1'));
    // Canon's finishes: Caway jumps off the stage herself, Dercori is sealed in a jar (Zeno allows it).
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const pair = [/bats Caway's blast apart/, /Caway leaps off the stage/, /Evil Containment Wave\.\.\. MAFUBA!/, /into the little jar/, /That was neat!/, /Caway and Dercori have been eliminated/];
    for (let k = 0; k < pair.length; k++) expect(said(pair[k]), String(pair[k])).toBeGreaterThan(k ? said(pair[k - 1]) : -1);
    expect(f.enemies.some((e) => /^c14_(caway|dercori)1$/.test(e.uid ?? ''))).toBe(false);
    // Max Power: his costume and a form-sized bonus.
    const bonus = ROSHI.power?.bonus ?? 0;
    expect(bonus).toBeGreaterThan(0);
    expect(goku.outfit).toBe('c14_roshiMax');
    expect([goku.str, goku.pow, goku.end]).toEqual(base.map((v) => v + bonus));
    const ganos = c14Foe(sim, 'c14_ganos1');
    expect(ganos.spriteId).toBe('c14_ganos');
    ganos.hp = Math.floor(ganos.maxHp * 0.6);
    await driveUntil(sim, 'the bird of prey', () => ganos.spriteId === 'c14_ganosBird');
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    c14Finish(sim, ganos);
    await driveUntil(sim, 'Roshi pulls through', done, 60000);
    const i = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    expect(i(/Ka\.\.\. me\.\.\. ha\.\.\. me/)).toBeGreaterThan(-1);
    expect(i(/Ganos is blasted off the stage/)).toBeGreaterThan(i(/Ka\.\.\. me\.\.\. ha\.\.\. me/));
    expect(i(/His heart has stopped/)).toBeGreaterThan(i(/Ganos is blasted off the stage/));
    expect(i(/still in the tournament\. Barely/)).toBeGreaterThan(i(/His heart has stopped/));
    expect(st.flag('c14_roshiDone')).toBe(true);
    expect(st.data.journal.c14_epRoshi).toBe('done');
    // Max Power is spent; the costume stays on until the relay hands over (Tien is next).
    expect(goku.outfit).toBe('roshi');
    expect([goku.str, goku.pow, goku.end]).toEqual(base);
    // Taking the costume off gives Goku back exactly what he had.
    takeOffGuest(new ScriptApi(sim.game, {}));
    expect(gokuSelf(sim)).toEqual(self);
    expect(st.get(GUEST_STASH)).toBeUndefined();
    expect(f.player.spriteId).not.toBe('roshi');
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Master Roshi (ep 105): a Universe 4 fighter rung out before she is worn down is simply gone; the scene finishes the other', async () => {
    const sim = c14Veteran();
    const log = record(sim);
    sim.start('top_arena_a', 22, 16);
    await settle(sim);
    const { done } = await c14Run(sim, 'c14_roshi');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const caway = c14Foe(sim, 'c14_caway1');
    expect(f.canRingOut(caway)).toBe(true);
    f.ringOut(caway);
    expect(caway.dead || caway.state === 'dying').toBe(true);
    c14Finish(sim, c14Foe(sim, 'c14_dercori1'));
    await driveUntil(sim, 'Ganos', () => midFight(sim) && f.enemies.some((e) => e.uid === 'c14_ganos1'));
    expect(log.some((l) => /Caway leaps off the stage/.test(l.text))).toBe(false);
    expect(log.some((l) => /That was neat!/.test(l.text))).toBe(true);
    expect(log.some((l) => /Caway and Dercori have been eliminated/.test(l.text))).toBe(true);
    c14Finish(sim, c14Foe(sim, 'c14_ganos1'));
    await driveUntil(sim, 'Roshi pulls through', done, 60000);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('Tien and the snipers (ep 106): Harmira snipes from a hidden nest through Prum\'s mirror; Tien finds him, his copies drag him down, Vegeta throws Prum out', async () => {
    const { SNIPE, SNIPER_FOUND } = await import('../../src/content/chapters/act5/c14_veterans');
    const { SNIPER_NEST } = await import('../../src/content/chapters/act5/c14_enemies');
    const { TIEN } = await import('../../src/content/chapters/act5/c14_guests');
    const { Shot } = await import('../../src/game/projectiles');
    const sim = c14Veteran();
    const st = sim.game.state;
    const log = record(sim);
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_snipers');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.char('goku').outfit).toBe('tien');
    expect(st.char('goku').techs).toEqual(TIEN.techs);
    expect(f.npcs.some((n) => n.def.id === 'c14_roshiS')).toBe(true);
    const har = c14Foe(sim, 'c14_harmira1');
    const prum = c14Foe(sim, 'c14_prum1');
    expect(f.boss).toBe(har);
    // Prum is a mirror: fists and ki pass him by, and the void cannot take him (Vegeta throws him out later).
    expect(prum.def.invulnerable).toBe(true);
    expect(f.canRingOut(prum)).toBe(false);
    // Harmira lies hidden in his nest across the ring, too faint to cast a shadow, on ground the hero can walk to.
    const p = f.player;
    const nest = { x: har.x, y: har.y };
    expect(Math.hypot(har.x - p.x, har.y - p.y)).toBeGreaterThan(SNIPE.near * 1.5);
    expect(har.cloak).toBeGreaterThan(0.5);
    const seen = reachable(sim, Math.floor(p.x / 16), Math.floor((p.y - 14) / 16));
    expect(near(seen, Math.floor(har.x / 16), Math.floor((har.y - 14) / 16))).toBe(true);
    expect(st.flag(SNIPER_FOUND)).toBe(false);
    // His scope glints (he shows for a moment), he fires at Prum, and Prum's mirror sends the shot on at the hero.
    const fired: Array<{ x: number; y: number; vx: number; vy: number; color: string }> = [];
    const spawn = f.spawnShot.bind(f);
    f.spawnShot = (sh) => { if (sh.owner === 'enemy') fired.push({ x: sh.x, y: sh.y, vx: sh.vx, vy: sh.vy, color: sh.color }); spawn(sh); };
    let glimpsed = false;
    for (let t = 0; t < SNIPE.every * 2 + 40; t++) {
      await drive(sim, 1);
      if (har.cloak < 0.5) glimpsed = true;
    }
    expect(glimpsed).toBe(true);
    const fromNest = fired.find((sh) => Math.hypot(sh.x - har.x, sh.y - har.y) < 16);
    expect(fromNest, 'a shot from the nest').toBeTruthy();
    // Aimed at Prum, not at the hero.
    if (fromNest) expect(Math.sign(fromNest.vx || 0)).toBe(Math.sign(prum.x - har.x) || 0);
    const bounced = fired.filter((sh) => Math.hypot(sh.x - prum.x, sh.y - prum.y) < 16 && sh.color === SNIPE.silver);
    expect(bounced.length, 'a shot bounced off Prum').toBeGreaterThan(0);
    // The hero's own ki blast comes straight back off the mirror.
    const before = fired.length;
    f.spawnShot(new Shot('player', 'shot', prum.x - 4, prum.y, { x: 1, y: 0 }, 2, 1, '#f8f0a0', 60, 40));
    await drive(sim, 2);
    expect(fired.slice(before).some((sh) => sh.color === SNIPE.silver && Math.hypot(sh.x - prum.x, sh.y - prum.y) < 16)).toBe(true);
    f.spawnShot = spawn;
    // He has not left his nest; coming close finds him and the cloak drops for good.
    expect(Math.hypot(har.x - nest.x, har.y - nest.y)).toBeLessThan(4);
    const [nx, ny] = [Math.floor(har.x / 16), Math.floor((har.y - 14) / 16)];
    put(sim, nx, ny + 2, 'up');
    await drive(sim, 3);
    expect(st.flag(SNIPER_FOUND)).toBe(true);
    expect(har.cloak).toBe(0);
    // The first blows knock him out of his nest: he fights head-on.
    for (let k = 0; k < 40 && har.hp > har.maxHp * SNIPER_NEST; k++) f.applyDamage(har, 60, 1, { x: 0, y: 0 }, 0, false);
    await driveUntil(sim, 'Harmira leaves his nest', () => log.some((l) => /up close, I don't need a mirror/.test(l.text)));
    c14Finish(sim, har);
    await driveUntil(sim, 'Tien takes Harmira with him', done, 60000);
    const i = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const end = [/You found my nest/, /fires straight down at the stage/, /seize Harmira/, /Tien drags Harmira off the stage.*eight fighters remain/, /Galick Gun blasts Prum/, /Well done, my boy/];
    for (let k = 0; k < end.length; k++) expect(i(end[k]), String(end[k])).toBeGreaterThan(k ? i(end[k - 1]) : -1);
    expect(st.flag('c14_snipersDone')).toBe(true);
    expect(st.data.journal.c14_epSnipers).toBe('done');
    // Master Roshi rests where he was: the next episode picks him up.
    expect(c14Leftovers(sim)).toEqual(['c14_roshiS']);
    expect(sim.errors).toEqual([]);
  });

  it('Frost\'s trap (ep 107): Roshi makes Frost drop the jar, Vegeta gets out and throws Magetta out, Roshi retires; Frost stays in for Frieza', async () => {
    const { GUEST_STASH } = await import('../../src/content/chapters/act5/c14_guests');
    const sim = c14Veteran();
    const st = sim.game.state;
    const log = record(sim);
    sim.start('top_arena_a', 22, 16);
    await settle(sim);
    c14Worn(sim);
    const self = gokuSelf(sim);
    const { done, after } = await c14Run(sim, 'c14_frostTrap');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(st.char('goku').outfit).toBe('roshi');
    const frost = c14Foe(sim, 'c14_frostJar1');
    // Frieza eliminates Frost in ep 108: no ring-out here.
    expect(f.canRingOut(frost)).toBe(false);
    // Magetta: fists do half; worn down, he stops dazed for Vegeta to throw out, and the fight with Frost goes on.
    const mag = c14Foe(sim, 'c14_magetta1');
    expect(mag.def.resMelee).toBeLessThan(1);
    c14Finish(sim, mag);
    await drive(sim, 2);
    expect([mag.dead, mag.def.invulnerable, mag.puppet]).toEqual([false, true, true]);
    expect(midFight(sim)).toBe(true);
    c14Finish(sim, frost);
    await driveUntil(sim, 'Roshi retires', done, 60000);
    const i = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    const order = [
      /Evil Containment Wave! MAFUBA!/, /Not twice, old man/, /once more! MAFUBA!/, /sucks Vegeta into Master Roshi's jar/, /smashes it open/,
      /Master Roshi frees Vegeta from Frost's trap/, /prince of all Saiyans into a JAR/, /Vegeta blasts Magetta/, /Another time, Saiyan/,
      /Master Roshi steps off the stage/,
    ];
    for (let k = 0; k < order.length; k++) expect(i(order[k]), String(order[k])).toBeGreaterThan(k ? i(order[k - 1]) : -1);
    expect(st.flag('c14_frostTrapDone')).toBe(true);
    expect(st.data.journal.c14_epFrostTrap).toBe('done');
    // Out of costume for whoever plays next: Goku exactly as he was.
    expect(after()).toEqual(self);
    expect(st.get(GUEST_STASH)).toBeUndefined();
    expect(f.player.hidden).toBe(false);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('a west-ring relay restarted in the middle of a guest episode gives Goku his own look, moves and Z form back first', async () => {
    const { GUEST_STASH } = await import('../../src/content/chapters/act5/c14_guests');
    const sim = c14Veteran();
    const st = sim.game.state;
    const self = gokuSelf(sim);
    await c14IntoFight(sim, 'top_arena_a', 'c14_roshi');
    expect(st.char('goku').outfit).toBe('roshi');
    // Leave mid-fight (a reload stands in for every way out): the relay restarts from the top on the way back in.
    st.set('c14_opened');
    st.clear('fc_topQuiet');
    reload(sim);
    await driveUntil(sim, 'stage A restarted', () => midFight(sim) && st.data.active === 'gohan', 60000);
    const goku = gokuSelf(sim);
    expect(goku.outfit).toBeUndefined();
    expect(goku.form).toBe(self.form);
    expect(goku.techs).toEqual(self.techs);
    expect(goku.selected).toBe(self.selected);
    expect(st.get(GUEST_STASH)).toBeUndefined();
    expect(sim.errors).toEqual([]);
  });

  it('Kakunsa (ep 102) fights as Sanka Ku until she transforms, and her partners carry their everyday names too', async () => {
    const sim = c14Sim('goku');
    const st = sim.game.state;
    const done = await c14IntoFight(sim, 'top_arena_a', 'c14_fireballs');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const kak = c14Foe(sim, 'c14_kakunsa1');
    const names = () => [c14Foe(sim, 'c14_brianneE').def.name, c14Foe(sim, 'c14_sankaE').def.name];
    // The boss bar (hud.ts) shows the fighting enemy's name.
    expect(f.boss).toBe(kak);
    expect(f.boss?.def.name).toBe('Sanka Ku');
    expect(kak.spriteId).toBe('c14_suroas');
    expect(names()).toEqual(['Brianne', 'Su Roas']);
    // Only the name is her everyday one: HP, stats and moves are Kakunsa's.
    const real = ENEMIES.c14_kakunsa;
    expect(real.name).toBe('Kakunsa');
    expect([kak.def.hp, kak.def.str, kak.def.pow, kak.def.end, kak.def.boss]).toEqual([real.hp, real.str, real.pow, real.end, real.boss]);
    kak.hp = Math.floor(kak.maxHp * 0.8);
    await driveUntil(sim, 'the transformation', () => st.flag('c14_fireballsUp'));
    expect(f.boss?.def.name).toBe('Kakunsa');
    expect(kak.def).toBe(real);
    expect(kak.spriteId).toBe('c14_kakunsa');
    expect(names()).toEqual(['Ribrianne', 'Rozie']);
    await driveUntil(sim, 'fight resumes', () => midFight(sim));
    c14Finish(sim, kak);
    await driveUntil(sim, 'Kakunsa thrown out', done, 60000);
    expect(c14Leftovers(sim)).toEqual([]);
    expect(sim.errors).toEqual([]);
  });

  it('every new sprite has a Scouter entry, and each fighter reads like its bestiary entry', async () => {
    const { SCANS, scanKey } = await import('../../src/content/scans');
    const { enemyMaxHp } = await import('../../src/game/enemy');
    for (const id of ['c14_obni', 'c14_caway', 'c14_dercori', 'c14_ganos', 'c14_ganosBird', 'c14_prum', 'c14_harmira', 'c14_roshiMax']) {
      expect(CAST[id], id).toBeTruthy();
      const key = scanKey(id);
      expect(key, id).toBeTruthy();
      expect(SCANS[key ?? '']?.desc.length, id).toBeGreaterThan(20);
    }
    // Max Power Roshi files under Master Roshi; Obni's afterimages read as Obni.
    expect(scanKey('c14_roshiMax')).toBe('roshi');
    expect(ENEMIES.c14_obniImage.name).toBe(ENEMIES.c14_obni.name);
    const looks: Array<[string, string]> = [
      ['c14_obni', 'c14_obni'], ['c14_caway', 'c14_caway'], ['c14_dercori', 'c14_dercori'], ['c14_ganos', 'c14_ganos'], ['c14_ganos', 'c14_ganosBird'],
      ['c14_prum', 'c14_prum'], ['c14_harmira', 'c14_harmira'],
    ];
    for (const [id, sprite] of looks) {
      const e = ENEMIES[id];
      const sc = SCANS[sprite];
      expect([sc?.name, sc?.hp, sc?.str, sc?.pow, sc?.end], `${id} as ${sprite}`).toEqual([e.name, enemyMaxHp(e), e.str, e.pow, e.end]);
    }
  });

  it('the new bosses are fair for the fighter canon puts in (LoG2 boss hit ratios), and none outranks Kefla', async () => {
    const { CHARACTERS, FORMS } = await import('../../src/content/characters');
    const { CHAPTER_MIN_LEVEL, FORCED_LEVEL_GAP } = await import('../../src/content/chapters/common');
    const { damage, ENEMY_POWER, MELEE_POWER, enemyPowerScale } = await import('../../src/game/leveling');
    const { ROSHI } = await import('../../src/content/chapters/act5/c14_guests');
    const avg = (power: number, mult: number, stat: number, end: number): number => {
      let sum = 0;
      for (let r = 0; r < 26; r++) sum += damage({ power, mult, stat, end, res: 1, crit: false, r26: r });
      return sum / 26;
    };
    const statsAt = (id: 'goku' | 'gohan', lv: number) => {
      const d = CHARACTERS[id];
      let hp = d.base.hp;
      for (let l = 1; l < lv; l++) hp += Math.floor((hp * (3604 + 655)) / 65536);
      const g = (k: 'str' | 'end') => d.base[k] + Math.floor(((lv - 1) * (d.growth[k][0] + d.growth[k][1])) / 2 / 256);
      return { hp, str: g('str'), end: g('end') };
    };
    // The story's floor for a forced fighter: Gohan for Obni, Goku under the guests' costumes (no Z form).
    const forced = CHAPTER_MIN_LEVEL[14] - FORCED_LEVEL_GAP;
    const ultimate = Number(FORMS.ultimate.bonus);
    const maxPower = ROSHI.power?.bonus ?? 0;
    const cases: Array<[string, 'goku' | 'gohan', number]> = [
      ['c14_obni', 'gohan', ultimate], ['c14_ganos', 'goku', maxPower], ['c14_harmira', 'goku', 0], ['c14_frostJar', 'goku', 0],
    ];
    const kefla = ENEMIES.c14_kefla;
    for (const [id, who, bonus] of cases) {
      const b = ENEMIES[id];
      const h = statsAt(who, forced);
      const hitsToEnd = (b.hp * (1 - (b.boss?.endAt ?? 0))) / avg(MELEE_POWER, 1, h.str + bonus, b.end);
      const hitsToKo = h.hp / avg(ENEMY_POWER, enemyPowerScale(b.str), b.str, h.end + bonus);
      const ratio = hitsToEnd / hitsToKo;
      expect(ratio, `${id} vs ${who} L${forced}`).toBeLessThanOrEqual(4);
      expect(ratio, `${id} vs ${who} L${forced}`).toBeGreaterThan(1);
      expect(b.str + b.pow + b.end, id).toBeLessThan(kefla.str + kefla.pow + kefla.end);
    }
    // The regular fighters stay under the stage's free-roaming T7 rivals.
    for (const id of ['c14_caway', 'c14_dercori', 'c14_prum', 'c14_magetta']) expect(ENEMIES[id].hp, id).toBeLessThan(ENEMIES.c14_u4Fighter.hp);
  });

  it('a bot that fights with the real damage rules wins each of them, and none of them is a walkover', async () => {
    const cases: Array<[string, 'goku' | 'android17']> = [['c14_obni', 'android17'], ['c14_roshi', 'goku'], ['c14_snipers', 'goku'], ['c14_frostTrap', 'goku']];
    for (const [script, active] of cases) {
      for (const seed of [11, 4242]) {
        const sim = await c14Seeded(active, seed);
        sim.start('top_arena_a', 22, 16);
        await settle(sim);
        const r = await c14FairPlay(sim, script);
        const what = `${script} seed ${seed}: ${JSON.stringify(r)}`;
        expect(r.finished && !r.died, what).toBe(true);
        expect(r.senzu, what).toBeLessThanOrEqual(2);
        expect(r.lost, what).toBeGreaterThanOrEqual(r.hpMax * 0.15);
        expect(sim.errors, what).toEqual([]);
      }
    }
  }, 120000);
});

// ------------------------------------------------------------------------------------------------ Chapter 12, eps 68 and 70

/**
 * Pick up every Dragon Ball of "Whose Wish?" the way a player following the radar does: walk onto the ones lying in
 * the open, stand beside the hidden ones and press A.
 */
async function gatherWishBalls(sim: Sim): Promise<void> {
  const st = sim.game.state;
  for (const [id, item, map, x, y, hidden] of WISH_BALLS) {
    sim.start(map, x, y);
    const f = sim.game.field;
    if (!f) throw new Error(map);
    expect(f.pickups.some((pk) => pk.id === id), `${id} lies on ${map}`).toBe(true);
    await settle(sim);
    pacify(sim);
    if (hidden) {
      // Stand on the open neighbouring tile whose facing points the examine box most squarely at the ball, press A.
      const pk = f.pickups.find((k) => k.id === id);
      const sides: Array<[number, number, 'up' | 'down' | 'left' | 'right']> = [[x, y - 1, 'down'], [x - 1, y, 'right'], [x + 1, y, 'left'], [x, y + 1, 'up']];
      const aim = (sx: number, sy: number, dir: 'up' | 'down' | 'left' | 'right'): number => {
        put(sim, sx, sy, dir);
        const fr = f.player.front(14, 16);
        return pk ? Math.hypot(pk.x - (fr.x + fr.w / 2), pk.y - (fr.y + fr.h / 2)) : Infinity;
      };
      const side = sides.filter(([sx, sy]) => !f.col.blocked({ x: sx * 16 + 3, y: sy * 16 + 8, w: 10, h: 6 }))
        .sort((a, b) => aim(...a) - aim(...b))[0];
      if (!side) throw new Error(`${id}: nowhere to stand`);
      for (let tries = 0; tries < 3 && !st.flag(`pickup:${id}`); tries++) {
        put(sim, side[0], side[1], side[2]);
        let press = true;
        sim.driver = () => { if (press) sim.input.inject('A', true); press = false; };
        await sim.tick(3);
        sim.driver = null;
        await settle(sim);
      }
    } else {
      put(sim, x, y);
      await sim.tick(30);
    }
    await settle(sim);
    expect(st.flag(`pickup:${id}`), `${id} picked up`).toBe(true);
    expect(st.count(item), item).toBe(1);
  }
}

/** How the ballplayer fields: every fly ball, none, or the ones a rule picks (by order, 0 = Cabba's). */
type Fielding = boolean | ((fly: number) => boolean);

/** How the ballplayer plays: fielding, the pitch progress to swing at, the distance from home to slide at. */
interface BallOpts { field: Fielding; swingAt: number | null; slideAt: number | null }

/**
 * A player at the ballpark on the real controls: runs under the fly balls `field` picks (double-tap to run, LoG2
 * style), swings when Champa's pitch is `swingAt` of the way to the plate, and slides `slideAt` px before home. `null`
 * leaves that part to nobody (the batter never swings, the runner never slides).
 */
function ballplayer(sim: Sim, opts: BallOpts): void {
  const dirs: Button[] = ['left', 'right', 'up', 'down'];
  let taps = 0;
  let swung = false;
  let slid = false;
  let flies = -1;
  let wasFly = false;
  sim.driver = () => {
    const play = BALLGAME.play;
    for (const b of dirs) sim.input.inject(b, false);
    if (play?.kind !== 'fly') taps = 0;
    if (play?.kind === 'fly' && !wasFly) flies++;
    wasFly = play?.kind === 'fly';
    if (!play) { swung = false; slid = false; return; }
    const f = sim.game.field;
    if (!f) return;
    const chase = typeof opts.field === 'function' ? opts.field(flies) : opts.field;
    if (play.kind === 'fly' && chase) {
      const dx = play.x - f.player.x;
      const dy = play.y - f.player.y;
      if (Math.hypot(dx, dy) < 3) return;
      const h: Button | null = Math.abs(dx) > 2 ? (dx < 0 ? 'left' : 'right') : null;
      const v: Button | null = Math.abs(dy) > 2 ? (dy < 0 ? 'up' : 'down') : null;
      const lead = Math.abs(dx) >= Math.abs(dy) ? h : v;
      taps++;
      if (taps === 1 && lead) { sim.input.inject(lead, true); return; }
      if (taps === 2) return;
      for (const b of [h, v]) if (b) sim.input.inject(b, true);
    }
    if (play.kind === 'pitch' && opts.swingAt !== null && !swung && play.p >= opts.swingAt) { sim.input.inject('A', true); swung = true; }
    if (play.kind === 'slide' && opts.slideAt !== null && !slid && play.dist <= opts.slideAt) { sim.input.inject('A', true); slid = true; }
  };
}

/** What the ballpark looked like when Whis called the game. */
interface FinalOut { board: string; sprite: string; outfit: string | undefined; hud: boolean }

/** Play Champa's challenge from the Capsule Corp garden table with `hero` at the controls; returns the final out. */
async function playBallgame(sim: Sim, opts: BallOpts): Promise<{ log: Said[]; final: FinalOut | null }> {
  const st = sim.game.state;
  sim.start('cc_yard', 27, 18);
  await settle(sim);
  const log = record(sim);
  let final: FinalOut | null = null;
  const g = sim.game;
  const say = g.say.bind(g);
  g.say = (lines) => {
    const f = g.field;
    if (f && !final && lines.some((l) => /And that is the game/.test(l.text))) {
      final = { board: f.map.props.find((p) => p.id === 'c12_board')?.kind ?? '', sprite: f.player.spriteId, outfit: st.char(st.data.active).outfit, hud: g.hideHud };
    }
    return say(lines);
  };
  ballplayer(sim, opts);
  await beat(sim, null, 'c12_champa_talk');
  sim.driver = null;
  return { log, final };
}

describe('Chapter 12: "Whose Wish?" and the baseball game (eps 68 and 70)', () => {
  it('the hub offers six episodes; the two late ones find the player at Capsule Corp, and any two finish Days of Peace', async () => {
    expect([...EPISODES]).toEqual(['c12_hit', 'c12_pan', 'c12_saiyaman', 'c12_krillin', 'c12_wish', 'c12_ball']);
    expect(EPISODES_NEEDED).toBe(2);
    for (const id of ['c12_wish', 'c12_ball']) {
      expect(QUESTS[id]?.star, id).toBe('silver');
      expect(QUESTS[id]?.region, id).toBe('spot_westcity');
    }
    expect(QUESTS.c12_days.desc).toMatch(/King Kai/);
    expect(QUESTS.c12_days.desc).toMatch(/Champa/);

    const sim = freshSim(11, 40);
    const st = sim.game.state;
    const q = (id: string) => st.data.journal[id];
    const log = record(sim);
    const said = (re: RegExp) => log.findIndex((l) => re.test(l.text));
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    await beat(sim, null, 'c12_start');
    // Four episodes phone in; King Kai's wish and Champa's challenge are taken up at Capsule Corp.
    for (const id of ['c12_hit', 'c12_pan', 'c12_saiyaman', 'c12_krillin']) expect(q(id)).toBe('active');
    expect(q('c12_wish')).toBeUndefined();
    expect(q('c12_ball')).toBeUndefined();
    expect(said(/Still dead, by the way/)).toBeGreaterThan(-1);
    expect(said(/purple cat/)).toBeGreaterThan(-1);
    sim.start('cc_yard', 22, 20);
    await settle(sim);
    expect(sim.game.field?.map.props.some((p) => p.id === 'c12_project')).toBe(true);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c12_champaY')).toBe(true);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c12_vadosY')).toBe(true);

    // First episode: the ball game, with nobody at the controls (Yamcha still scores the winning run).
    await beat(sim, null, 'c12_champa_talk');
    expect(q('c12_ball')).toBe('done');
    expect(st.flag('c12_ballDone')).toBe(true);
    expect(said(/1 of 2 episodes complete/)).toBeGreaterThan(-1);
    expect(st.data.chapter).toBe(12);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.field?.npcs.some((n) => n.spriteId === 'champa')).toBe(false);

    // Second episode: "Whose Wish?", start to finish, the way the player reaches each beat.
    await beat(sim, 'cc_yard', 'c12_project_look', 33, 7);
    expect(q('c12_wish')).toBe('active');
    expect(st.count('dragonRadar')).toBe(1);
    expect(sim.game.field?.map.props.some((p) => p.id === 'c12_pod')).toBe(true);
    expect(st.flag('noSwitch')).toBe(false);
    await beat(sim, null, 'c12_project_look');
    expect(log[log.length - 2]?.text).toMatch(/0 of 7 Dragon Balls so far\. The radar still shows one at Paozu Peaks/);
    expect(log[log.length - 1]?.text).toMatch(/No metal, no wish/);
    await gatherWishBalls(sim);
    await beat(sim, 'cc_yard', 'c12_project_look', 33, 7);
    // All seven: Bulma only asks for her metal now (no second reminder).
    expect(log[log.length - 1]?.text).toMatch(/All seven Dragon Balls! Now my metal/);
    // The drill pod down to the Earth's core (whoever is playing, Goku goes: here Vegeta was switched in).
    sim.start('cc_yard', 35, 9);
    await settle(sim);
    st.data.active = 'vegeta';
    sim.choice = 0;
    await beat(sim, null, 'c12_pod_down');
    expect(sim.game.field?.def.id).toBe('c12_core_mantle');
    expect(said(/coolant lasts about a minute and a half/)).toBeGreaterThan(-1);
    sim.start('c12_core_heart', EP.heart.arrive[0], 9);
    await settle(sim);
    await beat(sim, null, 'c12_wyrm_fight');
    expect(st.flag('c12_wyrmDown')).toBe(true);
    // Cut the alloy: the pod reels Goku in, Bulma takes the metal, and with all seven balls in hand Shenron is called.
    sim.choice = 2;
    await beat(sim, 'c12_core_heart', 'c12_cut_alloy', 16, 18);
    expect(st.flag('c12_alloyDelivered')).toBe(true);
    expect(st.count('c12_coreAlloy')).toBe(0);
    // Goku hands the alloy over himself, and calls Shenron himself.
    expect(log.find((l) => /So it IS a time mach-/.test(l.text))?.hero).toBe('goku');
    expect(log.find((l) => /Come on out, Shenron/.test(l.text))?.hero).toBe('goku');
    expect(q('c12_wish')).toBe('done');
    expect(st.flag('c12_wishDone')).toBe(true);
    for (const d of ['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7']) expect(st.count(d), d).toBe(0);
    // The episode in anime order: the argument over the wishes, Pan's fever, Beerus and the "hobby", Shenron leaves.
    const order = [/Something nice for Krillin/, /This one's yours/, /make my daughter Pan's fever go away/, /What is under the sheet/, /MY WORKSHOP/, /THAT IS PLENTY FOR ONE DAY/,
      /He forgot\. He forgot AGAIN/, /You picked my wish first/];
    const at = order.map((re) => said(re));
    for (let i = 0; i < at.length; i++) expect(at[i], String(order[i])).toBeGreaterThan(i ? at[i - 1] : -1);
    expect(st.flag('c12_labGone')).toBe(true);
    // Days of Peace is over: two episodes, the late ones counting like the rest.
    expect(q('c12_days')).toBe('done');
    expect(st.data.chapter).toBe(13);
    expect(st.flag('noSwitch')).toBe(false);
  });

  it('"Whose Wish?" is a dialogue choice: whoever the player backs first answers for it at the end', async () => {
    const CASES: Array<[number, RegExp, string | null, number]> = [
      [0, /He picked me FIRST/, null, 0],
      [1, /A future emperor rewards loyalty/, 'cookie', 3],
      [2, /You picked my wish first/, 'end1', 1],
      [3, /You stood up for your old master/, 'str1', 1],
      [4, /you backed us/, 'cookie', 5],
    ];
    for (const [choice, line, gift, n] of CASES) {
      const sim = freshSim(12, 37);
      const st = sim.game.state;
      st.join('vegeta', 30);
      // Mid-episode, as the tarp scene leaves it (journal entry, the pod out on the pad), with everything gathered.
      st.addQuest('c12_wish');
      st.set(POD_OUT);
      st.set('c12_alloyDelivered');
      for (const d of ['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7']) st.give(d, 1, 1);
      sim.choice = choice;
      const log = record(sim);
      // Who stands on the lawn when Shenron rises (each guest once; Champa and Vados are not at this party).
      let crowd: string[] = [];
      const g = sim.game;
      const say = g.say.bind(g);
      g.say = (lines) => {
        if (lines.some((l) => /STATE YOUR WISH/.test(l.text))) crowd = g.field?.npcs.filter((x) => !x.hidden).map((x) => x.spriteId) ?? [];
        return say(lines);
      };
      // Back at Capsule Corp with everything: the summoning starts by itself.
      sim.start('cc_yard', 22, 22);
      await settle(sim);
      expect(sim.errors).toEqual([]);
      expect(st.data.journal.c12_wish, `choice ${choice}`).toBe('done');
      expect(log.some((l) => line.test(l.text)), `choice ${choice}: ${line}`).toBe(true);
      if (gift) expect(st.count(gift), `choice ${choice}: ${gift}`).toBe(n);
      expect(st.count('pow3'), 'Gohan\'s thank-you capsule').toBe(1);
      for (const sprite of ['bulma', 'beerus', 'whis', 'pilaf', 'mai', 'shu', 'android18', 'roshi', 'c02_oolong', 'goten', 'trunksKid']) {
        expect(crowd.filter((x) => x === sprite).length, `${sprite} on the lawn`).toBe(1);
      }
      expect(crowd.includes('champa') || crowd.includes('vados')).toBe(false);
      // Afterwards: the workshop is a crater (the drill pod beside it survived), and King Kai waits at home for a wish that
      // never came.
      expect(sim.game.field?.def.id).toBe('cc_yard');
      expect(sim.game.field?.map.props.some((p) => p.id === 'c12_project')).toBe(false);
      sim.start('cc_yard', 22, 20);
      await settle(sim);
      const props = sim.game.field?.map.props.map((p) => p.id) ?? [];
      expect(props).toContain('c12_crater');
      expect(props).not.toContain('c12_project');
      expect(props).toContain('c12_pod');
      sim.start('kingkai_planet', 16, 16);
      await settle(sim);
      expect(sim.game.field?.npcs.filter((x) => x.spriteId === 'kingKai').map((x) => x.def.id)).toEqual(['c12_kingKaiK']);
      await beat(sim, null, 'c12_kingkai_talk');
      // The crater is cleared away once the story moves on.
      st.data.chapter = 13;
      sim.start('cc_yard', 22, 20);
      await settle(sim);
      expect(sim.game.field?.map.props.some((p) => p.id === 'c12_crater')).toBe(false);
    }
  });

  it('the Earth\'s core: a tank of coolant, blue vents, a burn that never knocks Goku out, a save in the suit, and the pod home', async () => {
    const sim = freshSim(12, 37);
    const st = sim.game.state;
    st.join('vegeta', 30);
    st.data.active = 'vegeta';
    st.addQuest('c12_wish');
    st.set(POD_OUT);
    sim.start('cc_yard', 35, 9);
    await settle(sim);
    sim.choice = 0;
    await beat(sim, null, 'c12_pod_down');
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(f.def.id).toBe('c12_core_mantle');
    // Underground: Whis's Charm cannot reach the core (the pod is the way out).
    expect(f.def.indoor).toBe(true);
    // Goku goes down in Bulma's heat suit, forced, whoever was playing.
    expect(st.data.active).toBe('goku');
    expect(st.flag('noSwitch')).toBe(true);
    expect(st.char('goku').outfit).toBe('c12_heatSuit');
    expect(f.player.spriteId).toBe('c12_heatSuit');
    expect(f.timer?.label).toBe('COOLANT');
    pacify(sim);
    sim.fair = true;
    // The tank empties a frame at a time while Goku has the controls.
    const full = st.get('c12_coolant') as number;
    expect(full).toBeGreaterThan(COOLANT_MAX - 120);
    await sim.tick(60);
    expect(full - (st.get('c12_coolant') as number)).toBe(60);
    // Run dry, the suit overheats: the heat burns 2% of max HP a second...
    st.set('c12_coolant', 1);
    await sim.tick(5);
    expect(f.timer?.label).toBe('OVERHEAT!');
    const hp0 = f.player.cs.hp;
    await sim.tick(121);
    const burn = Math.round(f.player.cs.hpMax * 0.02);
    expect(hp0 - f.player.cs.hp).toBeGreaterThanOrEqual(2 * burn);
    expect(hp0 - f.player.cs.hp).toBeLessThanOrEqual(3 * burn);
    // ...but never below 1 HP: the danger is meeting an enemy like that.
    f.player.cs.hp = 3;
    await sim.tick(600);
    expect(f.player.cs.hp).toBe(1);
    // A blue vent tops the tank up.
    put(sim, 12, 6);
    await sim.tick(3);
    expect(st.get('c12_coolant') as number).toBeGreaterThan(COOLANT_MAX - 10);
    expect(f.timer?.label).toBe('COOLANT');
    // The guardian's fight runs on the pod's own coolant: the tank holds while it lasts.
    st.set('c12_coolPause');
    const held = st.get('c12_coolant');
    await sim.tick(120);
    expect(st.get('c12_coolant')).toBe(held);
    st.clear('c12_coolPause');
    // A save in the core loads back into the suit and the heat.
    f.player.cs.hp = f.player.cs.hpMax;
    sim.fair = false;
    reload(sim);
    await settle(sim);
    expect(sim.game.field?.def.id).toBe('c12_core_mantle');
    expect(sim.game.field?.player.spriteId).toBe('c12_heatSuit');
    expect(sim.game.field?.timer?.label).toBe('COOLANT');
    // The pod takes Goku home: suit off, heat gone, and whoever was playing gets the controls back.
    await beat(sim, null, 'c12_pod_up');
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.field?.timer).toBeNull();
    expect(st.char('goku').outfit).toBeUndefined();
    expect(st.flag('noSwitch')).toBe(false);
    expect(st.data.active).toBe('vegeta');
    expect(st.get('c12_coolant')).toBeUndefined();
    // The episode stays open: the pod waits on the pad for another try.
    expect(st.data.journal.c12_wish).toBe('active');
    expect(sim.game.field?.map.props.some((p) => p.id === 'c12_pod')).toBe(true);
  });

  it('the core is a LoG2 hostile zone the guardian blocks; the Dragon Balls lie on open ground in seven regions', async () => {
    const open = (sim: Sim) => {
      const f = sim.game.field;
      if (!f) throw new Error('no field');
      return (x: number, y: number) => !f.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
    };
    // The mantle tunnels: every enemy, vent, the save and the shaft down are reachable from the pod.
    const sim = freshSim(12, 37);
    sim.game.state.addQuest('c12_wish');
    sim.start('c12_core_mantle', EP.mantle.arrive[0], EP.mantle.arrive[1]);
    let ok = open(sim);
    const mantle = resolveMap('c12_core_mantle');
    if (!mantle) throw new Error('mantle');
    expect(mantle.hostile && mantle.indoor).toBe(true);
    let seen = reachable(sim, EP.mantle.arrive[0], EP.mantle.arrive[1]);
    expect(mantle.enemies?.length).toBeGreaterThanOrEqual(8);
    for (const e of mantle.enemies ?? []) {
      expect(ok(e.x, e.y), `mantle enemy ${e.type} ${e.x},${e.y}`).toBe(true);
      expect(near(seen, e.x, e.y), `mantle enemy ${e.type} reachable`).toBe(true);
    }
    for (const t of mantle.triggers ?? []) if (t.script === 'c12_core_vent') expect(near(seen, t.x, t.y), t.id).toBe(true);
    for (const o of mantle.objects ?? []) if (o.type === 'save' || o.type === 'sign') expect(near(seen, o.x, o.y), `${o.type} ${o.x},${o.y}`).toBe(true);
    expect([19, 20, 21, 22, 23, 24].some((x) => seen.has(`${x},35`)), 'the shaft down to the heart').toBe(true);
    // The north-east ledge and its cache: only the flight circle over the lava reaches them.
    const hop = mantle.objects?.find((o) => o.type === 'flight' && o.x === 34);
    expect(hop && near(seen, hop.x, hop.y)).toBe(true);
    expect(seen.has('41,3') || seen.has('41,4')).toBe(false);
    if (hop?.type === 'flight') expect(near(reachable(sim, hop.tx, hop.ty), 41, 3)).toBe(true);
    // The heart: the guardian's trigger band spans the arena, so nobody reaches the crystal without the fight.
    sim.start('c12_core_heart', EP.heart.arrive[0], EP.heart.arrive[1]);
    ok = open(sim);
    const heart = resolveMap('c12_core_heart');
    const band = heart?.triggers?.find((t) => t.id === 'c12_wyrmT');
    if (!heart || !band) throw new Error('heart');
    seen = reachable(sim, EP.heart.arrive[0], EP.heart.arrive[1]);
    const crystal = heart.triggers?.find((t) => t.id === 'c12_crystalT');
    if (!crystal) throw new Error('crystal trigger');
    expect([...Array(crystal.w * crystal.h).keys()].some((i) => seen.has(`${crystal.x + (i % crystal.w)},${crystal.y + Math.floor(i / crystal.w)}`))).toBe(true);
    for (let x = 0; x < 32; x++) if (ok(x, band.y) || ok(x, band.y + 1)) expect(x >= band.x && x < band.x + band.w, `band gap at ${x}`).toBe(true);
    for (const t of heart.triggers ?? []) if (t.script === 'c12_core_vent') expect(near(seen, t.x, t.y), t.id).toBe(true);

    // The seven Dragon Balls: one per region, on open ground the player can walk to from where they come in.
    const regions = new Set<string>();
    for (const [id, item, map, x, y, hidden] of WISH_BALLS) {
      const def = resolveMap(map);
      if (!def) throw new Error(map);
      regions.add(def.region ?? map);
      expect(def.pickups?.find((p) => p.id === id), id).toMatchObject({ item, x, y, hidden, showIf: 'quest:c12_wish' });
      const s2 = freshSim(12, 37);
      s2.start(map, x, y);
      // Shown only while the episode is open (the Dragon Radar marks the visible ones on the R map).
      expect(s2.game.field?.pickups.some((pk) => pk.id === id), `${id} hidden before the episode`).toBe(false);
      s2.game.state.addQuest('c12_wish');
      s2.start(map, x, y);
      const ok2 = open(s2);
      expect(ok2(x, y), `${id} on open ground`).toBe(true);
      const f2 = s2.game.field;
      if (!f2) throw new Error(map);
      // Walk in from every edge the map has an exit on, and from its save disc or world sign.
      const starts: Array<[number, number]> = [];
      const W = f2.map.cols;
      const H = f2.map.rows;
      for (const side of Object.keys(def.exits ?? {})) {
        for (let i = 0; i < Math.max(W, H); i++) {
          const [sx, sy] = side === 'north' ? [i, 0] : side === 'south' ? [i, H - 1] : side === 'west' ? [0, i] : [W - 1, i];
          if (sx < W && sy < H && ok2(sx, sy)) starts.push([sx, sy]);
        }
      }
      for (const o of def.objects ?? []) if (o.type === 'save' || o.type === 'worldSign') starts.push([o.x, o.y + 1]);
      const reach = new Set<string>();
      for (const [sx, sy] of starts) if (!reach.has(`${sx},${sy}`) && ok2(sx, sy)) for (const k of reachable(s2, sx, sy)) reach.add(k);
      expect(reach.has(`${x},${y}`), `${id} on ${map} reachable on foot`).toBe(true);
    }
    expect(regions.size).toBe(7);
    expect(WISH_BALLS.map((b) => b[1]).sort()).toEqual(['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7']);

    // Capsule Corp: the tarp and the drill pod can be walked up to from the yard, and lifting the tarp from the tile
    // the pod rolls onto never leaves the hero stuck inside it.
    const cc = freshSim(12, 37);
    cc.start('cc_yard', 34, 6);
    await settle(cc);
    await beat(cc, null, 'c12_project_look');
    const fc = cc.game.field;
    if (!fc) throw new Error('cc_yard');
    expect(fc.col.blocked(fc.player.box()), 'hero clear of the pod').toBe(false);
    const yard = reachable(cc, 22, 20);
    for (const id of ['c12_projectT', 'c12_podT']) {
      const t = resolveMap('cc_yard')?.triggers?.find((x) => x.id === id);
      if (!t) throw new Error(id);
      expect([...Array(t.w * t.h).keys()].some((i) => yard.has(`${t.x + (i % t.w)},${t.y + Math.floor(i / t.w)}`)), id).toBe(true);
    }
    expect(WISH_BALLS.filter((b) => b[5]).length).toBeGreaterThanOrEqual(2);
  });

  it('the ball game on the real controls: two catches and a home run make a perfect MVP, and Beerus pays a bonus', async () => {
    const sim = freshSim(12, 37);
    const st = sim.game.state;
    st.join('vegeta', 30);
    const { log, final } = await playBallgame(sim, { field: true, swingAt: (SWEET_SPOT[0] + SWEET_SPOT[1]) / 2 - 0.02, slideAt: null });
    expect(sim.errors).toEqual([]);
    const fo = final as FinalOut | null;
    expect(fo?.board).toBe('c12_board_3_4_2');
    expect(fo?.sprite).toBe('c12_yamchaBall');
    expect(fo?.hud).toBe(true);
    expect(st.get('c12_ballMvp')).toBe(MVP_MAX);
    expect(log.some((l) => /over the centre-field wall/.test(l.text))).toBe(true);
    expect(log.filter((l) => /flies out to centre/.test(l.text)).length).toBe(2);
    expect(st.count('c12_gameBall')).toBe(1);
    expect(st.count('str3')).toBe(1);
    expect(st.count('end1')).toBe(1);
    // Umpired by Whis and Vados: no ki, no flying, no destruction.
    expect(log.some((l) => /no destruction/i.test(l.text))).toBe(true);
    // Everything is put back: the hero's own look, the HUD, the seal.
    expect(st.char('goku').outfit).toBeUndefined();
    expect(sim.game.hideHud).toBe(false);
    expect(sim.game.fightDepth).toBe(0);
    expect(st.flag('act5_busy')).toBe(false);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(st.data.journal.c12_ball).toBe('done');
  });

  it('a single and a slide under the tag also win it; a player who never moves still sees Yamcha score the winning run', async () => {
    // A swing early in the window is a single; a slide in time beats Botamo's tag. Played as Gohan, who wears the costume.
    const sim = freshSim(12, 37);
    const st = sim.game.state;
    st.join('gohan', 33);
    st.data.active = 'gohan';
    const single = await playBallgame(sim, { field: true, swingAt: SWING_WINDOW[0] + 0.01, slideAt: (SLIDE_WINDOW[0] + SLIDE_WINDOW[1]) / 2 });
    expect(sim.errors).toEqual([]);
    expect(single.final?.board).toBe('c12_board_3_4_2');
    expect(single.final?.outfit).toBe('c12_yamchaBall');
    expect(single.log.some((l) => /A bat-and-ball sport/.test(l.text) && l.hero === 'gohan')).toBe(true);
    expect(single.log.some((l) => /clean single/.test(l.text))).toBe(true);
    expect(single.log.some((l) => /Under the tag by a whisker/.test(l.text))).toBe(true);
    expect(st.get('c12_ballMvp')).toBe(MVP_BONUS);
    expect(st.count('end1')).toBe(1);
    expect(st.char('gohan').outfit).toBeUndefined();
    expect(st.data.active).toBe('gohan');

    // Nobody at the controls: every fly ball drops (Universe 6 scores three), three strikes, no slide. The umpires
    // rule Champa's stopped-in-mid-air pitch illegal and his glowing tag void, and Yamcha still scores.
    const idle = freshSim(12, 37);
    const ist = idle.game.state;
    const lazy = await playBallgame(idle, { field: false, swingAt: null, slideAt: null });
    expect(idle.errors).toEqual([]);
    expect(lazy.final?.board).toBe('c12_board_6_7_2');
    expect(lazy.log.some((l) => /thrown with ki/.test(l.text))).toBe(true);
    expect(lazy.log.some((l) => /tagged him with destruction/.test(l.text))).toBe(true);
    expect(lazy.log.some((l) => /not the one lying in a crater/.test(l.text))).toBe(true);
    expect(ist.get('c12_ballMvp')).toBe(0);
    expect(ist.count('end1')).toBe(0);
    expect(ist.count('c12_gameBall')).toBe(1);
    expect(ist.data.journal.c12_ball).toBe('done');
    // The fly balls land where Yamcha can get to in time from centre field (one only at a run).
    const sim3 = new Sim();
    sim3.start('c12_ballpark', EP.park.field[0], EP.park.field[1]);
    const seen = reachable(sim3, EP.park.field[0], EP.park.field[1]);
    for (const [x, y] of [[17, 8], [27, 6], [14, 14]]) expect(seen.has(`${x},${y}`), `${x},${y}`).toBe(true);
    expect(CATCH_RADIUS).toBeLessThan(16);
  });

  it('after the credits Champa still waits with his challenge and the tarp can still be lifted; Beerus remembers both', async () => {
    const sim = freshSim(15, 48);
    const st = sim.game.state;
    st.set('post_game');
    sim.start('cc_yard', 27, 18);
    await settle(sim);
    const ids = sim.game.field?.npcs.map((n) => n.def.id) ?? [];
    expect(ids).toContain('c12_champaP');
    expect(ids).not.toContain('c12_champaY');
    await beat(sim, 'cc_yard', 'c12_project_look', 33, 7);
    expect(st.data.journal.c12_wish).toBe('active');
    // During the tournament chapters nobody has time: the tarp is only a tarp, and Champa stays home.
    const busy = freshSim(13, 42);
    const log = record(busy);
    busy.start('cc_yard', 27, 18);
    await settle(busy);
    expect(busy.game.field?.npcs.some((n) => n.spriteId === 'champa' && /^c12_/.test(n.def.id))).toBe(false);
    await beat(busy, 'cc_yard', 'c12_project_look', 33, 7);
    expect(busy.game.state.data.journal.c12_wish).toBeUndefined();
    expect(log.some((l) => /KEEP OUT/.test(l.text))).toBe(true);
    // Beerus's hub chatter picks up both episodes.
    const chat = freshSim(12, 37);
    chat.game.state.set('c12_labGone');
    chat.game.state.set('c12_ballDone');
    const heard = record(chat);
    chat.start('cc_yard', 25, 17);
    await settle(chat);
    for (let i = 0; i < 9; i++) await beat(chat, null, 'act5_beerus_talk');
    expect(heard.some((l) => /A time machine\. On MY favourite restaurant/.test(l.text))).toBe(true);
    expect(heard.some((l) => /That Yamcha has a good arm/.test(l.text))).toBe(true);
  });

  it('the new faces read on the Scouter, and the core\'s wildlife sits in the round-2 grind band', async () => {
    const { scanKey } = await import('../../src/content/scans');
    const { hitsRatio } = await import('../fairbot');
    const { FORMS } = await import('../../src/content/characters');
    expect(scanKey('c12_heatSuit')).toBe('goku');
    expect(scanKey('c12_yamchaBall')).toBe('yamcha');
    for (const id of ['champa', 'vados', 'pilaf', 'mai', 'shu', 'android18', 'roshi', 'pan', 'videl', 'kingKai', 'botamo', 'cabba', 'c07_magetta']) {
      expect(scanKey(id), id).toBeTruthy();
    }
    for (const id of ['c12_heatSuit', 'c12_yamchaBall']) expect(portrait(id), id).toBeTruthy();
    // Chapter 12 Goku as the full-game run has him (L37) in Super Saiyan Blue: LoG2's per-enemy band, about 5-9 hits
    // to kill and at least 15 to knock him out (critic round 2, gap 1); the guardian sits with Hit (ratio at most 4).
    const ssb = FORMS.ssb.bonus;
    const bonus = typeof ssb === 'number' ? ssb : 0;
    const goku = { str: 56 + bonus, end: 46 + bonus, hpMax: 906 };
    const mantle = resolveMap('c12_core_mantle');
    for (const id of ['c12_magmaSlime', 'c12_cinderBat', 'c12_crustCrab', 'c12_lavaSerpent']) {
      const r = hitsRatio(goku, ENEMIES[id]);
      expect(r.hitsToEnd, `${id} hits to kill`).toBeGreaterThanOrEqual(5);
      expect(r.hitsToEnd, `${id} hits to kill`).toBeLessThanOrEqual(9);
      expect(r.hitsToKO, `${id} hits to knock Goku out`).toBeGreaterThanOrEqual(15);
      expect(mantle?.enemies?.some((e) => e.type === id), `${id} lives in the mantle`).toBe(true);
      expect(CREATURES[ENEMIES[id].sprite], id).toBeTruthy();
    }
    const wyrm = hitsRatio(goku, ENEMIES.c12_mantleWyrm);
    expect(wyrm.ratio).toBeGreaterThanOrEqual(1);
    expect(wyrm.ratio).toBeLessThanOrEqual(4);
  });

  it('the drill pod stays on the pad: the core can be revisited after the episode, so its cache and its EXP are never lost', async () => {
    const sim = freshSim(12, 37);
    const st = sim.game.state;
    st.join('vegeta', 30);
    st.data.active = 'vegeta';
    // "Whose Wish?" is over: the alloy cut, the guardian down, the workshop a crater.
    st.addQuest('c12_wish');
    st.completeQuest('c12_wish');
    st.set(POD_OUT);
    for (const flag of ['c12_wyrmDown', 'c12_alloyCut', 'c12_alloyDelivered', 'c12_summoned', 'c12_labGone', 'c12_wishDone']) st.set(flag);
    st.set('c12_labGoneCh', 12);
    const asked: string[] = [];
    const g = sim.game;
    const ask = g.ask.bind(g);
    g.ask = (prompt, options) => { asked.push(prompt.text); return ask(prompt, options); };
    sim.start('cc_yard', 35, 9);
    await settle(sim);
    expect(sim.game.field?.map.props.some((p) => p.id === 'c12_pod')).toBe(true);
    const podT = resolveMap('cc_yard')?.triggers?.find((t) => t.id === 'c12_podT');
    expect(podT && st.check(podT.showIf) && !(podT.hideIf && st.check(podT.hideIf))).toBe(true);
    sim.choice = 0;
    await beat(sim, null, 'c12_pod_down');
    expect(asked.some((t) => /Dive to the Earth's core again/.test(t))).toBe(true);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    expect(f.def.id).toBe('c12_core_mantle');
    expect(st.data.active).toBe('goku');
    expect(st.char('goku').outfit).toBe('c12_heatSuit');
    expect(f.timer?.label).toBe('COOLANT');
    // The tunnels are stocked again (a place to level), and a cache missed the first time is still there.
    expect(f.enemies.filter((e) => !e.dead).length).toBe(resolveMap('c12_core_mantle')?.enemies?.length);
    expect(st.flag('chest:c12_mantleCache')).toBe(false);
    // The heart: no guardian, no crystal left to cut.
    const heart = resolveMap('c12_core_heart');
    for (const id of ['c12_wyrmT', 'c12_crystalT']) {
      const t = heart?.triggers?.find((x) => x.id === id);
      expect(t && st.check(t.showIf) && !(t.hideIf && st.check(t.hideIf)), id).toBe(false);
    }
    // The pod takes Goku home and hands the controls back.
    await beat(sim, null, 'c12_pod_up');
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(st.data.active).toBe('vegeta');
    expect(st.flag('noSwitch')).toBe(false);
    expect(st.char('goku').outfit).toBeUndefined();
    expect(st.data.journal.c12_wish).toBe('done');
  });

  it('the people at home know all six episodes: Goten points to the two at Capsule Corp, Chi-Chi reacts to both', async () => {
    const sim = freshSim(12, 37);
    const st = sim.game.state;
    const heard = record(sim);
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    for (let i = 0; i < 6; i++) await beat(sim, null, 'act5_goten_talk');
    expect(new Set(heard.map((l) => l.text)).size, 'one hint per open episode').toBe(6);
    expect(heard.some((l) => /under a sheet on the old time machine pad/.test(l.text))).toBe(true);
    expect(heard.some((l) => /big purple cat/.test(l.text))).toBe(true);
    st.addQuest('c12_wish');
    st.completeQuest('c12_wish');
    st.addQuest('c12_ball');
    st.completeQuest('c12_ball');
    heard.length = 0;
    for (let i = 0; i < 2; i++) await beat(sim, null, 'act5_chichi_talk');
    expect(heard.some((l) => /You gave the wish to Pan, for her fever/.test(l.text))).toBe(true);
    expect(heard.some((l) => /BASEBALL\? Against a god of destruction/.test(l.text))).toBe(true);
  });

  it('however many runs Universe 6 scores, Universe 7 ties it with the bases empty, and Yamcha bats with Goku on deck', async () => {
    // Universe 7's order is Goku, Krillin, Gohan, Piccolo, Trunks, Yamcha: the rally never leaves a runner ahead of
    // Yamcha (he scores the winning run) and nobody bats twice before the order comes round.
    const CASES: Array<[string, Fielding, number, RegExp[]]> = [
      ['every fly caught', true, 0, [/Without ki I can barely follow it/, /Trunks pops up to Cabba for the second out/]],
      ['Cabba\'s fly dropped', (n) => n > 0, 1, [/Gohan leads off with a drive over the left-field fence/, /TIED/, /Without ki I can barely follow it/, /Trunks pops up/]],
      ['only Cabba\'s fly caught', (n) => n === 0, 2, [/didn't even SEE it/, /Gohan doubles into the gap and Piccolo triples him home/, /TIED/]],
      ['every fly dropped', false, 3, [/Goku leads off with a bunt/, /didn't even SEE it/, /Gohan doubles Goku home and Piccolo triples Gohan in/, /TIED/]],
    ];
    for (const [label, field, runs, beats] of CASES) {
      const sim = freshSim(12, 37);
      const { log, final } = await playBallgame(sim, { field, swingAt: SWING_WINDOW[0] + 0.01, slideAt: null });
      expect(sim.errors, label).toEqual([]);
      expect(final?.board, label).toBe(`c12_board_${START_RUNS + runs}_${START_RUNS + runs + 1}_2`);
      const at = beats.map((re) => log.findIndex((l) => re.test(l.text)));
      for (let i = 0; i < at.length; i++) expect(at[i], `${label}: ${beats[i]}`).toBeGreaterThan(i ? at[i - 1] : -1);
      expect(log.some((l) => /stranded/.test(l.text)), label).toBe(false);
      const up = log.findIndex((l) => /Now batting for Universe 7\.\.\. Yamcha/.test(l.text));
      expect(up, label).toBeGreaterThan(at[at.length - 1]);
      expect(log.findIndex((l) => /I'll hit it and you run/.test(l.text)), label).toBeGreaterThan(up);
    }
  });
});
