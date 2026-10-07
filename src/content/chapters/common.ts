import type { Expression } from '../../art/portrait';
import { TILE } from '../../engine/constants';
import { registerScripts, type ScriptApi } from '../../game/script';
import { CHARACTERS, type CharId } from '../characters';
import { registerOverlay } from '../registry';

/**
 * Canonical progression contract shared by every act. `ensureChapterState(s, n)` raises the game state to
 * what chapter `n` expects at its start (party, forms, techniques, key items, world-map spots, flags).
 * It only ever adds/raises, never removes, so it is safe to call at the top of every chapter start script.
 * This also makes each chapter playable/testable standalone.
 *
 * Levels follow LoG2: they come from EXP, and the coloured level gates on the story path (`STORY_GATES`) make the
 * player grind and rotate the party to keep up. A level floor (ROM SetMinLevel) is only a safety net: in a
 * playthrough that began with the prologue, a hand-over lifts nobody but the hero who played the chapter that just
 * ended, and only to `CHAPTER_MIN_LEVEL[n] - HANDOVER_LEVEL_GAP`, well below the band, so a player who fought
 * normally keeps exactly what they earned. The bench is never raised: it falls behind until rotated in.
 * `force()` lifts a character the story puts back on the field to `CHAPTER_MIN_LEVEL[chapter] - FORCED_LEVEL_GAP`,
 * so a forced fight is never a wall.
 * A chapter started standalone (dev entry, tests, a save from before this rule) still floors the whole party at
 * the band start.
 */

/** Minimum hero level expected at the START of each chapter (index = chapter). */
export const CHAPTER_MIN_LEVEL: readonly number[] = [6, 1, 8, 12, 15, 18, 22, 25, 29, 30, 34, 37, 40, 42, 45, 48];

/** Levels below the chapter's band start that a story-forced character is lifted to (LoG2 SetMinLevel). */
export const FORCED_LEVEL_GAP = 3;

/**
 * Levels below the chapter's band start that the hand-over safety net lifts the outgoing hero to in a story run.
 * Five levels is about a whole chapter's story EXP at any point of the curve, so the net only catches a player who
 * avoided nearly every fight; anyone who plays normally reaches the band (and the story gates) on EXP alone.
 */
export const HANDOVER_LEVEL_GAP = 5;

/** Flag: this save began with the prologue, so chapter hand-overs never floor bench levels. */
export const STORY_RUN = '_storyRun';

interface Grant {
  join?: Array<[CharId, number]>;
  techs?: Array<[CharId, string]>;
  forms?: Array<[CharId, string]>;
  charged?: CharId[];
  items?: string[];
  spots?: string[];
  flags?: string[];
}

/** What each chapter's completion grants (cumulative for later chapters). Index = chapter. */
const GRANTS: Record<number, Grant> = {
  0: { spots: ['spot_future_city', 'spot_future_base'] },
  1: { join: [['goku', 1]], techs: [['goku', 'kamehameha']], forms: [['goku', 'ssj']], spots: ['spot_paozu', 'spot_satancity', 'spot_kingkai'] },
  2: { join: [['vegeta', 8]], techs: [['vegeta', 'bigBang']], forms: [['vegeta', 'ssj']], items: ['scouter'], spots: ['spot_westcity', 'spot_kame'] },
  3: { forms: [['goku', 'ssg']], items: ['dragonRadar'], spots: ['spot_desert', 'spot_lookout'] },
  4: { spots: ['spot_beerus', 'spot_space_earth'] },
  5: { join: [['gohan', 16], ['piccolo', 18]], techs: [['gohan', 'masenko'], ['piccolo', 'specialBeamCannon']], forms: [['gohan', 'ssj'], ['piccolo', 'unweighted']], spots: ['spot_wasteland'] },
  6: { forms: [['goku', 'ssb'], ['vegeta', 'ssb']], techs: [['vegeta', 'galickGun']] },
  7: { spots: ['spot_nameless'] },
  8: {},
  9: { join: [['trunks', 30]], techs: [['trunks', 'burningAttack'], ['trunks', 'swordBlast']], forms: [['trunks', 'ssj']], charged: ['trunks'], spots: ['spot_future_city', 'spot_future_base'] },
  10: { spots: ['spot_u10', 'spot_zeno'] },
  11: { forms: [['trunks', 'rage']] },
  // Bulma upgrades the Scouter for the Universe Survival arc (LoG2: after the TV announcement): the R map now shows
  // unexplored areas in grey. An act may set `scouterPlus` earlier in a story beat; this is the latest point.
  12: { spots: ['spot_snow'], flags: ['scouterPlus'] },
  13: { forms: [['gohan', 'ultimate']], techs: [['gohan', 'kamehameha'], ['piccolo', 'hellzoneGrenade']], spots: ['spot_monster'] },
  14: { techs: [['goku', 'spiritBomb'], ['vegeta', 'finalFlash']], forms: [['vegeta', 'ssbe']] },
};

/** Raise state to the canonical start of chapter `n` (grants of every chapter < n, plus joins of n itself are left to the chapter). */
export function ensureChapterState(s: ScriptApi, n: number): void {
  const st = s.state;
  if (n === 0) st.set(STORY_RUN);
  if (st.data.chapter < n) st.data.chapter = n;
  for (let c = 0; c < n; c++) {
    const g = GRANTS[c];
    if (!g) continue;
    for (const [id, lv] of g.join ?? []) {
      // Trunks leaves after the prologue and rejoins in chapter 9.
      if (id === 'trunks' && c === 0) continue;
      if (!st.char(id).joined) st.join(id, lv);
    }
    for (const [id, t] of g.techs ?? []) st.learn(id, t);
    for (const [id, f] of g.forms ?? []) {
      const ch = st.char(id);
      if (!ch.form || formRank(f) > formRank(ch.form)) ch.form = f;
    }
    for (const id of g.charged ?? []) st.char(id).charged = true;
    for (const it of g.items ?? []) if (st.count(it) === 0) st.give(it, 1, 1);
    for (const sp of g.spots ?? []) s.unlockRegion(sp);
    for (const fl of g.flags ?? []) st.set(fl);
  }
  // Story gates of earlier chapters: a playthrough broke them on the way here; a standalone start finds them open.
  for (const gate of STORY_GATES) if (gate.chapter < n) st.set(storyGateFlag(gate));
  const min = chapterFloor(n);
  if (st.flag(STORY_RUN)) {
    // A real playthrough: only the hero who just finished the previous chapter is caught by the safety net, well
    // below the band; the bench is not touched.
    const hero = st.hero;
    const net = Math.max(1, min - HANDOVER_LEVEL_GAP);
    if (hero.joined && hero.level < net && hero.id !== 'satan' && st.party.includes(hero)) st.join(hero.id, net);
    return;
  }
  // Standalone chapter start: the whole party at the band start.
  for (const c of st.party) if (c.level < min && c.id !== 'satan') st.join(c.id, min);
}

/** CHAPTER_MIN_LEVEL for chapter `n` (clamped to the table). */
function chapterFloor(n: number): number {
  return CHAPTER_MIN_LEVEL[Math.max(0, Math.min(n, CHAPTER_MIN_LEVEL.length - 1))] ?? 1;
}

/** Rank forms so upgrades never downgrade (ssj < ssg < ssb < ssbe...). */
function formRank(f: string): number {
  return ['ssj', 'unweighted', 'ssg', 'ssb', 'rage', 'ultimate', 'ssbe', 'ssbkk', 'ui'].indexOf(f);
}

/**
 * Make `id` the forced active character for a story segment (disables switching at save points). A benched
 * character the story puts back on the field is lifted to the chapter's band start minus FORCED_LEVEL_GAP
 * (LoG2 SetMinLevel), so a forced segment is never a wall; a character who just joined keeps the join level.
 */
export function force(s: ScriptApi, id: CharId): void {
  const c = s.state.char(id);
  const floor = chapterFloor(s.state.data.chapter) - FORCED_LEVEL_GAP;
  if (c.joined && c.level < floor && id !== 'satan') s.state.join(id, floor);
  s.switchTo(id);
  s.set('noSwitch');
}

/** End a forced segment. */
export function unforce(s: ScriptApi): void {
  s.clear('noSwitch');
}

// ------------------------------------------------------------------------------------------------ story gates

/** A tile rectangle on a map: [x, y, w, h]. */
export type TileRect = [number, number, number, number];

/**
 * A coloured level gate on the critical path (LoG2 §6.6: Piccolo 10 and 25, Vegeta 30, Trunks 30 and Goku 40 all
 * stood on the story route and made the player grind and rotate the party). Each one is placed on its map by an
 * overlay registered here, with a once-only hint trigger on the near side and a far-side safety net.
 */
export interface StoryGate {
  /** Barrier id (also the stem of its hint and safety-net scripts). */
  id: string;
  map: string;
  /** The chapter whose critical path runs through it. */
  chapter: number;
  character: CharId;
  level: number;
  /** The barrier itself. */
  rect: TileRect;
  /** Near-side hint trigger (fires once, the first time the player walks up). */
  hint: TileRect;
  /** A single flag: the gate only stands once it is set (a story scene plays beyond it first). */
  standsIf?: string;
  /**
   * The far side: whole maps, or [map, x, y, w, h] regions of the gate's map. The near side never reaches it on foot
   * while the gate stands (tests/full_game.test.ts checks every gate).
   */
  far: Array<string | [string, ...TileRect]>;
  /**
   * Far-side places a game can resume in without passing the gate: maps with a save point beyond it (a save made
   * before the gate existed) and the way back from them. A hero found there on map entry opens the gate behind
   * them instead of being walled in.
   */
  rescue: Array<string | [string, ...TileRect]>;
  /** Near-side save point where the player switches to `character`: [map, x, y]. */
  save: [string, number, number];
  /** How the hint refers to that save point ("Switch to Vegeta at ..."). */
  saveAt: string;
  /** Near-side hostile maps to grind in, with the tile a player walks in at. */
  zone: Array<[string, number, number]>;
  /**
   * The level `character` has when a player who fights what the story puts in front of them reaches the gate (the
   * full-game run measures the same). The gate asks for half a clear to eight clears of `zone` on top of it, at least
   * ten kills, and five to fifteen minutes of fair-bot grinding (tests/grind.test.ts; LoG2's own story gates cost that
   * bot 7 to 15 over six to eight visits).
   */
  arrive: number;
  /** The hero's first words at the gate: when the hero is `character`, and when it is somebody else. */
  self: Array<[string, string, Expression?]>;
  other: Array<[string, string, Expression?]>;
  /** Where to train, one sentence. */
  train: string;
  /** An extra pointer shown while a story condition holds: [condition, sentence]. */
  extra?: [string, string];
}

/** Gate colours by character, as the hint names them (LoG2 §6.6 colour code). */
const GATE_COLOUR: Partial<Record<CharId, string>> = {
  goku: 'Orange', vegeta: 'Dark blue', gohan: 'Light blue', trunks: 'Purple', piccolo: 'Green', satan: 'Red',
};

/** The coloured level gates on the story path, in story order. */
export const STORY_GATES: readonly StoryGate[] = [
  {
    // LoG2's Piccolo 10 into the Triceratops Jungle: the first gate for the second hero, taught with a switch at a
    // save point. Vegeta played Chapter 2 (band 8-12); fifteen is the start of the band he plays Chapter 4 in.
    id: 'c03_g_castle', map: 'pilaf_castle_out', chapter: 3, character: 'vegeta', level: 15,
    rect: [18, 19, 4, 1], hint: [17, 20, 6, 1],
    far: ['pilaf_castle_in', 'c03_pilaf_vault', ['pilaf_castle_out', 10, 7, 20, 12]],
    rescue: ['pilaf_castle_in', 'c03_pilaf_vault', ['pilaf_castle_out', 10, 7, 20, 12]],
    save: ['pilaf_castle_out', 15, 21], saveAt: 'the save point outside the castle gate',
    zone: [['desert_entry', 4, 15], ['desert_oasis', 2, 14], ['pilaf_castle_out', 15, 23]],
    arrive: 12,
    self: [['hero', 'A force field. Pilaf honestly believes a toy like this keeps out the Prince of all Saiyans?', 'smirk']],
    other: [['hero', 'Pilaf sealed his courtyard with some kind of barrier. It feels like Vegeta\'s ki... he\'d love an excuse to smash it.', 'happy']],
    train: 'The bandits, sand snakes and scarabs of the Diablo Desert make good training.',
  },
  {
    // LoG2's Piccolo 25 into Gingertown, at LoG2's own level: Piccolo, benched since Chapter 5, must catch up before
    // the tournament (five levels from his L20 arrival, about eight minutes of fair-bot grinding on the rim).
    id: 'c07_g_stadium', map: 'c07_nameless_grounds', chapter: 7, character: 'piccolo', level: 25,
    rect: [18, 4, 4, 1], hint: [16, 5, 8, 1],
    far: ['c07_nameless_arena', ['c07_nameless_grounds', 18, 0, 4, 4]],
    rescue: ['c07_nameless_arena', ['c07_nameless_grounds', 18, 0, 4, 4]],
    save: ['c07_nameless_grounds', 8, 7], saveAt: 'the save point by the landing site',
    zone: [['c07_nameless_rim', 1, 22]],
    arrive: 20,
    self: [['hero', 'A barrier keyed to my own ki. If I can\'t break this, I have no business stepping into that ring.', 'neutral']],
    other: [['hero', 'There\'s a barrier across the walkway to the ring, and it has Piccolo\'s ki all over it.', 'neutral']],
    train: 'The debris creatures on the crater rim to the east make good training.',
  },
  {
    // LoG2's Trunks 30 at Dr. Gero's lab, three levels above the one he rejoins at (there 27, here 30). The side
    // chamber's Trunks 32 cache in the same mine opens on the way.
    id: 'c09_g_shaft', map: 'c09_mine', chapter: 9, character: 'trunks', level: 33,
    rect: [29, 9, 3, 1], hint: [29, 10, 3, 1],
    far: [['c09_mine', 25, 1, 14, 8]],
    rescue: [],
    save: ['c09_mine', 31, 11], saveAt: 'the save point beside the shaft',
    zone: [['c09_mine', 4, 22]],
    arrive: 30,
    self: [['hero', 'Somebody sealed the deep shaft with an energy barrier. I\'ll need more power than this to break it.', 'angry']],
    other: [['hero', 'An energy barrier seals the deep shaft. It reads like Trunks\'s ki - he\'s the one who has to break it.', 'neutral']],
    train: 'The crystal bats, rock crawlers and haywire machines of the mine make good training.',
  },
  {
    // LoG2's Vegeta 30 on the Tropical Islands: a gate for the character the story is forcing, so Black is fought a
    // level past the chapter's band start rather than at the forced floor (34 - 3). Three levels over the arrival,
    // about six minutes of fair-bot grinding at LoG2's L30-39 pace in these ruins (tests/grind.test.ts), where LoG2's
    // gates cost that bot 7 to 15.
    id: 'c10_g_courtyard', map: 'c10_lair', chapter: 10, character: 'goku', level: 35,
    rect: [14, 8, 6, 1], hint: [14, 9, 6, 1],
    // The chapter's first trip (the raid) plays in the courtyard; Black seals it behind them as they retreat.
    standsIf: 'c10_raidDone',
    far: [['c10_lair', 8, 1, 18, 7]],
    rescue: [],
    save: ['c10_lair', 18, 9], saveAt: 'the save point below the courtyard',
    zone: [['c10_lair', 16, 20], ['future_city', 41, 4]],
    arrive: 32,
    self: [['hero', 'Black sealed the courtyard with his ki. MY ki! I have to get stronger than my own body to break through...', 'angry']],
    other: [['hero', 'A barrier made of Black\'s ki - which is Goku\'s ki. Only Goku himself could tear through it.', 'angry']],
    train: 'The mutant hounds and scrap mechs in these ruins, and the machines prowling the future city, make good training.',
  },
  {
    // LoG2's Goku 40 before the Cell Games, given to the hero the finale leans on most besides Goku: Gohan leads
    // Universe 7's relays in Chapter 14, so Chapter 13 makes the player bring him back up (his Lookout training
    // lifts him to the band start - 3; the gate asks for three levels of jungle grinding on top, about eight minutes
    // of fair-bot play in tests/grind.test.ts at the jungle's L39-41 pace: two were under five).
    id: 'c13_g_north', map: 'c13_monster_jungle', chapter: 13, character: 'gohan', level: 42,
    rect: [20, 0, 4, 2], hint: [17, 1, 10, 3],
    far: ['c13_monster_camp', ['c13_monster_jungle', 20, 0, 4, 2]],
    rescue: ['c13_monster_camp', ['c13_monster_jungle', 20, 0, 4, 2]],
    save: ['c13_monster_jungle', 13, 30], saveAt: 'the save point at the south end of the jungle',
    zone: [['c13_monster_jungle', 13, 31]],
    arrive: 39,
    self: [['hero', 'A barrier that only answers to my ki. Mr. Piccolo would say I\'ve gone soft. Time to prove him wrong.', 'neutral']],
    other: [['hero', 'A barrier blocks the trail north. Its ki feels like Gohan\'s... the way Gohan felt at his best.', 'neutral']],
    train: 'The poachers and wild beasts of this jungle make good training.',
    extra: ['!done:c13_gohan', 'Gohan hasn\'t trained in years: his training with Piccolo at the Lookout will bring him most of the way back.'],
  },
];

/** The state flag a broken story gate leaves (the same one Field sets when a gate is smashed). */
export function storyGateFlag(g: StoryGate): string {
  return `gate:${g.map}:${g.id}`;
}

/** Hint script id of a story gate. */
export function storyGateHint(g: StoryGate): string {
  return `${g.id}_hint`;
}

/** First approach: the hero's reaction, the colour rule, and what to do about it right now. */
async function gateHint(s: ScriptApi, g: StoryGate): Promise<void> {
  if (s.flag(storyGateFlag(g))) return;
  const who = s.state.char(g.character);
  const name = CHARACTERS[g.character].name;
  const self = s.hero === g.character;
  await s.talk(self ? g.self : g.other);
  await s.narrate(`${GATE_COLOUR[g.character] ?? 'Coloured'} level gates answer only to ${name}. This one needs level ${g.level}.`);
  const swap = self ? '' : ` Switch to ${name} at ${g.saveAt}.`;
  if (who.joined && who.level >= g.level) {
    await s.narrate(self ? `${name} is strong enough: hit the barrier to break through!` : `${name} is already strong enough.${swap}`);
    return;
  }
  await s.narrate(`${name} is level ${who.level}.${swap} ${g.train}`);
  if (g.extra && s.check(g.extra[0])) await s.narrate(g.extra[1]);
}

/** Far-side safety net: a hero resuming beyond a closed story gate opens it behind them. */
function gateFarSide(s: ScriptApi, g: StoryGate, region?: TileRect): void {
  if (s.flag(storyGateFlag(g))) return;
  if (region) {
    const p = s.actor('hero');
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor((p.y - 8) / TILE);
    const [x, y, w, h] = region;
    if (tx < x || ty < y || tx >= x + w || ty >= y + h) return;
  }
  s.set(storyGateFlag(g));
  if (s.field.def.id !== g.map) return;
  const inst = s.field.map.gates.find((x) => x.def.id === g.id);
  if (inst && !inst.broken) s.field.map.openGate(inst);
}

for (const g of STORY_GATES) {
  const [x, y, w, h] = g.rect;
  const [hx, hy, hw, hh] = g.hint;
  registerOverlay(g.map, {
    barriers: [{ id: g.id, x, y, w, h, level: g.level, character: g.character, openIf: g.standsIf && `!${g.standsIf}` }],
    triggers: [{
      id: `${g.id}_hintT`, x: hx, y: hy, w: hw, h: hh, script: storyGateHint(g), once: true, showIf: g.standsIf, hideIf: storyGateFlag(g),
    }],
  });
  const scripts: Record<string, (s: ScriptApi) => Promise<void>> = { [storyGateHint(g)]: (s) => gateHint(s, g) };
  g.rescue.forEach((f, i) => {
    const id = `${g.id}_rescue${i}`;
    const [map, region] = typeof f === 'string' ? [f, undefined] : [f[0], f.slice(1) as TileRect];
    scripts[id] = async (s) => gateFarSide(s, g, region);
    registerOverlay(map, { onEnter: id });
  });
  registerScripts(scripts);
}
