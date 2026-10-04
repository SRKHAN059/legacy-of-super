import type { CharId } from '../characters';
import type { ScriptApi } from '../../game/script';

/**
 * Canonical progression contract shared by every act. `ensureChapterState(s, n)` raises the game state to
 * what chapter `n` expects at its start (party, levels, forms, techniques, key items, world-map spots).
 * It only ever adds/raises, never removes, so it is safe to call at the top of every chapter start script.
 * This also makes each chapter playable/testable standalone.
 */

/** Minimum hero level expected at the START of each chapter (index = chapter). */
export const CHAPTER_MIN_LEVEL: readonly number[] = [6, 1, 8, 12, 15, 18, 22, 25, 29, 30, 34, 37, 40, 42, 45, 48];

interface Grant {
  join?: Array<[CharId, number]>;
  techs?: Array<[CharId, string]>;
  forms?: Array<[CharId, string]>;
  charged?: CharId[];
  items?: string[];
  spots?: string[];
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
  12: { spots: ['spot_snow'] },
  13: { forms: [['gohan', 'ultimate']], techs: [['gohan', 'kamehameha'], ['piccolo', 'hellzoneGrenade']], spots: ['spot_monster'] },
  14: { techs: [['goku', 'spiritBomb'], ['vegeta', 'finalFlash']], forms: [['vegeta', 'ssbe']] },
};

/** Raise state to the canonical start of chapter `n` (grants of every chapter < n, plus joins of n itself are left to the chapter). */
export function ensureChapterState(s: ScriptApi, n: number): void {
  const st = s.state;
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
  }
  const min = CHAPTER_MIN_LEVEL[Math.min(n, CHAPTER_MIN_LEVEL.length - 1)] ?? 1;
  for (const c of st.party) if (c.level < min && c.id !== 'satan') st.join(c.id, min);
}

/** Rank forms so upgrades never downgrade (ssj < ssg < ssb < ssbe...). */
function formRank(f: string): number {
  return ['ssj', 'unweighted', 'ssg', 'ssb', 'rage', 'ultimate', 'ssbe', 'ssbkk', 'ui'].indexOf(f);
}

/** Make `id` the forced active character for a story segment (disables switching at save points). */
export function force(s: ScriptApi, id: CharId): void {
  s.switchTo(id);
  s.set('noSwitch');
}

/** End a forced segment. */
export function unforce(s: ScriptApi): void {
  s.clear('noSwitch');
}
