import type { Expression } from '../../../art/portrait';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { ensureChapterState, force, unforce } from '../common';
import { addProp, bossExp, cast, clearWild, dismiss, dropProp, reloadHere } from './helpers';

/**
 * CHAPTER 7 — "Tournament of Destroyers" (Goku forced → free Goku/Vegeta/Piccolo → forced per match, L25-29).
 * Beats: c07_start (weighted training on beerus_grounds) → c07_b_vegeta_talk (spar with Vegeta; Champa and Vados
 * arrive with the Super Dragon Ball bet; back to Earth) → cc_yard recruitment (Piccolo, Buu's cake, Bulma's Super
 * Dragon Radar) → c07_cc_beerus (Beerus leads the departure in Whis's cube; arrival on the Nameless Planet, Cabba,
 * "Monaka") → c07_vados_exam (written exam; Buu fails) → c07_nameless_arena: opening ceremony and the nine-match
 * card (c07_matches.ts) → Zeno, Super Shenron → c08_start.
 * Side quests: c07_cake (silver, cc_yard), c07_snacks (bronze, vendor → crater rim → Beerus), c07_shards (silver,
 * Whis → crater rim; can be finished after the chapter too).
 */

/** Number of tournament matches already played (c07_m1..c07_m9 are set strictly in order). */
export function matchesDone(s: ScriptApi): number {
  let i = 0;
  while (i < 9 && s.flag(`c07_m${i + 1}`)) i++;
  return i;
}

type Progress = Array<[number, string, Expression?]>;

/** Pick a line for the current tournament progress: entries are [matches played at least, text, expression?]. */
function byMatch(s: ScriptApi, lines: Progress): [string, Expression] {
  const m = matchesDone(s);
  let out: [string, Expression] = [lines[0][1], lines[0][2] ?? 'neutral'];
  for (const [min, text, expr] of lines) if (m >= min) out = [text, expr ?? 'neutral'];
  return out;
}

/** Say a progress-dependent line. */
async function sayByMatch(s: ScriptApi, who: string, lines: Progress): Promise<void> {
  const [text, expr] = byMatch(s, lines);
  await s.say(who, text, expr);
}

/** Lord Beerus's planet: Whis's marble training court (pillared square x16-30, rows 11-17). */
const BG = {
  hero: { x: 22, y: 16 }, vegeta: { x: 20, y: 14 }, beerus: { x: 19, y: 9 }, whis: { x: 25, y: 13 },
  champa: { x: 28, y: 13 }, vados: { x: 29, y: 14 }, cube: { x: 27.5, y: 9.4 },
} as const;

/** Capsule Corp lawn (x 6-39, rows 15-27). The table/chair at (21-24, 15) and Whis at (23,17) belong to chapter 4. */
const CC = {
  arrive: { x: 23, y: 13 }, bulma: { x: 26, y: 17 }, beerus: { x: 28, y: 19 }, piccolo: { x: 9, y: 20 }, gohan: { x: 11, y: 20 },
  buu: { x: 32, y: 22 }, panchy: { x: 15, y: 18 }, brief: { x: 19, y: 21 }, vegeta: { x: 34, y: 17 },
  goten: { x: 20, y: 24 }, trunks: { x: 22, y: 25 }, cube: { x: 24.5, y: 8.3 },
} as const;

/** Nameless Planet crater floor (c07_nameless_grounds). */
const NG = { arrive: { x: 8, y: 14 }, examSeat: { x: 17, y: 22 }, examBuu: { x: 22, y: 22 } } as const;

const B_TRAIN = 'chapter==7&!c07_champaDone';
const CC_RECRUIT = 'chapter==7&c07_champaDone&!c07_departed';

// ------------------------------------------------------------------ hub overlays
registerOverlay('beerus_grounds', {
  onEnter: 'c07_b_enter',
  npcs: [
    { id: 'c07_b_vegeta', sprite: 'vegeta', x: BG.vegeta.x, y: BG.vegeta.y, dir: 'right', talk: 'c07_b_vegeta_talk', name: 'Vegeta', showIf: B_TRAIN },
    { id: 'c07_b_beerus', sprite: 'beerus', x: BG.beerus.x, y: BG.beerus.y, dir: 'down', talk: 'c07_b_beerus_talk', name: 'Beerus', showIf: B_TRAIN },
  ],
});

registerOverlay('cc_yard', {
  props: [
    { kind: 'table', x: 12.5, y: 17.6, flag: CC_RECRUIT }, { kind: 'c07_cakeTower', x: 13.2, y: 16.7, id: 'c07_cakeProp', flag: `${CC_RECRUIT}&!c07_cakeTaken` },
    { kind: 'crate', x: 35.4, y: 18.4, flag: CC_RECRUIT }, { kind: 'barrel', x: 36.6, y: 18.6, flag: CC_RECRUIT },
  ],
  npcs: [
    { id: 'c07_c_bulma', sprite: 'bulma', x: CC.bulma.x, y: CC.bulma.y, dir: 'left', talk: 'c07_cc_bulma', name: 'Bulma', showIf: CC_RECRUIT },
    { id: 'c07_c_piccolo', sprite: 'piccolo', x: CC.piccolo.x, y: CC.piccolo.y, dir: 'right', talk: 'c07_cc_piccolo', name: 'Piccolo', showIf: CC_RECRUIT },
    { id: 'c07_c_gohan', sprite: 'gohan', x: CC.gohan.x, y: CC.gohan.y, dir: 'left', talk: 'c07_cc_gohan', name: 'Gohan', showIf: CC_RECRUIT },
    { id: 'c07_c_buu', sprite: 'majinBuu', x: CC.buu.x, y: CC.buu.y, dir: 'left', talk: 'c07_cc_buu', name: 'Buu', showIf: CC_RECRUIT, wander: 1 },
    { id: 'c07_c_panchy', sprite: 'panchy', x: CC.panchy.x, y: CC.panchy.y, dir: 'down', talk: 'c07_cc_panchy', name: 'Mrs. Briefs', showIf: CC_RECRUIT },
    { id: 'c07_c_brief', sprite: 'drBrief', x: CC.brief.x, y: CC.brief.y, dir: 'right', talk: 'c07_cc_brief', name: 'Dr. Brief', showIf: CC_RECRUIT },
    { id: 'c07_c_vegeta', sprite: 'vegeta', x: CC.vegeta.x, y: CC.vegeta.y, dir: 'down', talk: 'c07_teammate_talk', name: 'Vegeta', showIf: `${CC_RECRUIT}&!char:vegeta` },
    { id: 'c07_c_goten', sprite: 'goten', x: CC.goten.x, y: CC.goten.y, dir: 'up', talk: 'c07_cc_kids', name: 'Goten', showIf: CC_RECRUIT, wander: 2 },
    { id: 'c07_c_trunks', sprite: 'trunksKid', x: CC.trunks.x, y: CC.trunks.y, dir: 'up', talk: 'c07_cc_kids', name: 'Trunks', showIf: CC_RECRUIT, wander: 2 },
    { id: 'c07_c_beerus', sprite: 'beerus', x: CC.beerus.x, y: CC.beerus.y, dir: 'left', talk: 'c07_cc_beerus', name: 'Beerus', showIf: CC_RECRUIT },
  ],
});

// ------------------------------------------------------------------ cutscene pieces

/** Whis on Beerus's planet: chapter 4's delicacy-menu Whis when present, otherwise a cutscene actor. */
function whisOnPlanet(s: ScriptApi): string {
  if (s.exists('c04_whisB')) return 'c04_whisB';
  cast(s, 'c07_b_whisA', 'whis', BG.whis.x, BG.whis.y, 'down', 'Whis');
  return 'c07_b_whisA';
}

/** Spar with Vegeta in weighted clothing; Champa and Vados interrupt with the Super Dragon Ball bet. */
async function sparAndChampa(s: ScriptApi): Promise<void> {
  force(s, 'goku');
  s.letterbox(true);
  clearWild(s);
  const whis = whisOnPlanet(s);
  cast(s, 'c07_b_vegeta', 'vegeta', BG.vegeta.x, BG.vegeta.y, 'right', 'Vegeta');
  await s.walk('hero', BG.vegeta.x + 4, BG.vegeta.y, 1);
  s.face('hero', 'left');
  await s.talk([
    ['whis', 'Remember: the clothing punishes wasted motion. Strike only when you mean it. Begin!', 'happy'],
    ['vegeta', 'Try to keep up, Kakarot. I\'d hate to win by default.', 'smirk'],
  ]);
  await s.narrate('The weighted clothing slows every step. Land clean hits on Vegeta and stay out of his combos!');
  s.remove('c07_b_vegeta');
  s.letterbox(false);
  s.music('training');
  const r = await s.fight('c07_sparVegeta', { x: BG.vegeta.x, y: BG.vegeta.y, uid: 'c07_sparF' });
  bossExp(s, 'c07_sparVegeta', r);
  s.letterbox(true);
  cast(s, 'c07_sparF', 'vegeta', BG.vegeta.x, BG.vegeta.y, 'right', 'Vegeta');
  s.place('hero', BG.vegeta.x + 3, BG.vegeta.y, 'left');
  s.pose('c07_sparF', 'hurt');
  s.pose('hero', 'hurt');
  await s.talk([
    ['vegeta', '*huff* ...Not bad. For a clown in pyjamas that weigh more than a mountain.', 'smirk'],
    ['goku', '*huff* Heh... you\'re one to talk. I can barely lift my arms.', 'happy'],
  ]);
  s.pose('c07_sparF', null);
  s.pose('hero', null);

  // Champa and Vados arrive by cube.
  s.music('godly');
  s.flash('#d0c0ff', 14);
  s.sfx('teleport');
  s.shake(16, 2);
  addProp(s, 'c07_cubeU6', BG.cube.x, BG.cube.y, 'c07_b_cube');
  cast(s, 'c07_b_champa', 'champa', BG.champa.x, BG.champa.y, 'left', 'Champa');
  cast(s, 'c07_b_vados', 'vados', BG.vados.x, BG.vados.y, 'left', 'Vados');
  s.face('hero', 'right');
  s.face('c07_sparF', 'right');
  await s.pan(26, 13, 30);
  await s.emote('hero', '!');
  await s.talk([
    ['champa', 'So THIS is where my lazy little brother naps away the eons. Cozy. Smells like cat.', 'smirk'],
    ['goku', 'Lord Beerus? Whoa... did you eat a whole planet since breakfast?', 'shock'],
    ['whis', 'That is Lord Champa, God of Destruction of Universe 6 and Lord Beerus\'s twin. And this is my elder sister, Vados.', 'neutral'],
    ['vados', 'Charmed. My, Whis, you look positively well-fed. Has Universe 7 been spoiling you?', 'smirk'],
    ['whis', 'Earth cuisine, sister. You really have no idea what you are missing.', 'happy'],
  ]);
  // Beerus wakes up.
  cast(s, 'c07_b_beerus', 'beerus', BG.beerus.x, BG.beerus.y, 'down', 'Beerus');
  await s.emote('c07_b_beerus', '#');
  s.pose('c07_b_beerus', null);
  await s.walk('c07_b_beerus', 24, 12, 1.4);
  s.face('c07_b_beerus', 'right');
  await s.talk([
    ['beerus', 'Champa. Who said you could park that box on my planet?', 'angry'],
    ['champa', 'I came for the food, brother. The whole cosmos is gossiping about your Earth. My Earth\'s people wiped themselves out ages ago. No people, no chefs.', 'neutral'],
    ['champa', 'So hand yours over. You don\'t even appreciate it.', 'smirk'],
    ['beerus', 'Absolutely not.', 'angry'],
    ['champa', 'Then let\'s bet on it! Five fighters from each universe. If my team wins, I get your Earth.', 'happy'],
    ['beerus', 'And when MY team wins?', 'smirk'],
    ['vados', 'Lord Champa has found six of the seven Super Dragon Balls. Each is the size of a planet, and together they grant any wish at all.', 'neutral'],
    ['goku', 'Super Dragon Balls?! Even bigger than ours?! Whis, is that true?', 'shock'],
    ['whis', 'Quite true. The originals, made by a dragon god long ago. Earth\'s Dragon Balls are a small imitation.', 'neutral'],
    ['champa', 'Win, and the six balls are yours. Lose, and I use them to swap our Earths. Your food planet ends up in MY universe.', 'smirk'],
  ]);
  await s.clash('c07_b_beerus', 'c07_b_champa', 60);
  s.shake(20, 3);
  await s.talk([
    ['vados', 'Now, now. If the two of you keep this up, you will destroy both universes over a pudding cup.', 'smirk'],
    ['beerus', 'Hmph. Fine. I accept. Prepare to lose, Champa. Badly.', 'angry'],
    ['vados', 'The match will be held on the Nameless Planet, in the empty space between our universes, five days from now. Martial arts tournament rules.', 'neutral'],
    ['champa', 'See you there, brother! Bring napkins. You\'ll be crying into them!', 'happy'],
  ]);
  s.flash('#d0c0ff', 14);
  s.sfx('teleport');
  dismiss(s, 'c07_b_champa', 'c07_b_vados');
  dropProp(s, 'c07_b_cube');
  s.follow();
  await s.talk([
    ['beerus', 'Goku. Vegeta. If you lose, Champa gets the Earth. And then I will destroy the two of you. Out of spite.', 'angry'],
    ['vegeta', 'We won\'t lose. A Saiyan prince doesn\'t lose to a fat cat\'s fan club.', 'smirk'],
    ['goku', 'A tournament against another universe... this is gonna be AWESOME!', 'happy'],
    ['whis', 'We will need three more fighters. Shall we pay Capsule Corporation a visit? I believe Mrs. Briefs was baking.', 'happy'],
  ]);
  if (whis === 'c07_b_whisA') dismiss(s, whis);
  dismiss(s, 'c07_sparF', 'c07_b_beerus');
  s.set('c07_champaDone');
  // Buu is on Team Universe 7 from here to the end of the tournament: Mr. Satan's Buu (world builder) steps out.
  if (!s.flag('ea_buuAway')) { s.set('ea_buuAway'); s.set('c07_hidBuu'); }
  await s.done('c07_spar', false);
  await s.quest('c07_recruit');
  await s.fadeOut(24);
  await s.narrate('Whis\'s cube streaks back across Universe 7. That afternoon, at Capsule Corporation...');
  await s.warp('cc_yard', CC.arrive.x, CC.arrive.y, 'down');
  s.letterbox(true);
  s.music('westCity');
  cast(s, 'c07_c_beerus', 'beerus', CC.arrive.x + 1, CC.arrive.y + 1, 'down', 'Beerus');
  await s.walk('c07_c_beerus', CC.beerus.x, CC.beerus.y, 1.4);
  s.face('c07_c_beerus', 'left');
  s.face('hero', 'down');
  await s.talk([
    ['bulma', 'You\'re back already? I thought Whis was keeping you two for another month!', 'shock'],
    ['beerus', 'Change of plans. My brother wants a tournament. If we lose, your planet goes to him.', 'neutral'],
    ['bulma', 'He wants to WHAT?! ...Okay. Okay. Deep breaths. Who\'s fighting?', 'angry'],
    ['goku', 'Me and Vegeta! And we need three more people.', 'happy'],
    ['beerus', 'The Namekian will do. And the pink one, Buu. As for the fifth... leave him to me. I know someone stronger than Goku.', 'smirk'],
    ['goku', 'Stronger than ME?! Who is it?! Can I fight him?!', 'shock'],
    ['beerus', 'You\'ll meet him on the day. Now go. Recruit Piccolo and Buu.', 'neutral'],
  ]);
  s.follow();
  s.letterbox(false);
  await s.narrate('Recruit Piccolo and Majin Buu here at Capsule Corp, then tell Beerus when Team Universe 7 is ready to leave.');
}

/** Departure in Whis's cube, the trip, and the arrival on the Nameless Planet. */
async function departure(s: ScriptApi): Promise<void> {
  force(s, 'goku');
  s.letterbox(true);
  if (!s.has('c07_superRadar')) await s.give('c07_superRadar');
  await s.talk([
    ['beerus', 'Good. Our fifth fighter, Monaka, will meet us there. Whis, the cube.', 'neutral'],
    ['bulma', 'I\'m coming too! Somebody has to babysit the radar. And I invited the whole gang to cheer.', 'happy'],
    ['whis', 'The more, the merrier. Everyone aboard, please. Mind the step.', 'happy'],
  ]);
  s.flash('#c0e0ff', 12);
  s.sfx('teleport');
  addProp(s, 'c07_cubeU7', CC.cube.x, CC.cube.y, 'c07_c_cube');
  await s.wait(30);
  s.set('c07_departed');
  await s.done('c07_recruit', false);
  s.unlockRegion('spot_nameless');
  await s.narrate('The Nameless Planet has been added to the world map!');
  await s.fadeOut(30);
  s.music('space');
  await s.narrate('Whis\'s cube races through the void. To pass the time, Goku and Buu play a word-chain game. Buu answers "cake" eleven times in a row.');
  await s.narrate('Five days later: the Nameless Planet, a barren rock adrift in the empty space between Universe 6 and Universe 7.');
  await s.warp('c07_nameless_grounds', NG.arrive.x, NG.arrive.y, 'up');
  s.letterbox(true);
  s.music('tournament');
  await s.pan(20, 8, 50);
  await s.talk([
    ['narrator', 'Vados has wrapped the great crater in a dome of breathable air. In its centre stands a brand-new stadium.'],
    ['bulma', 'They built a whole stadium? With snack stands? And restrooms?! Gods really don\'t do anything halfway.', 'shock'],
  ]);
  await s.pan(33, 13, 40);
  await s.talk([
    ['champa', 'Brother! You came! I was afraid you\'d run away and hide under your bed.', 'happy'],
    ['beerus', 'Enjoy your last day of smugness, Champa.', 'smirk'],
  ]);
  s.follow();
  // Cabba introduces himself.
  if (s.exists('c07_g_cabba')) {
    await s.walk('c07_g_cabba', NG.arrive.x + 3, NG.arrive.y, 1.6);
    s.face('c07_g_cabba', 'left');
    s.face('hero', 'right');
    await s.talk([
      ['cabba', 'Excuse me! You\'re the Saiyans from Universe 7, right? I\'m Cabba, from the planet Sadala.', 'happy'],
      ['cabba', 'Saiyans in my universe protect people. We hunt criminals and keep the peace. Do Saiyans here do the same?', 'neutral'],
      ['vegeta', 'Saiyans... as policemen. Hmph. Our homeworld is gone. The two of us are what\'s left.', 'neutral'],
      ['cabba', 'Oh... I\'m sorry. Either way, I hope we get to fight. I\'ll give it everything I have!', 'happy'],
    ]);
    await s.walk('c07_g_cabba', 30, 12, 1.6);
    s.face('c07_g_cabba', 'left');
  }
  // "Monaka".
  if (s.exists('c07_g_monaka')) {
    await s.walk('hero', 4, 13, 1.4);
    s.face('hero', 'left');
    await s.talk([
      ['goku', 'So you\'re Monaka! I\'m Goku! Lord Beerus says you\'re stronger than me! Wanna spar?!', 'happy'],
      ['monaka', '...!!', 'shock'],
      ['beerus', 'NO. Monaka does not spar. Monaka is... conserving his strength. Monaka fights last. If at all.', 'shock'],
    ]);
    await s.emote('c07_g_monaka', '...');
    await s.say('goku', 'Look at him shake! He must be dying to fight! I can\'t wait!', 'happy');
  }
  await s.talk([
    ['vados', 'Welcome, Team Universe 7. Before the tournament, every fighter must pass a written exam. Lord Champa\'s idea.', 'smirk'],
    ['champa', 'A true warrior has a brain! Probably!', 'happy'],
    ['beerus', 'Since when do YOU have a brain?', 'smirk'],
    ['vados', 'The exam hall is south of the stadium. Come and see me when you are ready.', 'neutral'],
  ]);
  unforce(s);
  await s.quest('c07_exam');
  s.letterbox(false);
  await s.narrate('Take the written exam with Vados in the hall to the south. The crater rim to the east is crawling with debris creatures - good training. You can switch fighters at the save point.');
}

/** The exam-taker's reply to a perfect score / to scraping through (only Goku, Vegeta and Piccolo may sit it). */
const EXAM_REPLY: Record<string, { perfect: [string, Expression]; scraped: [string, Expression] }> = {
  goku: { perfect: ['Heh. Easy!', 'happy'], scraped: ['Phew...', 'happy'] },
  vegeta: { perfect: ['Naturally. A prince is educated, unlike some clowns I could name.', 'smirk'], scraped: ['...Not one word of this leaves the hall. Understood?', 'angry'] },
  piccolo: { perfect: ['Hmph. Kami\'s library finally paid off.', 'smirk'], scraped: ['...Gohan is never hearing about this.', 'angry'] },
};

/** The written exam: three questions for the hero, then Buu's paper. */
async function writtenExam(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  await s.walk('hero', NG.examSeat.x, NG.examSeat.y, 1.2);
  s.face('hero', 'up');
  cast(s, 'c07_e_buu', 'majinBuu', NG.examBuu.x, NG.examBuu.y, 'up', 'Buu');
  await s.say('vados', 'Three questions. The pass mark is half. Pencils down when I say so. You may begin.', 'neutral');
  const questions: Array<[string, string[], number]> = [
    ['Question one. A fighter who touches the ground outside the ring has...', ['Earned a snack break', 'Lost the match', 'Found a shortcut'], 1],
    ['Question two. Lord Champa has twelve donuts and eats all twelve. How many donuts does Lord Champa want?', ['More donuts', 'Zero', 'Twelve'], 0],
    ['Question three. Which of these is forbidden in the tournament?', ['Ki blasts', 'Transforming', 'Killing your opponent'], 2],
  ];
  let score = 0;
  for (const [q, opts, right] of questions) {
    const a = await s.ask('vados', q, opts);
    if (a === right) score++;
  }
  await s.say('vados', 'Pencils down. Let me see...', 'neutral');
  if (score === 3) {
    await s.say('vados', 'Three out of three. A perfect score. Lord Beerus will be insufferable about this.', 'smirk');
    await s.say('hero', ...(EXAM_REPLY[s.hero]?.perfect ?? ['...', 'neutral']));
    await s.give('senzu');
  } else if (score === 2) {
    await s.say('vados', 'Two out of three. You pass. Question two trips up almost everyone.', 'smirk');
  } else {
    await s.talk([
      ['vados', `${score === 0 ? 'Zero' : 'One'} out of three. That is... below the pass mark.`, 'neutral'],
      ['vados', 'However, Lord Champa wrote this exam, and Lord Champa got question two wrong himself. So you pass.', 'smirk'],
    ]);
    await s.say('hero', ...(EXAM_REPLY[s.hero]?.scraped ?? ['...', 'neutral']));
  }
  // Buu.
  s.pose('c07_e_buu', 'ko');
  await s.emote('c07_e_buu', '...');
  await s.talk([
    ['vados', 'And Majin Buu... slept through the entire exam. Every answer on his paper is a drawing of candy.', 'neutral'],
    ['vados', 'They are very good drawings. Zero points. Majin Buu is disqualified.', 'smirk'],
  ]);
  s.pose('c07_e_buu', null);
  await s.talk([
    ['majinBuu', 'Mmm... Buu dreamed about cake. Is test over? Buu win?', 'happy'],
    ['beerus', 'BUU! You had ONE job! Write something! Anything!', 'angry'],
    ['champa', 'Hahaha! Four fighters! Universe 7 is losing before the first punch!', 'happy'],
    ['beerus', 'Laugh while you can. Monaka alone could flatten your whole team.', 'smirk'],
    ['vados', 'Majin Buu may watch from the stands. And this is his paper. Please give it to Lord Beerus as a keepsake.', 'smirk'],
  ]);
  await s.give('c07_buuPaper');
  dismiss(s, 'c07_e_buu');
  s.set('c07_examDone');
  await s.done('c07_exam', false);
  await s.quest('c07_tournament');
  s.letterbox(false);
  await reloadHere(s, 'up');
  await s.narrate('The stadium gate to the north is open. Team Universe 7 is waiting in the ring.');
}

registerScripts({
  // ================================================================== beat 1: weighted training on Beerus's planet
  c07_start: async (s) => {
    ensureChapterState(s, 7);
    // The gi with Whis's mark (Chapter 4) was for the Frieza arc; from here on Goku wears his own.
    s.outfit('goku', null);
    await s.chapter(7, 'Tournament of Destroyers', 'Universe 6 Challenges');
    force(s, 'goku');
    await s.fadeOut(20);
    await s.narrate('Lord Beerus\'s planet, a few weeks after Frieza\'s second defeat.');
    await s.warp('beerus_grounds', BG.hero.x, BG.hero.y, 'left');
    s.letterbox(true);
    s.music('beerusPlanet');
    clearWild(s);
    const whis = whisOnPlanet(s);
    s.place(whis, BG.whis.x, BG.whis.y, 'down');
    cast(s, 'c07_b_vegeta', 'vegeta', BG.vegeta.x, BG.vegeta.y, 'right', 'Vegeta');
    s.pose('hero', 'hurt');
    s.pose('c07_b_vegeta', 'hurt');
    await s.talk([
      ['goku', 'Whis... these clothes... weigh more... than King Kai\'s whole planet...', 'hurt'],
      ['vegeta', 'Stop whining, Kakarot. It\'s embarrassing. *huff* ...For both of us.', 'hurt'],
      ['whis', 'You both transformed against Frieza when you did not need to, and you both paid for it. A god does not waste a single motion.', 'neutral'],
      ['whis', 'Until you can move freely in those, you are not getting out of them. Now, spar with each other. If you can lift your arms.', 'smirk'],
    ]);
    s.pose('hero', null);
    s.pose('c07_b_vegeta', null);
    await s.pan(BG.beerus.x, BG.beerus.y + 1, 30);
    if (s.exists('c07_b_beerus')) {
      s.pose('c07_b_beerus', 'ko');
      await s.emote('c07_b_beerus', '...');
    }
    await s.say('beerus', 'Zzz... mmh... more pudding... no, the GOOD pudding... zzz...', 'neutral');
    s.follow();
    if (whis === 'c07_b_whisA') dismiss(s, whis);
    await s.quest('c07_spar');
    s.letterbox(false);
    await s.narrate('Talk to Vegeta on the marble court to start sparring. Whis will still take your Earth Delicacies.');
  },

  /** Beerus naps on the palace steps until Champa shows up (overlay NPCs cannot carry a pose). */
  c07_b_enter: async (s) => {
    if (s.check(B_TRAIN) && s.exists('c07_b_beerus')) s.pose('c07_b_beerus', 'ko');
  },

  // ================================================================== beat 2: the spar and Champa's visit
  c07_b_vegeta_talk: async (s) => {
    if (!s.check(B_TRAIN)) {
      await s.say('vegeta', 'Hmph.', 'neutral');
      return;
    }
    const c = await s.ask('vegeta', 'Are we sparring, or are you going to stand there sweating into those rags, Kakarot?', ['Let\'s spar!', 'Give me a minute']);
    if (c !== 0) {
      await s.say('vegeta', 'Take your time. Whis is counting every second you waste. Out loud.', 'smirk');
      return;
    }
    await sparAndChampa(s);
  },
  c07_b_beerus_talk: async (s) => {
    const n = s.inc('c07_b_beerus_n');
    await s.say('beerus', [
      'Zzz... Whis... the pudding... it\'s wearing a hat... zzz...',
      'Mmh... five more years... zzz...',
      '...If you wake me up, I will destroy you. Zzz...',
    ][(n - 1) % 3], 'neutral');
  },
  c07_spar_phase2: async (s) => {
    s.banner('Vegeta: "Stop holding back, Kakarot!"');
    s.sfx('powerUp');
  },

  // ================================================================== beat 3: recruitment at Capsule Corp
  c07_cc_bulma: async (s) => {
    if (!s.check(CC_RECRUIT)) {
      await s.say('bulma', 'Hey, {hero}!', 'happy');
      return;
    }
    if (!s.has('c07_superRadar')) {
      await s.talk([
        ['bulma', 'Planet-sized Dragon Balls? Please. Give a genius one hour and a pot of coffee.', 'smirk'],
        ['bulma', 'Ta-da! The Super Dragon Radar, prototype one! Same idea as the old radar, just scaled up by a few thousand light-years.', 'happy'],
      ]);
      await s.give('c07_superRadar');
      await s.say('bulma', '...It only shows static from here. We must be way too far from them. But it works. Probably.', 'sad');
      return;
    }
    const left = [!s.flag('c07_piccolo') ? 'Piccolo' : '', !s.flag('c07_buu') ? 'Buu' : ''].filter(Boolean);
    if (left.length) {
      await s.say('bulma', `Still need ${left.join(' and ')}? Piccolo's out on the west lawn with Gohan. Buu is wherever the food is.`, 'neutral');
      return;
    }
    await s.say('bulma', 'Full team! Go tell Lord Beerus. And Goku - try not to lose the planet, okay?', 'happy');
  },
  c07_cc_piccolo: async (s) => {
    if (s.flag('c07_piccolo')) {
      await s.say('piccolo', 'I said I\'m in. Stop staring and go find Buu.', 'angry');
      return;
    }
    if (!s.check(CC_RECRUIT)) {
      await s.say('piccolo', 'Hmph.', 'neutral');
      return;
    }
    await s.talk([
      ['goku', 'Piccolo! We need you for a tournament against another universe! If we lose, the Earth goes to Lord Champa!', 'happy'],
      ['piccolo', 'I heard. Gohan already said no - he has a thesis to finish. At least one of you thinks before he punches.', 'neutral'],
      ['piccolo', 'Fine. I\'ll fight. Someone has to make sure you two don\'t start a war between universes.', 'smirk'],
    ]);
    s.set('c07_piccolo');
    s.sfx('powerUp');
    await s.narrate('Piccolo joins Team Universe 7!');
  },
  c07_cc_gohan: async (s) => {
    if (!s.check(CC_RECRUIT)) {
      await s.say('gohan', 'Hi, {hero}!', 'happy');
      return;
    }
    await s.talk([
      ['gohan', 'Sorry, Dad. I\'d love to fight, but my thesis is due and Pan has a cold. Piccolo is a better pick anyway.', 'sad'],
      ['gohan', 'We\'ll all be cheering for you. Win this one for Earth!', 'happy'],
    ]);
  },
  c07_cc_panchy: async (s) => {
    if (s.check(`${CC_RECRUIT}&quest:c07_cake`) && !s.has('c07_cake') && !s.flag('c07_buu')) {
      await s.talk([
        ['panchy', 'A cake for Buu? Oh, how sweet! I just finished a strawberry tower. Seven layers!', 'happy'],
        ['panchy', 'Carry it carefully, dear. And tell Buu he must share. He won\'t, but tell him anyway.', 'happy'],
      ]);
      s.set('c07_cakeTaken');
      dropProp(s, 'c07_cakeProp');
      await s.give('c07_cake');
      return;
    }
    if (s.check(CC_RECRUIT)) {
      await s.say('panchy', 'Another tournament? How exciting! I\'ll pack lunches. Saiyan-sized lunches. Forty of them.', 'happy');
      return;
    }
    await s.say('panchy', 'Would you like some tea, dear? There\'s always tea.', 'happy');
  },
  c07_cc_buu: async (s) => {
    if (s.flag('c07_buu')) {
      await s.say('majinBuu', 'Buu on team! Buu very strong! Buu also very full.', 'happy');
      return;
    }
    if (!s.check(CC_RECRUIT)) {
      await s.say('majinBuu', 'Buu hungry.', 'neutral');
      return;
    }
    if (s.has('c07_cake')) {
      s.take('c07_cake');
      await s.talk([
        ['majinBuu', 'CAKE! Buu smell cake!', 'happy'],
        ['narrator', 'Seven layers of strawberry cake disappear in a single, terrifying bite.'],
        ['majinBuu', 'Mmm! Okay! Buu fight in tournament! Buu turn bad guys into candy!', 'happy'],
        ['goku', 'Uh... no turning anybody into candy, Buu. Those are the rules. Probably.', 'neutral'],
      ]);
      s.set('c07_buu');
      s.sfx('powerUp');
      await s.narrate('Majin Buu joins Team Universe 7!');
      await s.done('c07_cake', false);
      await s.give('str3');
      return;
    }
    if (s.check('quest:c07_cake')) {
      await s.say('majinBuu', 'No cake, no fight! Mrs. Briefs make best cake. Go ask!', 'angry');
      return;
    }
    await s.talk([
      ['goku', 'Buu! We need you for a tournament against another universe! Wanna fight?', 'happy'],
      ['majinBuu', 'Hmm... fighting is fun. But Buu is sleepy. And hungry. Mostly hungry.', 'neutral'],
      ['majinBuu', 'Buu fight if Buu get cake! Big cake!', 'happy'],
    ]);
    await s.quest('c07_cake');
  },
  c07_cc_brief: async (s) => {
    if (!s.check(CC_RECRUIT)) {
      await s.say('drBrief', 'Hmm? Oh, hello there.', 'neutral');
      return;
    }
    await s.talk([
      ['drBrief', 'Dragon Balls the size of planets! My daughter built the radar in an hour. I spent that hour looking for my cat.', 'happy'],
      ['drBrief', 'Between you and me, the radar needs to be much, much closer to work. Space is very big. Even for Bulma.', 'neutral'],
    ]);
  },
  c07_cc_kids: async (s) => {
    if (!s.check(CC_RECRUIT)) {
      await s.say('goten', 'Hi!', 'happy');
      return;
    }
    await s.talk([
      ['trunksKid', 'Why can\'t WE be on the team? We beat Majin Buu! ...Kind of. As Gotenks.', 'angry'],
      ['goten', 'Mom says the Nameless Planet has a snack stand. We\'re definitely coming to watch!', 'happy'],
    ]);
  },
  c07_cc_beerus: async (s) => {
    if (!s.check(CC_RECRUIT)) {
      await s.say('beerus', 'What?', 'neutral');
      return;
    }
    const missing = [!s.flag('c07_piccolo') ? 'the Namekian' : '', !s.flag('c07_buu') ? 'Buu' : ''].filter(Boolean);
    if (missing.length) {
      await s.say('beerus', `We are still missing ${missing.join(' and ')}. I don't care how you convince them. Bribes are acceptable.`, 'angry');
      return;
    }
    const c = await s.ask('beerus', 'Five fighters. Are we leaving for the Nameless Planet or not?', ['Let\'s go!', 'Not yet']);
    if (c !== 0) {
      await s.say('beerus', 'Then hurry up. If Champa gets there first, he\'ll eat all the snacks.', 'angry');
      return;
    }
    await departure(s);
  },

  // ================================================================== the Nameless Planet: Team Universe 7
  c07_teammate_talk: async (s) => {
    const id = s.npc?.def.id ?? '';
    const who = id.endsWith('vegeta') ? 'vegeta' : id.endsWith('piccolo') ? 'piccolo' : 'goku';
    if (s.check(CC_RECRUIT)) {
      await s.say('vegeta', 'Five days until the tournament. I\'ll be in the gravity room. Do not disturb me unless the planet is exploding.', 'neutral');
      return;
    }
    if (!s.flag('c07_examDone')) {
      const pre: Record<string, [string, Expression]> = {
        goku: ['Monaka\'s really stronger than me? I keep trying to sense his ki, but I can\'t feel ANYTHING. He must hide it perfectly!', 'happy'],
        vegeta: ['A Saiyan from another universe, playing hero. Cabba seems soft. Let\'s see if he has a spine.', 'smirk'],
        piccolo: ['A written exam. I\'ve read every scroll in Kami\'s library. I\'m more worried about you two.', 'smirk'],
      };
      await s.say(who, ...pre[who]);
      return;
    }
    const lines: Record<string, Progress> = {
      goku: [
        [0, 'Botamo first, huh? He looks like a big, squishy pillow. This\'ll be fun!', 'happy'],
        [2, 'I was winning, and then everything went wobbly. I don\'t get it. I wasn\'t even tired.', 'sad'],
        [3, 'A poison needle?! So that\'s what happened. Thanks, Piccolo. And Jaco, I guess!', 'angry'],
        [4, 'Champa said my loss doesn\'t count! I get another shot! I hope it\'s against Hit!', 'happy'],
        [7, 'Hit beat Vegeta and nobody saw a thing. I gotta figure out that trick.', 'neutral'],
        [8, 'I know, I know. Everybody\'s mad. But we still have Monaka! I can\'t wait to see him go!', 'happy'],
      ],
      vegeta: [
        [0, 'Go first, Kakarot. Soften them up for me.', 'smirk'],
        [2, 'You got dizzy?! In the middle of a fight?! Pathetic. Something smells rotten.', 'angry'],
        [3, 'A needle. Of course. Leave Frost to me. I want to see his face when he loses fair and square.', 'angry'],
        [4, 'One punch. That\'s all that pirate was worth.', 'smirk'],
        [6, 'Cabba has potential. Don\'t tell him I said that.', 'neutral'],
        [7, '...Hit is the real thing. And Monaka is... never mind. It\'s all on you now, Kakarot.', 'angry'],
        [8, 'You walked out of the ring. With a delivery man as our last hope. I need to sit down.', 'shock'],
      ],
      piccolo: [
        [0, 'Watch Botamo\'s stance. He isn\'t dodging anything. He\'s letting it all sink in.', 'neutral'],
        [2, 'Goku didn\'t tire himself out. Something hit him from the inside. I\'ll find out what.', 'angry'],
        [3, 'He got me the same way. Next time, I\'m checking his sleeves before the match.', 'angry'],
        [4, 'Frost is out. Good. Now we just have to beat the strongest assassin in Universe 6.', 'neutral'],
        [7, 'Hit doesn\'t stop time for long. A tenth of a second. Goku will figure it out. He always does.', 'neutral'],
        [8, 'Goku forfeited on purpose. Typical. ...Wait. Why is Monaka shaking like that?', 'shock'],
      ],
    };
    await sayByMatch(s, who, lines[who]);
  },
  c07_beerus_talk: async (s) => {
    // Snacks for the gods (bronze): Beerus gets the last bag of Galaxy Puffs. Champa disagrees.
    if (s.check('quest:c07_snacks') && s.has('c07_puffs')) {
      s.take('c07_puffs');
      await s.talk([
        ['beerus', 'Galaxy Puffs! Finally! The only civilised thing on this rock.', 'happy'],
        ['champa', 'Are those GALAXY PUFFS? Hand them over, brother! I am the guest here!', 'angry'],
        ['beerus', 'We are BOTH guests here. Find your own.', 'smirk'],
      ]);
      const champa = s.exists('c07_a_champa') ? 'c07_a_champa' : s.exists('c07_g_champa') ? 'c07_g_champa' : '';
      const beerus = s.npc?.def.id ?? '';
      if (champa && beerus && s.exists(beerus)) {
        const b = s.actor(beerus);
        const c = s.actor(champa);
        const home = { x: Math.floor(c.x / 16), y: Math.floor(c.y / 16) };
        await s.walk(champa, Math.floor(b.x / 16) + 1, Math.floor(b.y / 16), 3);
        await s.clash(beerus, champa, 40);
        s.sfx('explode');
        s.shake(14, 2);
        await s.talk([
          ['narrator', 'The bag rips. Galaxy Puffs rain across the stands like glittering confetti.'],
          ['beerus', '...', 'angry'],
          ['champa', '...', 'angry'],
          ['whis', 'Honestly. The two of you have been doing this for several billion years.', 'neutral'],
        ]);
        await s.walk(champa, home.x, home.y, 3);
        s.face(champa, 'down');
      }
      await s.say('beerus', 'Hmph. You tried. Here. Don\'t say I never gave you anything.', 'neutral');
      await s.done('c07_snacks', false);
      await s.give('senzu');
      await s.give('cookie', 3);
      return;
    }
    if (!s.flag('c07_examDone')) {
      if (s.check('quest:c07_snacks')) {
        await s.say('beerus', 'The snack stand is OUT of Galaxy Puffs. On tournament day. This is how wars between universes start.', 'angry');
        return;
      }
      await s.talk([
        ['beerus', 'Monaka is the strongest fighter in Universe 7. Stronger than Goku. Remember that.', 'smirk'],
        ['beerus', '...And make sure he never has to fight. That would be, er, unfair on Champa\'s team.', 'neutral'],
      ]);
      return;
    }
    await sayByMatch(s, 'beerus', [
      [0, 'Win. All of you. Monaka shall not be needed. Monaka shall NOT be needed.', 'angry'],
      [1, 'A ring-out. Fine. A win is a win. Next!', 'smirk'],
      [2, 'You LOST?! To a smiling lizard?! Goku, you were winning! What happened?!', 'angry'],
      [3, 'A poison needle! Of course Champa\'s team cheats! ...Vegeta, crush him.', 'angry'],
      [4, 'Hit stopped the thief himself. I don\'t enjoy owing that assassin anything.', 'neutral'],
      [5, 'Vegeta made a metal giant cry. I\'ll allow it.', 'smirk'],
      [7, 'Vegeta lost. Goku, it\'s you. Win. Monaka... must rest. Monaka is very tired.', 'shock'],
      [8, 'He walked out. Of the ring. On purpose. Whis, hold me back before I destroy something.', 'angry'],
    ]);
  },
  c07_monaka_talk: async (s) => {
    const self = s.npc?.def.id;
    if (self && s.exists(self)) await s.emote(self, '...');
    if (s.check('char:vegeta&c07_m7')) {
      await s.say('vegeta', '(A delivery man. Our last fighter is a delivery man. Kakarot can never find out.)', 'angry');
      return;
    }
    // Each fighter reads Monaka's trembling their own way (LoG2 chatter reacts to the active character).
    const take: Record<string, Progress> = {
      goku: [
        [0, 'Monaka is staring straight ahead and trembling. That\'s some serious fighting spirit!', 'happy'],
        [2, 'Monaka hasn\'t moved since the tournament started. Still shaking. He must be dying to get in there!', 'happy'],
        [8, 'It\'s Monaka\'s turn soon! He\'s shaking so hard the bench is rattling!', 'shock'],
      ],
      vegeta: [
        [0, 'Hmph. Trembling with excitement, or with fear? Either way, the prince won\'t be needing him.', 'smirk'],
        [4, 'He flinched when Frost hit the floor. A warrior who flinches at someone else\'s fall...', 'neutral'],
      ],
      piccolo: [
        [0, 'Not a flicker of ki. Either he hides it better than anyone alive, or there is nothing to hide.', 'neutral'],
        [2, 'He hasn\'t moved since the tournament started. And he\'s still shaking. Something about him doesn\'t add up.', 'neutral'],
      ],
    };
    const lines = take[s.hero];
    if (!lines) {
      await s.narrate('Monaka stares straight ahead, trembling. He does not seem to notice you.');
      return;
    }
    const [text, expr] = byMatch(s, lines);
    await s.say('hero', text, expr);
  },
  c07_buu_talk: async (s) => {
    if (s.flag('c07_examDone')) {
      await sayByMatch(s, 'majinBuu', [
        [0, 'Buu watch from here. Stands have popcorn. Buu like stands.', 'happy'],
        [2, 'Goku fall down! Buu make Frost into candy? No? Okay.', 'angry'],
        [5, 'Big metal man cry. Buu feel bad. Buu give him popcorn later.', 'sad'],
        [8, 'Monaka next! Monaka shake a lot. Monaka need cake.', 'happy'],
      ]);
      return;
    }
    await s.say('majinBuu', 'Test? Buu good at test. Is test made of candy?', 'happy');
  },
  c07_whis_grounds: async (s) => {
    // The orange stone (silver): fragments of the planet's shell from the crater rim.
    if (s.check('quest:c07_shards') && s.count('c07_starShard') >= 3) {
      s.take('c07_starShard', 3);
      await s.talk([
        ['whis', 'Three of them! Smooth, orange, faintly warm... and look. A tiny star, deep inside each one.', 'happy'],
        ['whis', s.flag('c07_done')
          ? 'Just as I suspected. Chips off the shell of a Super Dragon Ball. The whole planet was one all along.'
          : 'Hm-hm. I have a suspicion about what this planet really is. Let us keep it between us for now.', 'smirk'],
        ['whis', 'For your trouble. My own blend. Do not tell Lord Beerus where it came from.', 'happy'],
      ]);
      await s.done('c07_shards', false);
      await s.give('end3');
      await s.give('senzu');
      return;
    }
    if (s.check('quest:c07_shards')) {
      await s.say('whis', `You have ${s.count('c07_starShard')} of the three orange stones. Look under the debris along the crater rim - and in places that need a strong fighter to reach.`, 'neutral');
      return;
    }
    if (s.check('done:c07_shards')) {
      await s.say('whis', s.flag('c07_done')
        ? 'A planet-sized Dragon Ball hiding under space junk. The universe has a delightful sense of humour.'
        : 'I am keeping the stones safe. You concentrate on winning.', 'happy');
      return;
    }
    if (s.check('chapter==7&c07_departed')) {
      await s.talk([
        ['whis', 'Have you noticed? Under all the debris on the crater rim, the rock is orange. Smooth, like glass.', 'neutral'],
        ['whis', 'I would love a closer look. If you find three fragments while you train out there, bring them to me.', 'happy'],
      ]);
      await s.quest('c07_shards');
      return;
    }
    await s.say('whis', 'Ohoho. What a lovely, quiet planet.', 'happy');
  },

  // ================================================================== the Nameless Planet: Team Universe 6
  c07_champa_talk: async (s) => {
    if (!s.flag('c07_examDone')) {
      await s.talk([
        ['champa', 'Oh, you\'re one of Beerus\'s little fighters. Do you know what Earth food tastes like? Describe it. In detail.', 'happy'],
        ['champa', 'Never mind. I\'ll find out myself when it\'s MINE.', 'smirk'],
      ]);
      return;
    }
    await sayByMatch(s, 'champa', [
      [0, 'Botamo can\'t be hurt by ANYTHING. Your team is already finished!', 'smirk'],
      [1, 'Botamo! You were supposed to be invincible! ...Frost, show them how it\'s done.', 'angry'],
      [3, 'I didn\'t know about the needle! Honestly! Vados, tell them I didn\'t know!', 'shock'],
      [4, 'Fine, fine, Goku can fight again. I\'m generous like that. Magetta will roast you all anyway.', 'smirk'],
      [5, 'You made Magetta CRY. Do you know how long it takes to calm him down?! He\'s sensitive!', 'angry'],
      [6, 'Cabba lost, but he went Super Saiyan! ...Is that good? Vados, is that good for me?', 'shock'],
      [7, 'HA! Hit wins! Nobody beats Hit! Your Earth is as good as mine!', 'happy'],
      [8, 'Goku walked OUT? Then it\'s Hit against your mystery man. Go on, Beerus. Show me this Monaka.', 'smirk'],
    ]);
  },
  c07_cabba_talk: async (s) => {
    if (!s.flag('c07_examDone')) {
      await s.say('cabba', 'In Universe 6, the Saiyans of Sadala are heroes. The king sent me here to make our people proud. I won\'t hold back!', 'happy');
      return;
    }
    await sayByMatch(s, 'cabba', [
      [0, 'I\'m fourth in the order. I hope I get to face Vegeta-san!', 'happy'],
      [3, 'A poison needle... I never would have believed it of Frost. He was a hero back home.', 'sad'],
      [5, 'I\'m up next. Vegeta-san, please - fight me with everything you have!', 'neutral'],
      [6, 'Master Vegeta! I finally became a Super Saiyan! I\'ll keep training until I can stand beside you!', 'happy'],
      [8, 'Master Vegeta says Saiyan pride is earned every day. I\'m going to earn mine!', 'happy'],
    ]);
  },
  c07_frost_talk: async (s) => {
    if (!s.flag('c07_examDone')) {
      await s.say('frost', 'Ah, Universe 7\'s finest. I do hope we can have a clean, honest match. I believe in fair play above all.', 'happy');
      return;
    }
    await sayByMatch(s, 'frost', [
      [0, 'Good luck out there. Truly. May the best fighter win.', 'happy'],
      [2, 'Goku seemed rather unwell. Too much excitement, I expect. Such a shame.', 'smirk'],
      [3, '...I have nothing to say until my lawyer arrives. I don\'t have a lawyer. That\'s not the point.', 'angry'],
    ]);
  },
  c07_hit_talk: async (s) => {
    if (!s.flag('c07_examDone')) {
      await s.say('hit', '...', 'neutral');
      return;
    }
    await sayByMatch(s, 'hit', [
      [0, 'I was paid to win a tournament. Talk to me when it is my turn.', 'neutral'],
      [4, 'The pirate dishonoured the ring. That is all.', 'neutral'],
      [7, 'Your prince fought three battles in one day. Next time, I would like to fight him fresh.', 'neutral'],
      [8, 'Goku. I would like to finish our fight someday. Without anyone else\'s rules.', 'smirk'],
    ]);
  },
  c07_botamo_talk: async (s) => {
    await s.say('botamo', s.flag('c07_examDone')
      ? 'Mmm. Hit me if you like. It tickles.'
      : 'Mmm... the exam had a question about honey. I answered "yes". I think I passed.', 'neutral');
  },
  c07_magetta_talk: async (s) => {
    await s.say('c07_magetta', s.flag('c07_examDone') ? 'FSSSSHHHHH...' : 'Fsss... fsss? *steam whistles politely*', 'neutral');
    await s.narrate('Waves of heat roll off Magetta. Standing next to him is like standing next to a furnace.');
  },

  // ================================================================== the exam and the neutral-zone staff
  c07_vados_exam: async (s) => {
    if (s.flag('c07_examDone')) {
      await s.say('vados', 'The exam is over. The ring is through the stadium gate to the north. Do try to be entertaining.', 'smirk');
      return;
    }
    if (!s.check('chapter==7&c07_departed')) {
      await s.say('vados', 'Hello there.', 'neutral');
      return;
    }
    if (!['goku', 'vegeta', 'piccolo'].includes(s.hero)) {
      await s.say('vados', 'Only registered fighters may sit the exam. Please send Goku, Vegeta or Piccolo - you can switch at the save point.', 'neutral');
      return;
    }
    const c = await s.ask('vados', 'Welcome to the written exam. Every fighter must pass. Shall we begin?', ['Begin the exam', 'Not yet']);
    if (c !== 0) {
      await s.say('vados', 'Take your time. The answers will not change. Probably.', 'smirk');
      return;
    }
    await writtenExam(s);
  },
  c07_vendor_talk: async (s) => {
    // Snacks for the gods (bronze). After the tournament Beerus is gone, so the vendor ships the puffs to him.
    if (s.check('quest:c07_snacks') && s.has('c07_puffs') && s.flag('c07_done')) {
      s.take('c07_puffs');
      await s.talk([
        ['c07_vendor', 'You still have Lord Beerus\'s Galaxy Puffs? He left with Lord Zeno\'s crowd before you could hand them over!', 'shock'],
        ['c07_vendor', 'Give them here. I\'ll ship them to his planet. Express. With a very polite apology note.', 'happy'],
      ]);
      await s.done('c07_snacks', false);
      await s.give('senzu');
      await s.give('cookie', 3);
      return;
    }
    if (s.check('quest:c07_snacks') && s.has('c07_snackCrate')) {
      s.take('c07_snackCrate');
      if (s.flag('c07_done')) {
        await s.talk([
          ['c07_vendor', 'My crate! Lord Beerus left before he got his Galaxy Puffs. I\'ll have a bag delivered to his planet. Express!', 'happy'],
          ['c07_vendor', 'Here, your finder\'s fee. Don\'t tell the gods I gave you a discount.', 'happy'],
        ]);
        await s.done('c07_snacks', false);
        await s.give('senzu');
        await s.give('cookie', 3);
        return;
      }
      await s.talk([
        ['c07_vendor', 'The supply crate! You found it! Oh, thank the gods. Er, the nice gods.', 'happy'],
        ['c07_vendor', 'Here\'s the last bag of Galaxy Puffs. Take it to Lord Beerus, quickly, before he starts glowing.', 'shock'],
      ]);
      await s.give('c07_puffs');
      return;
    }
    if (s.check('quest:c07_snacks') && s.has('c07_puffs')) {
      await s.say('c07_vendor', 'What are you waiting for? Lord Beerus has been staring at my stand for an hour!', 'shock');
      return;
    }
    if (s.check('quest:c07_snacks')) {
      await s.say('c07_vendor', 'The supply cube dropped a crate on the crater rim, east of here. Debris crawlers everywhere. I\'m not going. You\'re going.', 'neutral');
      return;
    }
    if (s.check('done:c07_snacks')) {
      await s.say('c07_vendor', 'Business is booming! Two Gods of Destruction eat more than both universes combined.', 'happy');
      return;
    }
    if (s.check('chapter==7&c07_departed')) {
      await s.talk([
        ['c07_vendor', 'Welcome to the only snack stand in the neutral zone! We have... water. And napkins.', 'sad'],
        ['c07_vendor', 'The supply cube clipped the crater rim on the way in and dropped my Galaxy Puffs crate somewhere out there.', 'sad'],
        ['c07_vendor', 'Lord Beerus has asked for Galaxy Puffs four times. The fourth time, his eyes glowed. Could you find that crate?', 'shock'],
      ]);
      await s.quest('c07_snacks');
      return;
    }
    await s.say('c07_vendor', 'After that tournament, everyone wants to visit the Nameless Planet. I\'ve tripled my prices!', 'happy');
  },
  c07_attendant_talk: async (s) => {
    if (s.check('chapter==7&!c07_examDone')) {
      await s.say('c07_attendant', 'The stadium opens once every fighter has taken Vados\'s written exam. The hall is to the south.', 'neutral');
      return;
    }
    if (s.check('chapter==7&!c07_done')) {
      await s.say('c07_attendant', 'The ring is through the gate behind me. Knock-out, ring-out or surrender. No weapons. No killing. No eating the referee.', 'neutral');
      return;
    }
    await s.say('c07_attendant', 'Lord Zeno himself came to watch. I\'m still shaking. I may never stop shaking.', 'shock');
  },
  c07_arena_locked: async (s) => {
    await s.narrate('A shimmering barrier seals the stadium gate. A note in elegant handwriting: "Exam first. - Vados"');
  },

  // ================================================================== the stands (c07_nameless_arena)
  c07_whis_arena: async (s) => {
    await sayByMatch(s, 'whis', [
      [0, 'What a lovely stadium. Sister always did have an eye for architecture.', 'happy'],
      [2, 'Goku was not tired. His ki wavered from the inside. How curious.', 'neutral'],
      [4, 'A rule-breaker removed, a match returned. How very civilised.', 'smirk'],
      [6, 'Vegeta taught a young Saiyan something precious today. He would never admit it, of course.', 'happy'],
      [7, 'Hit stops time, but only for an instant. The question is whether Goku can feel that instant.', 'neutral'],
      [8, 'Goku, you really are impossible. Well. Let us see what the delivery man can do.', 'smirk'],
    ]);
  },
  c07_vados_arena: async (s) => {
    await sayByMatch(s, 'vados', [
      [0, 'Isn\'t this exciting? Lord Champa has not stopped eating since we arrived.', 'happy'],
      [3, 'Frost\'s little secret? Let us say I prefer a more honest kind of cheating.', 'smirk'],
      [5, 'Magetta will be fine. He is in the restroom, sulking. He does that.', 'smirk'],
      [7, 'Hit has never failed a contract. Your Goku is welcome to try to be the first.', 'smirk'],
      [8, 'Oh my. The mysterious Monaka. I have been looking forward to this.', 'happy'],
    ]);
  },
  c07_kai_talk: async (s) => {
    await sayByMatch(s, 'supremeKai', [
      [0, 'If Lord Beerus loses his temper today, please remember: my life is linked to his. Win calmly. Please.', 'shock'],
      [2, 'Goku lost?! Oh no, Lord Beerus is turning purple. Purpler. This is very bad for my health.', 'shock'],
      [4, 'The match was restored! I can breathe again!', 'happy'],
      [7, 'Hit is a professional assassin? At a friendly tournament? Is this friendly?', 'shock'],
    ]);
  },
  c07_oldkai_talk: async (s) => {
    await sayByMatch(s, 'oldKai', [
      [0, 'Bah! In my day, gods settled things with a nice game of cards. Still... front-row seats are nice.', 'neutral'],
      [3, 'A poison needle! Shameful. Back in my day we cheated with style.', 'angry'],
      [7, 'That Hit fellow skips time itself. Fifteen generations of Kais and I\'ve never seen the like.', 'shock'],
    ]);
  },
  c07_bulma_arena: async (s) => {
    await sayByMatch(s, 'bulma', [
      [0, 'The radar still shows static. Wherever the Super Dragon Balls are, they\'re not close. Or it\'s broken. It\'s NOT broken.', 'neutral'],
      [2, 'Goku doesn\'t get dizzy. That man once ate thirty bowls of ramen and sparred right after!', 'angry'],
      [3, 'A needle?! I knew that guy\'s smile was too perfect!', 'angry'],
      [7, 'Vegeta! Are you okay?! ...He\'s fine. He\'s sulking. He\'s fine.', 'shock'],
      [8, 'Goku walked out of the ring! Now it\'s all on Monaka! Who IS Monaka, anyway?', 'shock'],
    ]);
  },
  c07_krillin_arena: async (s) => {
    await sayByMatch(s, 'krillin', [
      [0, 'A tournament between universes! I\'m so glad I\'m just watching this one.', 'happy'],
      [1, 'He threw Botamo out like a sack of laundry! That\'s our Goku!', 'happy'],
      [2, 'Goku doesn\'t get dizzy from a few hits. Something weird is going on.', 'angry'],
      [5, 'Vegeta insulted that metal guy until he cried. That\'s... actually a valid strategy?', 'shock'],
      [8, 'Monaka\'s up! I\'ve never even seen him move. Is he breathing?', 'shock'],
    ]);
  },
  c07_18_arena: async (s) => {
    await sayByMatch(s, 'android18', [
      [0, 'Krillin bought four hot dogs and a foam finger. For a tournament he\'s not in.', 'smirk'],
      [3, 'The lizard cheats. I\'d have noticed sooner if Krillin stopped cheering in my ear.', 'neutral'],
      [7, 'Hit doesn\'t waste a single motion. I respect that.', 'neutral'],
    ]);
  },
  c07_roshi_arena: async (s) => {
    await sayByMatch(s, 'roshi', [
      [0, 'Botamo absorbs every blow, does he? Then don\'t hit him. Move him. Basic martial arts!', 'neutral'],
      [2, 'That dizziness was no accident. I\'ve seen poisoned fighters before. Back in the old days, everyone cheated.', 'angry'],
      [5, 'Defeating an opponent with words. That\'s an advanced technique. I tried it once. He hit me.', 'happy'],
      [7, 'Hit fights like an old master. No wasted motion. Not one drop.', 'neutral'],
    ]);
  },
  c07_yamcha_arena: async (s) => {
    await sayByMatch(s, 'yamcha', [
      [0, 'I came to cheer. And to scout the snack stand. Mostly the snack stand.', 'happy'],
      [2, 'Goku lost?! ...Okay, I\'ve lost a LOT of tournaments, and that did NOT look normal.', 'shock'],
      [6, 'A Saiyan in a uniform. Universe 6 is weird. Good weird.', 'neutral'],
    ]);
  },
  c07_jaco_arena: async (s) => {
    await sayByMatch(s, 'jaco', [
      [0, 'Galactic Patrolman Jaco, on duty! I\'m keeping my elite eyes on Universe 6. Especially that Frost.', 'neutral'],
      [3, 'I SAW the needle! Me! Write that down! Elite eyesight, folks!', 'happy'],
      [4, 'My boss came all the way out here. I\'m on my best behaviour. Do I look elite? I feel elite.', 'happy'],
    ]);
  },
  c07_galking_talk: async (s) => {
    await sayByMatch(s, 'c07_galacticKing', [
      [0, 'Jaco tells me Universe 7\'s team is the best in the cosmos. Jaco also tells me he is an elite. I keep an open mind.', 'smirk'],
      [3, 'Frost is a space pirate. He arranges attacks on planets, then sells them "protection". A wanted man in a hundred systems.', 'angry'],
      [6, 'Hit is an assassin of legend. They say he stops time for a tenth of a second and strikes inside it.', 'neutral'],
      [8, 'Goku read the Time-Skip. Remarkable. I may have to re-evaluate Jaco\'s reports.', 'shock'],
    ]);
  },
  c07_chichi_arena: async (s) => {
    await sayByMatch(s, 'chichi', [
      [0, 'Goku had better win. And he had better not get hurt. And he had better eat a proper breakfast after!', 'angry'],
      [2, 'GOKU! Get up! ...He\'s fine. He\'s FINE. Oh, I need to sit down.', 'shock'],
      [8, 'Walking out of the ring?! That man! When we get home, he\'s weeding the radish field. All of it.', 'angry'],
    ]);
  },
  c07_kids_arena: async (s) => {
    // Goten cheers for his dad, Trunks for his. Frost's needle is only news after match 3 exposes it.
    const lines: Record<'goten' | 'trunksKid', Progress> = {
      goten: [
        [0, 'Go, Dad! Knock the big bear right out of the ring!', 'happy'],
        [2, 'Dad lost? But he was winning! Is he okay? He looks all wobbly.', 'sad'],
        [3, 'Frost cheated?! With a NEEDLE?! Trunks, let\'s fuse and kick his butt!', 'angry'],
        [4, 'One punch! Mr. Vegeta is so cool! ...Don\'t tell Trunks I said that.', 'happy'],
        [6, 'Mr. Vegeta went Super Saiyan Blue! Cabba didn\'t stand a chance!', 'happy'],
        [7, 'Mr. Vegeta lost... Trunks isn\'t talking. I think he\'s really sad.', 'sad'],
        [8, 'Monaka\'s turn! He\'s gotta be super strong if Lord Beerus brought him!', 'happy'],
      ],
      trunksKid: [
        [0, 'Go, Mr. Goku! Save some for my dad!', 'happy'],
        [2, 'Mr. Goku lost?! Nobody gets dizzy like that out of nowhere. Something\'s weird.', 'shock'],
        [3, 'A poison needle! I knew that smile was fake! Goten, fusion. Now!', 'angry'],
        [4, 'Did you see that?! My dad knocked Frost out with ONE punch!', 'happy'],
        [5, 'Dad made the metal guy cry. That\'s kind of mean. And kind of awesome.', 'smirk'],
        [6, 'Super Saiyan Blue! That\'s my dad! Cabba didn\'t stand a chance!', 'happy'],
        [7, '...Dad lost. Hit has some kind of trick. He HAS to.', 'sad'],
        [8, 'Monaka\'s turn! He\'s gotta be super strong if Lord Beerus brought him!', 'happy'],
      ],
    };
    const kid = (s.npc?.def.id ?? '').endsWith('goten') ? 'goten' : 'trunksKid';
    const [text, expr] = byMatch(s, lines[kid]);
    await s.say(kid, text, expr);
  },
});
