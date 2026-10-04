import { registerScripts, type ScriptApi } from '../../../game/script';
import { FORMS } from '../../characters';
import { registerOverlay } from '../../registry';
import { ensureChapterState, force, unforce } from '../common';
import { bossExp, cast, clearWild, dismiss, exclusive, hide, inArena, stageBoss } from './helpers';

/**
 * CHAPTER 6 — "Golden Frieza" (Goku → Vegeta → Goku, L22-25).
 * Beats: c06_start (arrival on waste_mesa) → c06_round1 (Goku: Final Form, SSB, Golden Frieza, Sorbet's shot)
 * → c06_round2 (Vegeta: Golden Frieza, Earth destroyed, Whis's rewind, Goku's beam struggle, then the Lookout, where
 * Porunga revives Piccolo: he died shielding Gohan at the end of Chapter 5, as in the anime) → victory party on cc_yard → tell Beerus you are ready to leave (c06_party_beerus) → c07_start.
 * Side quest: c06_deserters (bronze, Jaco → waste_canyon).
 */

/** Tiles on the hub map waste_mesa (world builder B: battlefield centre (24,19), south entrance, save (19,29)). */
const MESA = {
  arrive: { x: 22, y: 27 },
  frieza: { x: 24, y: 16 },
  duel: { x: 24, y: 21 },
  sorbet: { x: 34, y: 12 },
  krillin: { x: 10, y: 19 }, tien: { x: 8, y: 20 }, roshi: { x: 9, y: 21 }, gohan: { x: 11, y: 21 }, piccolo: { x: 8, y: 22 },
  bulma: { x: 5, y: 25 }, jaco: { x: 6, y: 26 }, beerus: { x: 4, y: 27 }, whis: { x: 6, y: 27 },
  vegetaWait: { x: 28, y: 24 }, gokuDown: { x: 20, y: 22 },
} as const;

/**
 * Invisible arena wall for the Frieza duels: keeps the flight circle (14,12), the save point (19,29), the south
 * exit and the spectators out of reach while a round's fight is running.
 */
const DUEL_ARENA = { x0: 16, y0: 11, x1: 35, y1: 26 } as const;

/** cc_yard party lawn (x 6-39, rows 15-27, centre (23,21)). */
const LAWN = { arrive: { x: 23, y: 14 } } as const;

/** Kami's Lookout plaza, in front of the palace (world builder A): Piccolo's revival. */
const LOOKOUT = {
  hero: { x: 21, y: 20 }, dende: { x: 21, y: 15 }, popo: { x: 23, y: 15 }, piccolo: { x: 21, y: 17 },
  goten: { x: 19, y: 17 }, trunks: { x: 23, y: 17 }, gohan: { x: 19, y: 20 }, krillin: { x: 23, y: 20 }, bulma: { x: 24, y: 21 },
} as const;

const PRE = 'chapter==6&c06_arrived&!c06_won';

// ------------------------------------------------------------------ hub overlays
registerOverlay('waste_mesa', {
  onEnter: 'c06_mesa_enter',
  npcs: [
    { id: 'c06_m_frieza', sprite: 'frieza', x: MESA.frieza.x, y: MESA.frieza.y, dir: 'down', talk: 'c06_frieza_talk', name: 'Frieza', showIf: 'chapter==6&c06_arrived&!c06_round1' },
    { id: 'c06_m_gfrieza', sprite: 'goldenFrieza', x: MESA.frieza.x, y: MESA.frieza.y, dir: 'down', talk: 'c06_gfrieza_talk', name: 'Frieza', showIf: 'chapter==6&c06_round1&!c06_round2' },
    { id: 'c06_m_sorbet', sprite: 'sorbet', x: MESA.sorbet.x, y: MESA.sorbet.y, dir: 'left', talk: 'c06_sorbet_talk', name: 'Sorbet', showIf: 'chapter==6&c06_arrived&!c06_round1' },
    { id: 'c06_m_vegeta', sprite: 'vegeta', x: MESA.vegetaWait.x, y: MESA.vegetaWait.y, dir: 'up', talk: 'c06_vegeta_talk', name: 'Vegeta', showIf: 'chapter==6&c06_arrived&!c06_round1&!char:vegeta' },
    { id: 'c06_m_goku', sprite: 'goku', x: MESA.gokuDown.x, y: MESA.gokuDown.y, dir: 'up', talk: 'c06_goku_talk', name: 'Goku', showIf: 'chapter==6&c06_round1&!c06_round2&!char:goku' },
    { id: 'c06_m_krillin', sprite: 'krillin', x: MESA.krillin.x, y: MESA.krillin.y, dir: 'right', talk: 'c06_krillin_talk', name: 'Krillin', showIf: PRE },
    { id: 'c06_m_tien', sprite: 'tien', x: MESA.tien.x, y: MESA.tien.y, dir: 'right', talk: 'c06_tien_talk', name: 'Tien', showIf: PRE },
    { id: 'c06_m_roshi', sprite: 'roshi', x: MESA.roshi.x, y: MESA.roshi.y, dir: 'right', talk: 'c06_roshi_talk', name: 'Master Roshi', showIf: PRE },
    { id: 'c06_m_gohan', sprite: 'gohan', x: MESA.gohan.x, y: MESA.gohan.y, dir: 'right', talk: 'c06_gohan_talk', name: 'Gohan', showIf: PRE },
    // No Piccolo here: he died at the end of Chapter 5 and Goten and Trunks carried him to the Lookout (c06_start).
    { id: 'c06_m_bulma', sprite: 'bulma', x: MESA.bulma.x, y: MESA.bulma.y, dir: 'right', talk: 'c06_bulma_talk', name: 'Bulma', showIf: PRE },
    { id: 'c06_m_jaco', sprite: 'jaco', x: MESA.jaco.x, y: MESA.jaco.y, dir: 'right', talk: 'c06_jaco_talk', name: 'Jaco', showIf: PRE },
    // Beerus and Whis arrived with Goku and Vegeta at the end of Chapter 5 and watch from Bulma's corner.
    { id: 'c06_m_beerus', sprite: 'beerus', x: MESA.beerus.x, y: MESA.beerus.y, dir: 'right', talk: 'c06_beerus_talk', name: 'Beerus', showIf: PRE },
    { id: 'c06_m_whis', sprite: 'whis', x: MESA.whis.x, y: MESA.whis.y, dir: 'right', talk: 'c06_whis_talk', name: 'Whis', showIf: PRE },
  ],
  // Both rounds are `exclusive` beats: re-entering the strip mid-fight does not start a second copy.
  triggers: [
    { id: 'c06_round1T', x: 21, y: 18, w: 7, h: 2, script: 'c06_round1', showIf: 'chapter==6&c06_arrived&!c06_round1' },
    { id: 'c06_round2T', x: 21, y: 18, w: 7, h: 2, script: 'c06_round2', showIf: 'chapter==6&c06_round1&!c06_round2' },
  ],
});

// Three deserting officers for Jaco's report (bronze). One waits on the ledge reached by flight circle.
registerOverlay('waste_canyon', {
  enemies: [
    { type: 'c06_deserter', x: 14, y: 4, id: 'c06_des1', showIf: 'quest:c06_deserters', onDefeat: 'c06_deserter_down' },
    { type: 'c06_deserter', x: 26, y: 21, id: 'c06_des2', showIf: 'quest:c06_deserters', onDefeat: 'c06_deserter_down' },
    { type: 'c06_deserter', x: 38, y: 21, id: 'c06_des3', showIf: 'quest:c06_deserters', onDefeat: 'c06_deserter_down' },
  ],
});

// Victory party on the Capsule Corp lawn.
const PARTY = 'chapter==6&c06_won';
registerOverlay('cc_yard', {
  props: [
    { kind: 'counter', x: 15.5, y: 24.6, flag: PARTY }, { kind: 'table', x: 12, y: 17.6, flag: PARTY }, { kind: 'table', x: 30, y: 17.6, flag: PARTY },
    { kind: 'table', x: 21.5, y: 24, flag: PARTY }, { kind: 'jar', x: 14.2, y: 17.4, flag: PARTY }, { kind: 'barrel', x: 32.2, y: 17.2, flag: PARTY },
  ],
  npcs: [
    { id: 'c06_p_bulma', sprite: 'bulma', x: 21, y: 18, dir: 'down', talk: 'c06_party_bulma', name: 'Bulma', showIf: PARTY },
    { id: 'c06_p_beerus', sprite: 'beerus', x: 29, y: 20, dir: 'left', talk: 'c06_party_beerus', name: 'Beerus', showIf: PARTY },
    { id: 'c06_p_gohan', sprite: 'gohan', x: 11, y: 20, dir: 'right', talk: 'c06_party_gohan', name: 'Gohan', showIf: `${PARTY}&!char:gohan` },
    { id: 'c06_p_piccolo', sprite: 'piccolo', x: 9, y: 19, dir: 'right', talk: 'c06_party_piccolo', name: 'Piccolo', showIf: `${PARTY}&!char:piccolo` },
    { id: 'c06_p_chichi', sprite: 'chichi', x: 14, y: 21, dir: 'up', talk: 'c06_party_chichi', name: 'Chi-Chi', showIf: PARTY },
    { id: 'c06_p_krillin', sprite: 'krillin', x: 17, y: 22, dir: 'right', talk: 'c06_party_krillin', name: 'Krillin', showIf: PARTY },
    { id: 'c06_p_18', sprite: 'android18', x: 18, y: 23, dir: 'left', talk: 'c06_party_18', name: 'Android 18', showIf: PARTY },
    { id: 'c06_p_tien', sprite: 'tien', x: 33, y: 22, dir: 'left', talk: 'c06_party_tien', name: 'Tien', showIf: PARTY },
    { id: 'c06_p_roshi', sprite: 'roshi', x: 31, y: 23, dir: 'up', talk: 'c06_party_roshi', name: 'Master Roshi', showIf: PARTY },
    { id: 'c06_p_jaco', sprite: 'jaco', x: 35, y: 19, dir: 'left', talk: 'c06_party_jaco', name: 'Jaco', showIf: PARTY },
    { id: 'c06_p_goten', sprite: 'goten', x: 24, y: 25, dir: 'up', talk: 'c06_party_kids', name: 'Goten', showIf: PARTY, wander: 2 },
    { id: 'c06_p_trunks', sprite: 'trunksKid', x: 26, y: 25, dir: 'up', talk: 'c06_party_kids', name: 'Trunks', showIf: PARTY, wander: 2 },
    { id: 'c06_p_vegeta', sprite: 'vegeta', x: 31, y: 16, dir: 'down', talk: 'c06_party_vegeta', name: 'Vegeta', showIf: `${PARTY}&!char:vegeta` },
    { id: 'c06_p_goku', sprite: 'goku', x: 18, y: 19, dir: 'down', talk: 'c06_party_goku', name: 'Goku', showIf: `${PARTY}&!char:goku` },
  ],
});

/** Reload the current map at the hero's tile so overlay NPCs/triggers reflect flags set during a cutscene. */
async function reload(s: ScriptApi, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right' = 'up'): Promise<void> {
  await s.warp(s.field.def.id, x, y, dir);
}

registerScripts({
  // ================================================================== beat 1: Frieza's welcome
  // Chapter 5's last beat already lands Goku, Vegeta, Whis and Beerus on the mesa; this picks up right after.
  c06_start: async (s) => {
    ensureChapterState(s, 6);
    await s.chapter(6, 'Golden Frieza', 'Revenge from Hell');
    force(s, 'goku');
    await s.warp('waste_mesa', MESA.arrive.x, MESA.arrive.y, 'up');
    s.letterbox(true);
    s.music('frieza');
    clearWild(s);
    cast(s, 'c06_frieza', 'frieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    const soldiers: Array<[string, string, number, number]> = [
      ['c06_s1', 'frizaSoldier', 20, 14], ['c06_s2', 'frizaSoldierB', 28, 14], ['c06_s3', 'frizaSoldierC', 21, 12], ['c06_s4', 'frizaElite', 27, 12],
    ];
    for (const [id, sp, x, y] of soldiers) cast(s, id, sp, x, y, 'down', 'Soldier');
    cast(s, 'c06_m_sorbet', 'sorbet', MESA.sorbet.x, MESA.sorbet.y, 'left', 'Sorbet');
    cast(s, 'c06_m_krillin', 'krillin', MESA.krillin.x, MESA.krillin.y, 'right', 'Krillin');
    cast(s, 'c06_m_tien', 'tien', MESA.tien.x, MESA.tien.y, 'right', 'Tien');
    cast(s, 'c06_m_roshi', 'roshi', MESA.roshi.x, MESA.roshi.y, 'right', 'Master Roshi');
    cast(s, 'c06_m_gohan', 'gohan', MESA.gohan.x, MESA.gohan.y, 'right', 'Gohan');
    cast(s, 'c06_m_piccolo', 'piccolo', MESA.piccolo.x, MESA.piccolo.y, 'right', 'Piccolo');
    cast(s, 'c06_vegeta', 'vegeta', MESA.arrive.x + 2, MESA.arrive.y, 'up', 'Vegeta');
    cast(s, 'c06_m_beerus', 'beerus', MESA.beerus.x, MESA.beerus.y, 'right', 'Beerus');
    cast(s, 'c06_m_whis', 'whis', MESA.whis.x, MESA.whis.y, 'right', 'Whis');
    s.pose('c06_m_piccolo', 'ko');
    s.pose('c06_m_gohan', 'hurt');
    // Frieza's beam went through Piccolo's heart (end of Chapter 5): he dies here, as in the anime (ep 22).
    await s.pan(MESA.piccolo.x + 3, MESA.piccolo.y - 1, 50);
    await s.talk([
      ['gohan', 'Mr. Piccolo... come on, open your eyes. Please!', 'hurt'],
      ['krillin', 'Gohan... he\'s not breathing. That beam went straight through his heart. Piccolo\'s... gone.', 'sad'],
      ['gohan', 'He died protecting me. Again. Because I let myself get weak.', 'sad'],
    ]);
    // Goten and Trunks, hiding since Gotenks's headbutt, carry the body to the Lookout.
    cast(s, 'c06_goten', 'goten', MESA.piccolo.x - 4, MESA.piccolo.y - 4, 'right', 'Goten');
    cast(s, 'c06_trunks', 'trunksKid', MESA.piccolo.x - 3, MESA.piccolo.y - 4, 'right', 'Trunks');
    await s.walkAll([
      ['c06_goten', MESA.piccolo.x - 1, MESA.piccolo.y, 2],
      ['c06_trunks', MESA.piccolo.x + 1, MESA.piccolo.y, 2],
    ]);
    await s.talk([
      ['trunksKid', 'Gohan! We saw everything from behind the rocks!', 'shock'],
      ['goten', 'Big brother... Mr. Piccolo isn\'t moving.', 'sad'],
      ['gohan', 'Goten, Trunks: take Mr. Piccolo up to the Lookout. Dende will know what to do. Fly low and don\'t stop for anything.', 'sad'],
      ['trunksKid', 'Got it. Come on, Goten, grab his legs!', 'neutral'],
    ]);
    // The boys lift the body between them and fly off to the north-west.
    const away = { x: MESA.piccolo.x - 6, y: MESA.piccolo.y - 11 };
    await Promise.all([s.lift('c06_m_piccolo', 12, 10), s.lift('c06_goten', 12, 10), s.lift('c06_trunks', 12, 10)]);
    await s.walkAll([
      ['c06_goten', away.x - 1, away.y, 2.5],
      ['c06_m_piccolo', away.x, away.y, 2.5],
      ['c06_trunks', away.x + 1, away.y, 2.5],
    ]);
    dismiss(s, 'c06_goten', 'c06_trunks', 'c06_m_piccolo');
    await s.say('goku', 'Piccolo... Frieza, you\'re gonna pay for that.', 'angry');
    await s.pan(24, 17, 30);
    await s.talk([
      ['frieza', 'Do you know how I spent my years in Hell, Goku? Bound in a cocoon while cherubs sang and stuffed animals danced around me. Every. Single. Day.', 'angry'],
      ['frieza', 'So when I came back, I trained. Four whole months, for this day.', 'smirk'],
      ['goku', 'Four months? That\'s it? Huh. Must be nice being a genius.', 'neutral'],
      ['frieza', 'Allow me to clean up first. Soldiers who failed me are such clutter.', 'smirk'],
    ]);
    await s.powerUp('c06_frieza', '#e050e0', 40);
    for (const [id] of soldiers) {
      await s.blast('c06_frieza', id, '#e050e0');
      s.remove(id);
    }
    await s.talk([
      ['sorbet', 'L-Lord Frieza! I am still loyal! Completely loyal!', 'shock'],
      ['frieza', 'Of course you are, Sorbet. Stay close to that ring of yours and be useful.', 'smirk'],
    ]);
    s.follow();
    await s.talk([
      ['vegeta', 'Kakarot. I\'m taking him.', 'angry'],
      ['goku', 'No way! I called dibs on Frieza back on Beerus\'s planet!', 'angry'],
      ['vegeta', 'Then we settle it like warriors. Rock, paper, scissors.', 'smirk'],
    ]);
    const pick = await s.ask('goku', 'Rock... paper...', ['Rock!', 'Paper!', 'Scissors!']);
    const vegetaThrow = ['scissors', 'rock', 'paper'][pick];
    await s.talk([
      ['vegeta', `I threw ${vegetaThrow}?! Impossible! Best of... no. A prince keeps his word.`, 'shock'],
      ['goku', 'Heh heh! Don\'t worry, I\'ll leave some for you!', 'happy'],
      ['frieza', 'You decide my opponent with a children\'s game. I will make you regret that.', 'angry'],
    ]);
    s.set('c06_arrived');
    await s.quest('c06_frieza');
    s.letterbox(false);
    await reload(s, MESA.arrive.x, MESA.arrive.y, 'up');
    await s.narrate('Talk to your friends or save at the save point, then walk up to Frieza when you are ready.');
  },

  /** Poses for the wounded on the mesa (overlay NPCs cannot carry a pose). */
  c06_mesa_enter: async (s) => {
    if (!s.check('chapter==6&c06_arrived&!c06_won')) return;
    if (s.exists('c06_m_gohan')) s.pose('c06_m_gohan', 'hurt');
    if (s.exists('c06_m_goku')) s.pose('c06_m_goku', 'hurt');
  },

  // ================================================================== beat 2: Goku vs Frieza
  c06_round1: exclusive('c06_round1', async (s) => {
    if (!s.check('chapter==6&c06_arrived&!c06_round1')) return;
    force(s, 'goku');
    s.letterbox(true);
    s.music('frieza');
    clearWild(s);
    dismiss(s, 'c06_m_vegeta', 'c06_m_sorbet');
    cast(s, 'c06_m_frieza', 'frieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    await s.walk('hero', MESA.duel.x, MESA.duel.y, 1.2);
    s.face('hero', 'up');
    await s.talk([
      ['frieza', 'This is my final form, Goku. No more transformations, no more holding back.', 'smirk'],
      ['goku', 'Good! Then don\'t blame the training when you lose.', 'smirk'],
    ]);
    s.remove('c06_m_frieza');
    s.letterbox(false);
    const r1 = await inArena(s, s.fight('c06_frieza', { x: MESA.frieza.x, y: MESA.frieza.y, uid: 'c06_friezaF' }), DUEL_ARENA);
    bossExp(s, 'c06_frieza', r1);
    s.letterbox(true);
    cast(s, 'c06_friezaF', 'frieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    s.place('hero', MESA.duel.x, MESA.duel.y, 'up');
    await s.talk([
      ['frieza', 'Heh... heh heh. You\'ve improved. So have I. Shall we stop pretending?', 'smirk'],
      ['goku', 'Sure. Whis taught me something new. Watch closely, Frieza.', 'neutral'],
    ]);
    await s.powerUp('hero', '#40c0f8', 50);
    await s.setForm('goku', 'ssb');
    s.transformNow('ssb');
    await s.talk([
      ['frieza', 'Blue hair? What is this ridiculous colour?', 'shock'],
      ['goku', 'A Super Saiyan with the power of a god. Super Saiyan God Super Saiyan! Bit of a mouthful, huh?', 'smirk'],
      ['frieza', 'Then let me show you the fruit of MY training. A form beyond the final form!', 'angry'],
    ]);
    await s.powerUp('c06_friezaF', '#f8d040', 70);
    s.sprite('c06_friezaF', 'goldenFrieza');
    s.shake(30, 3);
    s.flash('#f8e080', 16);
    await s.talk([
      ['frieza', 'Golden Frieza. Beautiful, isn\'t it? Your blue looks positively drab beside me.', 'smirk'],
      ['goku', 'Whoa. Okay, this is gonna be fun!', 'happy'],
    ]);
    // Beerus and Whis watch from the sidelines.
    cast(s, 'c06_m_beerus', 'beerus', MESA.beerus.x, MESA.beerus.y, 'right', 'Beerus');
    cast(s, 'c06_m_whis', 'whis', MESA.whis.x, MESA.whis.y, 'right', 'Whis');
    await s.pan(7, 25, 30);
    await s.talk([
      ['beerus', 'I\'m not lifting a finger. If Earth\'s food is in danger, that\'s their problem. Pass the pudding.', 'neutral'],
      ['whis', 'Such a dazzling gold. Although... his breathing is already rather heavy.', 'smirk'],
    ]);
    s.follow();
    await s.narrate('Golden Frieza never trained to hold this form, so it drains his stamina every second. Survive his onslaught and wear him down!');
    s.remove('c06_friezaF');
    s.letterbox(false);
    const r2 = await inArena(s, s.fight('c06_goldenFrieza', { x: MESA.frieza.x, y: MESA.frieza.y, uid: 'c06_goldenF' }), DUEL_ARENA);
    bossExp(s, 'c06_goldenFrieza', r2);
    s.letterbox(true);
    cast(s, 'c06_goldenF', 'goldenFrieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    s.place('hero', MESA.duel.x, MESA.duel.y, 'up');
    s.pose('c06_goldenF', 'hurt');
    await s.talk([
      ['frieza', 'Why... why is my body so heavy?! I am perfect! I am GOLDEN!', 'hurt'],
      ['goku', 'You picked up all that power in four months, but you never learned to carry it. It\'s over, Frieza.', 'neutral'],
    ]);
    s.transformNow(null);
    await s.talk([
      ['goku', 'Go back where you came from and don\'t come back. We\'re done here.', 'neutral'],
      ['frieza', 'Done? Yes... yes, we are done. Sorbet. NOW.', 'smirk'],
    ]);
    // Sorbet's ring laser.
    cast(s, 'c06_sorbetGun', 'sorbet', MESA.sorbet.x, MESA.sorbet.y, 'left', 'Sorbet');
    await s.pan(30, 17, 24);
    await s.blast('c06_sorbetGun', 'hero', '#f04040');
    s.flash('#f84040', 18);
    s.shake(24, 3);
    s.pose('hero', 'ko');
    await s.talk([
      ['krillin', 'GOKU!', 'shock'],
      ['sorbet', 'A direct hit! Ha... haha! The ring laser works, my lord!', 'happy'],
      ['frieza', 'Never turn your back on me, monkey. Now hold still for your final lesson.', 'smirk'],
    ]);
    // Krillin dashes in with a senzu; Frieza fires; Vegeta deflects the Death Beam into Sorbet.
    cast(s, 'c06_m_krillin', 'krillin', MESA.krillin.x, MESA.krillin.y, 'right', 'Krillin');
    s.follow();
    await s.walk('c06_m_krillin', MESA.duel.x - 2, MESA.duel.y + 1, 2.4);
    await s.say('frieza', 'The bald one first, then.', 'smirk');
    cast(s, 'c06_vegetaSave', 'vegeta', MESA.duel.x + 3, MESA.duel.y + 3, 'up', 'Vegeta');
    await s.walk('c06_vegetaSave', MESA.duel.x - 1, MESA.duel.y - 1, 4);
    s.flash('#ffffff', 8);
    s.sfx('block');
    await s.blast('c06_vegetaSave', 'c06_sorbetGun', '#e050e0');
    s.pose('c06_sorbetGun', 'ko');
    s.shake(16, 2);
    await s.talk([
      ['sorbet', 'Gwaaah! L-Lord Frieza...', 'hurt'],
      ['frieza', 'A shame. He was the only one who knew where I keep my good armor.', 'neutral'],
      ['vegeta', 'Krillin. Feed that clown his senzu. I have business with the lizard.', 'angry'],
    ]);
    s.remove('c06_sorbetGun');
    await s.say('krillin', 'Eat up, Goku! My very last senzu. I kept it in my sock. Don\'t ask.', 'happy');
    s.pose('hero', 'hurt');
    await s.say('goku', 'Ugh... thanks, Krillin. Vegeta... careful. He\'s getting tired, but he\'s sneaky.', 'hurt');
    // Hand-over to Vegeta.
    await s.fadeOut(20);
    s.pose('hero', null);
    force(s, 'vegeta');
    dismiss(s, 'c06_vegetaSave', 'c06_goldenF');
    s.set('c06_round1');
    s.heal();
    s.letterbox(false);
    await reload(s, MESA.duel.x, MESA.duel.y + 2, 'up');
    await s.talk([
      ['vegeta', 'You trained for four months, Frieza. I trained under an angel. Let\'s compare notes.', 'smirk'],
    ]);
    await s.narrate('Vegeta takes over! Save if you need to, then face Golden Frieza.');
  }),

  // ================================================================== beat 3: Vegeta, the end of Earth, the rewind
  c06_round2: exclusive('c06_round2', async (s) => {
    if (!s.check('chapter==6&c06_round1&!c06_round2')) return;
    force(s, 'vegeta');
    s.letterbox(true);
    s.music('frieza');
    clearWild(s);
    cast(s, 'c06_m_gfrieza', 'goldenFrieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    await s.walk('hero', MESA.duel.x, MESA.duel.y, 1.2);
    s.face('hero', 'up');
    await s.talk([
      ['frieza', 'The prince. You understand I am only letting Goku rest so I can kill him properly later?', 'smirk'],
      ['vegeta', 'Hmph. You talk too much for a man who is out of breath.', 'smirk'],
    ]);
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 40);
    await s.say('frieza', 'You too?! Is blue hair handed out on Beerus\'s planet like candy?!', 'shock');
    // The form unlocks at its story reveal (LoG2). setForm reverts an active form, so re-apply the blue at once.
    await s.setForm('vegeta', 'ssb', true);
    s.transformNow('ssb');
    s.sfx('powerUp');
    await s.narrate(`Vegeta has achieved ${FORMS.ssb.name}! Select Z with L, then press B when the triangle is full.`);
    await s.learn('vegeta', 'galickGun');
    s.remove('c06_m_gfrieza');
    s.letterbox(false);
    // Frieza keeps the damage from Goku's fight (LoG2-style carried-over HP).
    stageBoss(s, 'c06_goldenFrieza2', MESA.frieza.x, MESA.frieza.y, 'c06_goldenF2', 0.85);
    const r = await inArena(s, s.fight('c06_goldenFrieza2', { uid: 'c06_goldenF2', existing: true }), DUEL_ARENA);
    bossExp(s, 'c06_goldenFrieza2', r);
    s.letterbox(true);
    cast(s, 'c06_goldenF2', 'goldenFrieza', MESA.frieza.x, MESA.frieza.y, 'down', 'Frieza');
    s.place('hero', MESA.duel.x, MESA.duel.y, 'up');
    s.pose('c06_goldenF2', 'hurt');
    await s.talk([
      ['vegeta', 'On your knees. This is for my father, for my planet, and for every insult I swallowed in your army.', 'angry'],
      ['frieza', 'You... will never... beat me...', 'hurt'],
    ]);
    s.sprite('c06_goldenF2', 'frieza');
    await s.lift('c06_goldenF2', 40, 24);
    await s.talk([
      ['frieza', 'If I can\'t have my revenge, then NO ONE will have this miserable planet!', 'angry'],
      ['vegeta', 'Stop! You coward!', 'shock'],
    ]);
    await s.powerUp('c06_goldenF2', '#e050e0', 50);
    s.shake(60, 4);
    s.boom(MESA.duel.x, MESA.duel.y, 40, '#f8f8f8');
    await s.fadeOut(40, '#ffffff');
    s.set('c06_earthGone');
    await s.warp('c06_void', 11, 8, 'up');
    // ---------------------------------------------------------------- the void
    s.letterbox(true);
    s.music('sad');
    cast(s, 'c06_v_whis', 'whis', 10, 6, 'down', 'Whis');
    cast(s, 'c06_v_beerus', 'beerus', 12, 6, 'down', 'Beerus');
    cast(s, 'c06_v_bulma', 'bulma', 9, 8, 'right', 'Bulma');
    cast(s, 'c06_v_jaco', 'jaco', 13, 9, 'left', 'Jaco');
    cast(s, 'c06_v_goku', 'goku', 14, 8, 'left', 'Goku');
    cast(s, 'c06_v_frieza', 'frieza', 19, 3, 'left', 'Frieza');
    s.pose('c06_v_goku', 'hurt');
    await s.lift('c06_v_frieza', 10, 10);
    await s.narrate('...');
    await s.talk([
      ['vegeta', 'The Earth... it\'s gone. Just... gone.', 'shock'],
      ['bulma', 'Vegeta! Over here! Whis put up some kind of bubble!', 'sad'],
      ['vegeta', 'Bulma! You\'re alive... Hmph. Of course you are. You\'re too stubborn not to be.', 'sad'],
      ['jaco', 'Everyone else... the planet, the people, the entire rest of the Earth...', 'sad'],
      ['frieza', 'HOHOHO! Look at you, drifting in a soap bubble! I can breathe in space, you know. Can you?', 'smirk'],
      ['beerus', 'Whis. Earth had pudding. And ramen. And those little fried octopus balls.', 'angry'],
      ['whis', 'Yes, yes. I can turn time back three minutes. Only three, mind you.', 'neutral'],
      ['whis', 'Goku. This time, no speeches. No mercy. Finish it the moment you can.', 'neutral'],
      ['goku', '...Got it. I won\'t make the same mistake twice.', 'angry'],
    ]);
    await s.powerUp('c06_v_whis', '#a8e0ff', 40);
    s.tint('rgba(160,200,255,0.35)');
    s.sfx('teleport');
    await s.narrate('Whis taps his staff. The stars wheel backwards, and the universe unwinds three minutes...');
    s.tint(null);
    await s.fadeOut(30, '#ffffff');
    // ---------------------------------------------------------------- three minutes earlier
    s.clear('c06_earthGone');
    s.set('c06_round2');
    force(s, 'goku');
    await s.warp('waste_mesa', MESA.duel.x, MESA.duel.y, 'up');
    s.letterbox(true);
    s.music('frieza');
    clearWild(s);
    s.transformNow('ssb');
    cast(s, 'c06_f_frieza', 'frieza', MESA.frieza.x, MESA.frieza.y - 2, 'down', 'Frieza');
    cast(s, 'c06_f_vegeta', 'vegetaSSB', MESA.duel.x + 3, MESA.duel.y - 1, 'up', 'Vegeta');
    await s.lift('c06_f_frieza', 40, 10);
    await s.talk([
      ['frieza', 'If I can\'t have my revenge, then NO ONE will have this miserable plan--', 'angry'],
      ['goku', 'Not this time, Frieza! KA... ME... HA... ME...', 'shout'],
    ]);
    await s.beamStruggle('gokuSSB', 'frieza', '#70c8f8', '#e050e0', [
      'Frieza: You?! How are you on your feet?!',
      'Goku: Whis gave me a second chance. You don\'t get one!',
      'Frieza: I am the emperor of the universe!',
      'Goku: HAAAAAAAA!',
    ], 0.22);
    s.flash('#ffffff', 20);
    s.boom(MESA.frieza.x, MESA.frieza.y - 2, 36, '#70c8f8');
    s.remove('c06_f_frieza');
    s.shake(30, 3);
    await s.narrate('The Kamehameha swallows Frieza whole. For the second time, the emperor is sent back to Hell.');
    s.transformNow(null);
    // ---------------------------------------------------------------- aftermath: Piccolo revived at the Lookout
    // Whis's rewind only undid three minutes; Piccolo died long before that (anime eps 22, 25 and 27).
    cast(s, 'c06_m_gohan', 'gohan', MESA.gohan.x, MESA.gohan.y, 'right', 'Gohan');
    cast(s, 'c06_m_whis', 'whis', MESA.whis.x, MESA.whis.y, 'right', 'Whis');
    s.pose('c06_m_gohan', null);
    await s.talk([
      ['vegeta', 'Tch. You stole my kill. Again.', 'angry'],
      ['goku', 'Sorry, Vegeta. Whis said no hesitating.', 'neutral'],
    ]);
    await s.pan(MESA.gohan.x - 2, MESA.gohan.y + 2, 40);
    await s.talk([
      ['gohan', 'You did it, Dad. It\'s over. ...But Mr. Piccolo...', 'sad'],
      ['goku', 'Whis, can\'t you turn back time a little more? Enough for Piccolo too?', 'sad'],
      ['whis', 'I am sorry. Three minutes is all I can undo, and Mr. Piccolo fell long before that.', 'sad'],
      ['gohan', 'Turn back... time?', 'shock'],
      ['goku', 'Long story! Hey, don\'t give up yet. Goten and Trunks took him up to the Lookout, right? Everybody, grab on!', 'neutral'],
    ]);
    s.follow();
    s.sfx('teleport');
    s.flash('#ffffff', 10);
    await s.warp('lookout', LOOKOUT.hero.x, LOOKOUT.hero.y, 'up');
    s.letterbox(true);
    s.music('sad');
    hide(s, 'ea_lk_popo');
    cast(s, 'c06_l_dende', 'dende', LOOKOUT.dende.x, LOOKOUT.dende.y, 'down', 'Dende');
    cast(s, 'c06_l_popo', 'mrPopo', LOOKOUT.popo.x, LOOKOUT.popo.y, 'down', 'Mr. Popo');
    cast(s, 'c06_l_piccolo', 'piccolo', LOOKOUT.piccolo.x, LOOKOUT.piccolo.y, 'down', 'Piccolo');
    cast(s, 'c06_l_goten', 'goten', LOOKOUT.goten.x, LOOKOUT.goten.y, 'right', 'Goten');
    cast(s, 'c06_l_trunks', 'trunksKid', LOOKOUT.trunks.x, LOOKOUT.trunks.y, 'left', 'Trunks');
    cast(s, 'c06_l_gohan', 'gohan', LOOKOUT.gohan.x, LOOKOUT.gohan.y, 'up', 'Gohan');
    cast(s, 'c06_l_krillin', 'krillin', LOOKOUT.krillin.x, LOOKOUT.krillin.y, 'up', 'Krillin');
    cast(s, 'c06_l_bulma', 'bulma', LOOKOUT.bulma.x, LOOKOUT.bulma.y, 'up', 'Bulma');
    s.pose('c06_l_piccolo', 'ko');
    await s.pan(LOOKOUT.piccolo.x, LOOKOUT.piccolo.y + 1, 30);
    await s.talk([
      ['trunksKid', 'Mr. Goku! We flew him all the way up here, just like Gohan said!', 'sad'],
      ['dende', 'Our own Dragon Balls are still stone after the wish that brought Frieza back. So I called out to New Namek.', 'neutral'],
      ['dende', 'The Namekians have gathered their Dragon Balls. Porunga is rising right now. Hold on, Piccolo...', 'sad'],
    ]);
    s.tint('rgba(20,30,60,0.45)');
    s.sfx('charge');
    await s.narrate('Far across the galaxy, the sky over New Namek turns black. The great dragon Porunga hears the Namekians\' wish: bring Piccolo back to life.');
    s.tint(null);
    s.flash('#f8f0a0', 16);
    s.sfx('powerUp');
    s.aura('c06_l_piccolo', '#f8f0a0');
    await s.wait(30);
    s.aura('c06_l_piccolo', null);
    s.pose('c06_l_piccolo', null);
    s.set('c06_piccoloRevived');
    s.music('victory');
    await s.talk([
      ['piccolo', '...Ugh. Gohan. You got sloppy. You let a two-bit tyrant push you around.', 'angry'],
      ['gohan', 'Mr. Piccolo! ...You\'re right. I got comfortable. Will you train me again? For real this time?', 'sad'],
      ['piccolo', 'Hmph. Don\'t make me regret it. We start when your daughter can walk.', 'smirk'],
      ['goten', 'Yay! Mr. Piccolo\'s back!', 'happy'],
      ['bulma', 'Okay, enough near-death experiences for one day! Party at Capsule Corp tonight! Everybody\'s invited!', 'happy'],
      ['goku', 'Beerus is gonna ask if there\'s pudding.', 'happy'],
      ['bulma', 'There will be SO much pudding.', 'happy'],
    ]);
    s.follow();
    s.set('c06_won');
    await s.done('c06_frieza', false);
    s.heal();
    await s.fadeOut(30);
    unforce(s);
    await s.narrate('That evening, at Capsule Corporation...');
    await s.warp('cc_yard', LAWN.arrive.x, LAWN.arrive.y, 'down');
    s.music('peaceful');
    await s.quest('c06_party');
    if (s.exists('c06_p_bulma')) {
      await s.talk([
        ['c06_p_bulma', 'Here\'s to Earth! Still here, thanks to some very rude Saiyans and one very polite angel!', 'happy'],
      ]);
    }
    await s.narrate('Talk to everyone at the party. When you are ready to move on, speak to Beerus.');
  }),

  // ================================================================== mesa NPCs
  c06_frieza_talk: async (s) => {
    if (s.check('chapter==6&c06_arrived&!c06_round1')) {
      const c = await s.ask('frieza', 'Have you finished saying goodbye to your friends, monkey?', ['Let\'s fight!', 'Not yet']);
      if (c === 0) await s.call('c06_round1');
      else await s.say('frieza', 'Take your time. I have waited in Hell for years. I can wait a few more minutes.', 'smirk');
      return;
    }
    await s.say('frieza', 'Hmph.', 'neutral');
  },
  c06_gfrieza_talk: async (s) => {
    if (s.check('chapter==6&c06_round1&!c06_round2')) {
      const c = await s.ask('frieza', 'Well, prince? Are you going to stare at my golden glory all day?', ['Fight!', 'Not yet']);
      if (c === 0) await s.call('c06_round2');
      else await s.say('frieza', '*pant* ...Take your time. I am... savoring this.', 'hurt');
      return;
    }
    await s.say('frieza', 'Hmph.', 'neutral');
  },
  c06_sorbet_talk: async (s) => {
    await s.talk([
      ['sorbet', 'D-don\'t look at me! I\'m just a humble commander! This ring on my finger? Jewellery! Purely decorative!', 'shock'],
    ]);
  },
  c06_vegeta_talk: async (s) => {
    await s.say('vegeta', 'You won a children\'s game, Kakarot. Don\'t embarrass me by losing the real one.', 'angry');
  },
  c06_goku_talk: async (s) => {
    await s.talk([
      ['goku', 'Ow... that laser went right through me. I\'m okay now, but I let my guard down. Whis is gonna be so mad.', 'hurt'],
      ['goku', 'He\'s tired, Vegeta. Keep the pressure on and don\'t let him catch his breath!', 'neutral'],
    ]);
  },
  c06_krillin_talk: async (s) => {
    if (s.check('c06_round1')) {
      await s.say('krillin', 'I\'m out of senzu beans. Goku got the emergency sock one. Go get him, Vegeta!', 'happy');
      return;
    }
    await s.talk([
      ['krillin', 'Goku! Frieza killed his own army just to show off. And he\'s still smiling.', 'shock'],
      ['krillin', 'I\'ve got a senzu or two left. If things go bad, I\'ll be right there. Probably. Maybe.', 'sad'],
    ]);
  },
  c06_tien_talk: async (s) => {
    await s.say('tien', s.check('c06_round1')
      ? 'That gold form burns through his energy. I can see it from here. He\'s breathing like a man who ran up a mountain.'
      : 'Four months of training and he\'s this strong. Imagine what that monster could do with discipline.', 'neutral');
  },
  c06_roshi_talk: async (s) => {
    await s.say('roshi', s.check('c06_round1')
      ? 'Bah! In my day we were happy to have one kind of Super Saiyan. Now they come in colours.'
      : 'I used my Max Power on those soldiers. My back will never forgive me. Win this so I can go lie down, Goku.', 'neutral');
  },
  c06_gohan_talk: async (s) => {
    await s.talk([
      ['gohan', 'I got rusty. I froze up, and Mr. Piccolo died for it. Goten and Trunks took him to the Lookout.', 'sad'],
      ['gohan', s.check('c06_round1') ? 'Vegeta, please... finish this.' : 'Dad, please... finish this.', 'hurt'],
    ]);
  },
  c06_bulma_talk: async (s) => {
    await s.talk([
      ['bulma', 'Hey! Eyes on Frieza, not on me! I\'ve got my camera and a fully charged capsule bunker. I\'m fine!', 'angry'],
      ['bulma', 'Jaco says some of Frieza\'s officers ran off into the canyon south of here. He wants them for some report.', 'neutral'],
    ]);
  },
  c06_jaco_talk: async (s) => {
    if (s.check('done:c06_deserters')) {
      await s.say('jaco', 'My report is filed! The Galactic Patrol will finally have to admit I\'m an elite!', 'happy');
      return;
    }
    if (s.check('quest:c06_deserters')) {
      await s.say('jaco', `Three deserters, three badges! You have ${s.count('c06_badge')} so far. The canyon is south of the mesa.`, 'neutral');
      return;
    }
    await s.talk([
      ['jaco', 'Galactic Patrolman Jaco, reporting! Three Frieza Force officers fled into the canyon with the army payroll!', 'shout'],
      ['jaco', 'I\'d arrest them myself, but... my ship needs me. Very badly. Could you bring me their rank badges?', 'sad'],
    ]);
    await s.quest('c06_deserters');
  },
  c06_beerus_talk: async (s) => {
    await s.talk([
      ['beerus', 'Don\'t look at me. I\'m on vacation. If the planet explodes, that\'s your fault.', 'neutral'],
      ['beerus', '...Although if it explodes before I finish this pudding, I\'ll be very upset.', 'angry'],
    ]);
  },
  c06_whis_talk: async (s) => {
    if (!s.check('c06_round1')) {
      await s.talk([
        ['whis', 'Frieza\'s power has grown remarkably in four months. Raw talent, and not a shred of discipline.', 'neutral'],
        ['whis', 'Do try not to show off, Goku. An opponent like that waits for exactly one opening.', 'smirk'],
      ]);
      return;
    }
    await s.talk([
      ['whis', 'Golden Frieza has tremendous power, but no stamina. A form you have not mastered is a form that masters you.', 'smirk'],
      ['whis', 'Do remember that, Vegeta. Goku certainly did not.', 'neutral'],
    ]);
  },

  // ================================================================== boss phase taunts (banners only, the fight keeps flowing)
  c06_frieza_phase2: async (s) => {
    s.banner('Frieza: "Enough warming up!"');
    s.sfx('powerUp');
  },
  c06_golden_tired: async (s) => {
    s.banner('Golden Frieza is gasping for breath!');
    s.sfx('charge');
  },

  /** Deserter officer defeated in waste_canyon (bronze quest; turns itself in automatically). */
  c06_deserter_down: async (s) => {
    if (!s.check('quest:c06_deserters')) return;
    await s.give('c06_badge');
    if (s.count('c06_badge') < 3) return;
    s.take('c06_badge', 3);
    await s.narrate('Your scouter crackles. "Three badges! Excellent work! I\'ll file this under my name, of course!" - Jaco');
    await s.done('c06_deserters', false);
    await s.give('pow3');
  },

  // ================================================================== party NPCs (cc_yard)
  c06_party_bulma: async (s) => {
    if (!s.check('chapter==6&c06_won')) { await s.say('bulma', 'Party\'s over! Well, until the next one.', 'happy'); return; }
    await s.talk([
      ['bulma', 'We nearly lost the whole planet today and Beerus is on his fourth bowl of pudding. Life with gods, huh?', 'happy'],
      ['bulma', 'Eat something! The caterers made enough for a Saiyan army. Which is lucky, because we have one.', 'smirk'],
    ]);
  },
  c06_party_beerus: async (s) => {
    if (!s.check('chapter==6&c06_won')) {
      await s.say('beerus', 'This pudding was worth rewinding time for. Remember that, Saiyans: I saved your planet for dessert.', 'smirk');
      return;
    }
    await s.talk([
      ['beerus', 'This pudding was worth rewinding time for. Remember that, Saiyans: I saved your planet for dessert.', 'smirk'],
      ['beerus', 'Whis. Tell them what happens next.', 'neutral'],
      ['whis', 'Gladly. Goku, you were shot because you showed off and let your guard down. Vegeta, you let Frieza destroy the Earth because you wanted to savour your revenge.', 'neutral'],
      ['whis', 'Starting tomorrow you will both train on Lord Beerus\'s planet in weighted clothing. Very heavy weighted clothing.', 'smirk'],
    ]);
    const c = await s.ask('beerus', 'Well? Are we leaving or not? The pudding is gone.', ['Let\'s go', 'One more plate first']);
    if (c !== 0) { await s.say('beerus', 'Fine. Five minutes. Then I destroy the buffet table.', 'angry'); return; }
    await s.done('c06_party', false);
    await s.give('senzu');
    await s.fadeOut(30);
    if (s.hasScript('c07_start')) await s.call('c07_start');
  },
  c06_party_gohan: async (s) => {
    await s.talk([
      ['gohan', 'Videl took Pan home to sleep. I told her I\'d be training with Piccolo again. She laughed... then said "good."', 'happy'],
      ['gohan', 'I never want to freeze up like that again. Next time, I\'ll be the one protecting everyone.', 'neutral'],
    ]);
  },
  c06_party_piccolo: async (s) => {
    await s.say('piccolo', 'This morning I was dead. Tonight there\'s a paper hat on my head. I\'m not sure which is worse.', 'angry');
  },
  c06_party_chichi: async (s) => {
    await s.talk([
      ['chichi', 'Goku got shot through the chest and he\'s already on his third plate. That man!', 'angry'],
      ['chichi', 'Make sure he eats his vegetables too. Even world-savers need vegetables.', 'neutral'],
    ]);
  },
  c06_party_krillin: async (s) => {
    await s.talk([
      ['krillin', 'I faced Frieza today and didn\'t run. Okay, I ran a little. But I ran TOWARDS him!', 'happy'],
      ['krillin', 'Note to self: always keep a senzu in your sock.', 'smirk'],
    ]);
  },
  c06_party_18: async (s) => {
    await s.say('android18', 'Krillin keeps telling the story about the senzu in his sock. It gets longer every time.', 'smirk');
  },
  c06_party_tien: async (s) => {
    await s.say('tien', 'Goku and Vegeta are on another level now. Still... one day I\'ll stand next to them again. Chiaotzu says hi.', 'neutral');
  },
  c06_party_roshi: async (s) => {
    await s.say('roshi', 'Ho ho! Free food, beautiful scenery and nobody trying to destroy the planet for at least an hour. This is the life!', 'happy');
  },
  c06_party_jaco: async (s) => {
    if (!s.check('done:c06_deserters') && !s.check('quest:c06_deserters')) {
      await s.call('c06_jaco_talk');
      return;
    }
    await s.say('jaco', 'Tonight I celebrate. Tomorrow I write the report. A very, very long report about me.', 'happy');
  },
  c06_party_kids: async (s) => {
    await s.talk([
      ['trunksKid', 'We fused into Gotenks and headbutted that big guy! Nobody believes us!', 'happy'],
      ['goten', 'It was so cool! Then Piccolo told us to go hide. That part wasn\'t cool.', 'sad'],
      ['trunksKid', 'Then we flew Mr. Piccolo all the way up to the Lookout. Dende says we did great.', 'happy'],
    ]);
  },
  c06_party_vegeta: async (s) => {
    await s.say('vegeta', 'Whis is going to lecture me about the Earth thing. I can feel it. Hmph. Pass me that bowl.', 'angry');
  },
  c06_party_goku: async (s) => {
    await s.say('goku', 'Mmph! Bulma\'s caterers are the best! Hey, you think Whis will let us keep training even after today?', 'happy');
  },
});
