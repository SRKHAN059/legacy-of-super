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
      ['c13_monster_beach', 'c13_ani1'], ['c13_monster_jungle', 'c13_ani2'], ['c13_monster_camp', 'c13_ani3'], ['c13_tien_dojo', 'c13_ani4'],
      ['c13_training_wilds', 'c13_ani5'], ['c13_baba_lake', 'c13_ani6'], ['paozu_home', 'c13_ani7'],
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
