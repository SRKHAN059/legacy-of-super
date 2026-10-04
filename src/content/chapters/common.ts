import type { CharId } from '../characters';
import type { ScriptApi } from '../../game/script';

/**
 * Canonical progression contract shared by every act. `ensureChapterState(s, n)` raises the game state to
 * what chapter `n` expects at its start (party, forms, techniques, key items, world-map spots, flags).
 * It only ever adds/raises, never removes, so it is safe to call at the top of every chapter start script.
 * This also makes each chapter playable/testable standalone.
 *
 * Levels follow LoG2: a level floor (ROM SetMinLevel) applies to the character the story is using, never to
 * the bench. In a playthrough that began with the prologue, a hand-over lifts only the hero who played the
 * chapter that just ended to the new chapter's band start (the story-boss EXP LoG2 pays at a chapter's end);
 * everyone else keeps their EXP-earned level and falls behind until rotated in. `force()` lifts a character the
 * story puts back on the field to `CHAPTER_MIN_LEVEL[chapter] - FORCED_LEVEL_GAP`.
 * A chapter started standalone (dev entry, tests, a save from before this rule) still floors the whole party.
 */

/** Minimum hero level expected at the START of each chapter (index = chapter). */
export const CHAPTER_MIN_LEVEL: readonly number[] = [6, 1, 8, 12, 15, 18, 22, 25, 29, 30, 34, 37, 40, 42, 45, 48];

/** Levels below the chapter's band start that a story-forced character is lifted to (LoG2 SetMinLevel). */
export const FORCED_LEVEL_GAP = 3;

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
  const min = chapterFloor(n);
  if (st.flag(STORY_RUN)) {
    // A real playthrough: only the hero who just finished the previous chapter is lifted; the bench is not.
    const hero = st.hero;
    if (hero.joined && hero.level < min && hero.id !== 'satan' && st.party.includes(hero)) st.join(hero.id, min);
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
