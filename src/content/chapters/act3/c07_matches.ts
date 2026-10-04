import type { CharId } from '../../characters';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { force, unforce } from '../common';
import { bossExp, cast, dismiss, duringFight, hide, knockOut, stageBoss } from './helpers';
import { matchesDone } from './c07';

/**
 * CHAPTER 7, part 2 — the match card on c07_nameless_arena (a `ringOut` map). Each match is started by talking to
 * the announcer beside the ring (c07_announcer_talk), forces the right fighter, and stores c07_m1..c07_m9.
 *   1 Goku vs Botamo (ring-out only)      2 Goku vs Frost (poisoned, ring-out loss)   3 Piccolo vs Frost (loss; needle exposed)
 *   4 Vegeta vs Frost (one punch; Hit stops Frost)   5 Vegeta vs Magetta (heat aura, insult)   6 Vegeta vs Cabba (SSJ awakening)
 *   7 Vegeta vs Hit (Time-Skip, scripted loss)   8 Goku vs Hit (Blue Kaio-ken, beam struggle, forfeit)   9 Monaka vs Hit → Zeno, Super Shenron
 */

const ARENA_MAP = 'c07_nameless_arena';
const RING = { hero: { x: 13, y: 13 }, foe: { x: 22, y: 13 }, bench: { x: 5, y: 13 }, westVoid: { x: 8, y: 13 }, eastVoid: { x: 27, y: 13 } } as const;

interface Card { fighter: CharId; foe: string; label: string; script: string }
const CARD: Card[] = [
  { fighter: 'goku', foe: 'Botamo', label: 'Goku vs. Botamo', script: 'c07_match1' },
  { fighter: 'goku', foe: 'Frost', label: 'Goku vs. Frost', script: 'c07_match2' },
  { fighter: 'piccolo', foe: 'Frost', label: 'Piccolo vs. Frost', script: 'c07_match3' },
  { fighter: 'vegeta', foe: 'Frost', label: 'Vegeta vs. Frost', script: 'c07_match4' },
  { fighter: 'vegeta', foe: 'Magetta', label: 'Vegeta vs. Magetta', script: 'c07_match5' },
  { fighter: 'vegeta', foe: 'Cabba', label: 'Vegeta vs. Cabba', script: 'c07_match6' },
  { fighter: 'vegeta', foe: 'Hit', label: 'Vegeta vs. Hit', script: 'c07_match7' },
  { fighter: 'goku', foe: 'Hit', label: 'Goku vs. Hit', script: 'c07_match8' },
  { fighter: 'goku', foe: 'Hit', label: 'Monaka vs. Hit', script: 'c07_match9' },
];

/** Fade out, force the fighter, reload the arena with the hero in the ring and the opponent opposite. */
async function enterRing(s: ScriptApi, fighter: CharId, foeSprite: string, foeName: string, benchNpc: string): Promise<void> {
  s.letterbox(true);
  await s.fadeOut(16);
  force(s, fighter);
  s.heal();
  await s.warp(ARENA_MAP, RING.hero.x, RING.hero.y, 'right');
  s.letterbox(true);
  s.music('tournament');
  hide(s, benchNpc);
  cast(s, 'c07_foe', foeSprite, RING.foe.x, RING.foe.y, 'left', foeName);
}

/** Close a match: record it, heal, and put the hero back on the Universe 7 bench. */
async function leaveRing(s: ScriptApi, flag: string): Promise<void> {
  s.set(flag);
  s.tint(null);
  await s.fadeOut(16);
  s.transformNow(null);
  s.pose('hero', null);
  s.heal();
  await s.warp(ARENA_MAP, RING.bench.x, RING.bench.y, 'right');
}

/** Bring the hero back onto the ring floor after a ring-out cutscene. */
function upright(s: ScriptApi): void {
  s.pose('hero', null);
}

registerScripts({
  c07_announcer_talk: async (s) => {
    if (!s.check('chapter==7&c07_examDone&!c07_done')) {
      await s.say('c07_announcer', 'Welcome, welcome! Seats are first-come, first-served. Gods of Destruction have reserved seating.', 'happy');
      return;
    }
    const idx = matchesDone(s);
    if (idx >= CARD.length) return;
    const card = CARD[idx];
    const c = await s.ask('c07_announcer', `Match ${idx + 1}: ${card.label}! Is Universe 7 ready?`, ['Into the ring!', 'Not yet']);
    if (c !== 0) {
      await s.say('c07_announcer', 'Take your time! But not too much. Lord Champa gets cranky.', 'neutral');
      return;
    }
    await s.call(card.script);
  },

  /** First visit after the exam: the opening ceremony. */
  c07_arena_enter: async (s) => {
    if (!s.check('chapter==7&c07_examDone&!c07_ceremony')) return;
    s.set('c07_ceremony');
    s.letterbox(true);
    await s.pan(17, 13, 40);
    await s.talk([
      ['c07_announcer', 'Ladies, gentlemen, and Gods of Destruction! Welcome to the tournament between Universe 6 and Universe 7!', 'happy'],
      ['c07_announcer', 'The rules: you lose if you are knocked out, if you surrender, or if you leave the ring. No killing, no weapons!', 'neutral'],
      ['champa', 'Universe 6 fights in this order: Botamo, Frost, Magetta, Cabba and Hit! Try not to cry, brother!', 'happy'],
      ['beerus', 'Goku goes first. Then whoever is still standing. And Monaka last. Monaka will not be needed.', 'smirk'],
    ]);
    s.follow();
    s.letterbox(false);
    await s.narrate('Talk to the announcer beside the ring to start each match. The Universe 7 bench has a save point between matches.');
  },

  // ================================================================== 1: Goku vs Botamo
  c07_match1: async (s) => {
    await enterRing(s, 'goku', 'botamo', 'Botamo', 'c07_a_botamo');
    await s.talk([
      ['c07_announcer', 'First match! Goku of Universe 7 versus Botamo of Universe 6! BEGIN!', 'shout'],
      ['botamo', 'Mmm... go ahead. Hit me.', 'neutral'],
      ['champa', 'Ha! Botamo\'s body absorbs everything! You can\'t hurt him!', 'smirk'],
    ]);
    await s.narrate('Botamo absorbs every blow. Corner him at the edge of the ring, then finish a combo or a charged attack to knock him out!');
    s.remove('c07_foe');
    s.letterbox(false);
    const r = await s.fight('c07_botamo', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_botamoF', survive: 90, label: 'RING OUT' });
    s.letterbox(true);
    if (r === 'end') {
      await s.talk([
        ['c07_announcer', 'Botamo is out of the ring! RING OUT! Goku wins!', 'shout'],
        ['goku', 'Heh! I can\'t hurt you, but nothing says I can\'t move you!', 'happy'],
        ['champa', 'Botamo! You were supposed to be invincible!', 'angry'],
      ]);
      await s.give('str1');
    } else {
      cast(s, 'c07_botamoF', 'botamo', RING.foe.x, RING.foe.y, 'left', 'Botamo');
      await s.talk([
        ['goku', 'Punching doesn\'t work... but what if I lift him?', 'neutral'],
      ]);
      const b = s.actor('c07_botamoF');
      await s.walk('hero', Math.floor(b.x / 16) - 1, Math.floor(b.y / 16), 2);
      s.pose('hero', 'punch2');
      await s.lift('c07_botamoF', 24, 12);
      await knockOut(s, 'c07_botamoF', RING.eastVoid.x, RING.foe.y);
      s.pose('hero', null);
      await s.talk([
        ['c07_announcer', 'An uppercut and a kick! Botamo lands outside the ring! Goku wins!', 'shout'],
        ['champa', 'That\'s cheating! ...Isn\'t it? Vados, is it?', 'angry'],
      ]);
    }
    bossExp(s, 'c07_botamo', r);
    dismiss(s, 'c07_botamoF');
    await leaveRing(s, 'c07_m1');
  },

  // ================================================================== 2: Goku vs Frost
  c07_match2: async (s) => {
    await enterRing(s, 'goku', 'frost', 'Frost', 'c07_a_frost');
    await s.talk([
      ['c07_announcer', 'Match two! Goku versus Frost, the hero of Universe 6!', 'shout'],
      ['frost', 'I\'ve heard so much about you, Goku. Shall we have a clean fight?', 'happy'],
      ['goku', 'Sure! Show me what you\'ve got!', 'happy'],
    ]);
    s.remove('c07_foe');
    s.letterbox(false);
    const r1 = await s.fight('c07_frost1', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_frostF1' });
    bossExp(s, 'c07_frost1', r1);
    s.letterbox(true);
    cast(s, 'c07_frostF1', 'frost', RING.foe.x, RING.foe.y, 'left', 'Frost');
    await s.say('frost', 'Splendid. Then allow me to show you my final form.', 'smirk');
    await s.powerUp('c07_frostF1', '#a070f0', 50);
    s.remove('c07_frostF1');
    s.letterbox(false);
    const r2 = await s.fight('c07_frost2', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_frostF2' });
    bossExp(s, 'c07_frost2', r2);
    s.letterbox(true);
    cast(s, 'c07_frostF2', 'frost', RING.foe.x, RING.foe.y, 'left', 'Frost');
    await s.talk([
      ['goku', 'You\'re strong, Frost! But I think it\'s time to wrap this up.', 'smirk'],
      ['frost', 'Indeed it is.', 'smirk'],
    ]);
    s.flash('#c0a0ff', 4);
    s.sfx('blastHit');
    s.tint('rgba(110,40,150,0.25)');
    s.shake(30, 1);
    s.pose('hero', 'hurt');
    await s.talk([
      ['goku', 'Huh...? My legs feel... heavy... Everything\'s spinning...', 'hurt'],
      ['frost', 'Oh dear. Are you feeling unwell? Let me help you sit down.', 'smirk'],
    ]);
    await s.blast('c07_frostF2', 'hero', '#a070f0');
    await knockOut(s, 'hero', RING.westVoid.x, RING.hero.y);
    s.tint(null);
    await s.talk([
      ['c07_announcer', 'Goku has fallen out of the ring! RING OUT! Frost wins!', 'shout'],
      ['beerus', 'GOKU! What was that?! You were winning!', 'angry'],
      ['piccolo', 'He wasn\'t tired. Something\'s wrong. I\'ll go next.', 'angry'],
    ]);
    upright(s);
    await leaveRing(s, 'c07_m2');
  },

  // ================================================================== 3: Piccolo vs Frost
  c07_match3: async (s) => {
    await enterRing(s, 'piccolo', 'frost', 'Frost', 'c07_a_frost');
    await s.talk([
      ['c07_announcer', 'Match three! Piccolo of Universe 7 versus Frost!', 'shout'],
      ['piccolo', 'Goku doesn\'t get dizzy from a few punches. Whatever you did, you won\'t do it to me.', 'angry'],
      ['frost', 'Such suspicion. It wounds me.', 'smirk'],
    ]);
    s.remove('c07_foe');
    s.letterbox(false);
    const r = await s.fight('c07_frost3', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_frostF3' });
    bossExp(s, 'c07_frost3', r);
    s.letterbox(true);
    cast(s, 'c07_frostF3', 'frost', RING.foe.x, RING.foe.y, 'left', 'Frost');
    await s.say('piccolo', 'You\'re fast. So I\'ll let you come to me.', 'smirk');
    await s.walk('c07_frostF3', RING.hero.x + 2, RING.hero.y, 3);
    s.pose('hero', 'hurt');
    s.sfx('hit');
    await s.say('piccolo', 'Gotcha! Took the hit on purpose. Now you can\'t run!', 'shout');
    s.pose('hero', 'punch2');
    await s.powerUp('hero', '#f8f0a0', 40);
    await s.say('piccolo', 'Special Beam Cann--', 'shout');
    s.flash('#c0a0ff', 4);
    s.sfx('blastHit');
    s.tint('rgba(110,40,150,0.25)');
    s.pose('hero', 'hurt');
    await s.talk([
      ['piccolo', 'What...? My arm... won\'t...', 'hurt'],
      ['frost', 'Goodnight, Namekian.', 'smirk'],
    ]);
    await s.blast('c07_frostF3', 'hero', '#a070f0');
    await knockOut(s, 'hero', RING.westVoid.x, RING.hero.y);
    s.tint(null);
    await s.say('c07_announcer', 'Piccolo is out! Frost wins again!', 'shout');
    await s.pan(20, 23, 30);
    await s.talk([
      ['jaco', 'I SAW IT! Elite eyesight! He has a needle hidden in his wrist! He poisoned them both!', 'shout'],
      ['c07_galacticKing', 'Frost... I know that face. He is a space pirate wanted across a hundred planets. He sells protection from the attacks he arranges himself.', 'angry'],
      ['champa', 'Wh-what?! I didn\'t know! Vados, did you know?!', 'shock'],
      ['vados', 'I may have had my suspicions, my lord.', 'smirk'],
      ['beerus', 'Disqualify him! Give Goku his match back!', 'angry'],
      ['vegeta', 'No. Leave him in. I want to beat this cheat myself.', 'angry'],
    ]);
    s.follow();
    upright(s);
    await leaveRing(s, 'c07_m3');
  },

  // ================================================================== 4: Vegeta vs Frost
  c07_match4: async (s) => {
    await enterRing(s, 'vegeta', 'frost', 'Frost', 'c07_a_frost');
    await s.talk([
      ['c07_announcer', 'Match four! Vegeta versus Frost! Er... the needle has been confiscated! Probably!', 'shout'],
      ['vegeta', 'Try your little trick on me, pirate. I dare you.', 'smirk'],
    ]);
    s.remove('c07_foe');
    s.letterbox(false);
    const r = await s.fight('c07_frost4', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_frostF4' });
    bossExp(s, 'c07_frost4', r);
    s.letterbox(true);
    cast(s, 'c07_frostF4', 'frost', RING.foe.x, RING.foe.y, 'left', 'Frost');
    await s.say('vegeta', 'Enough. One punch.', 'angry');
    await s.walk('hero', RING.foe.x - 1, RING.foe.y, 4);
    s.pose('hero', 'punch2');
    await knockOut(s, 'c07_frostF4', RING.eastVoid.x, RING.foe.y);
    s.pose('hero', null);
    await s.say('c07_announcer', 'One punch! Frost is out of the ring! Vegeta wins!', 'shout');
    await s.talk([
      ['frost', 'If I can\'t win the prize... I\'ll TAKE it!', 'angry'],
    ]);
    await s.walk('c07_frostF4', 27, 5, 3);
    s.flash('#c070f0', 8);
    s.sfx('teleport');
    cast(s, 'c07_hitStop', 'hit', 27, 4, 'down', 'Hit');
    s.sfx('hit');
    s.shake(10, 2);
    s.pose('c07_frostF4', 'ko');
    await s.talk([
      ['hit', 'I was hired to win a tournament. Not to stand next to a thief.', 'neutral'],
      ['champa', 'Frost is disqualified! Completely! And... fine. Goku\'s loss doesn\'t count. He can fight again.', 'angry'],
      ['goku', 'Really?! Yahoo! Thanks, Champa!', 'happy'],
    ]);
    dismiss(s, 'c07_hitStop', 'c07_frostF4');
    await leaveRing(s, 'c07_m4');
  },

  // ================================================================== 5: Vegeta vs Magetta
  c07_match5: async (s) => {
    await enterRing(s, 'vegeta', 'c07_magetta', 'Magetta', 'c07_a_magetta');
    await s.talk([
      ['c07_announcer', 'Match five! Vegeta versus Auta Magetta, the metal giant of Universe 6!', 'shout'],
      ['c07_magetta', 'FSSSSSHHHHH...', 'angry'],
      ['champa', 'Magetta is molten metal from the inside out! Touch him and you\'ll be roasted!', 'smirk'],
    ]);
    await s.narrate('Magetta radiates heat: standing next to him burns you, and punching him barely works. Strike with ki from a distance!');
    s.remove('c07_foe');
    s.letterbox(false);
    s.tint('rgba(255,90,20,0.12)');
    const fight = s.fight('c07_magetta', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_magettaF' });
    const r = await duringFight(s, fight, 30, () => {
      const f = s.field;
      const boss = f.enemies.find((e) => e.uid === 'c07_magettaF');
      if (!boss || boss.ended || boss.dead) return;
      f.fx.aura(boss.x, boss.y, '#f86020', 3);
      const p = f.player;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < 36) {
        f.damagePlayer(boss.def.pow, 0.18, boss.x, boss.y, { noKnock: true, noInv: true });
      }
    });
    s.tint(null);
    bossExp(s, 'c07_magetta', r);
    s.letterbox(true);
    cast(s, 'c07_magettaF', 'c07_magetta', RING.foe.x, RING.foe.y, 'left', 'Magetta');
    await s.say('vegeta', 'Still standing, you overgrown boiler? Then take THIS!', 'shout');
    await s.powerUp('hero', '#f8f080', 40);
    await s.blast('hero', 'c07_magettaF', '#f8f080');
    s.shake(20, 3);
    await s.say('c07_magetta', 'FSSSSHHHH!', 'angry');
    const insult = await s.ask('vegeta', 'He shrugged off a Final Flash... Fine. Then I\'ll say what I really think of him.', [
      'You rusty bucket of bolts!', 'You\'re a glorified kettle!', 'Your mother was a toaster!',
    ]);
    const lines = [
      'You rusty, leaky bucket of bolts! You\'re not a warrior, you\'re a plumbing accident!',
      'Look at you, whistling like a kettle! Should I make tea on your head?',
      'I bet your mother was a toaster! A cheap one!',
    ];
    await s.say('vegeta', lines[insult], 'smirk');
    await s.emote('c07_magettaF', '...');
    await s.talk([
      ['c07_magetta', '...*sniff*... fsss... *sniffle*...', 'sad'],
    ]);
    await s.walk('c07_magettaF', RING.eastVoid.x, RING.foe.y + 1, 0.8);
    await s.talk([
      ['c07_announcer', 'Magetta... has walked out of the ring in tears! Vegeta wins!', 'shout'],
      ['champa', 'MAGETTA! He\'s sensitive! You can\'t just INSULT him!', 'angry'],
      ['vegeta', 'Hmph. A warrior with a glass heart. Next.', 'smirk'],
    ]);
    dismiss(s, 'c07_magettaF');
    await leaveRing(s, 'c07_m5');
  },

  // ================================================================== 6: Vegeta vs Cabba
  c07_match6: async (s) => {
    await enterRing(s, 'vegeta', 'cabba', 'Cabba', 'c07_a_cabba');
    await s.talk([
      ['c07_announcer', 'Match six! A battle of Saiyans! Vegeta versus Cabba!', 'shout'],
      ['cabba', 'It\'s an honour, Vegeta-san. I\'ve never been able to become a Super Saiyan. Please, show me how!', 'neutral'],
      ['vegeta', 'Then survive long enough to learn something.', 'smirk'],
    ]);
    s.remove('c07_foe');
    s.letterbox(false);
    const r1 = await s.fight('c07_cabba', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_cabbaF1' });
    bossExp(s, 'c07_cabba', r1);
    s.letterbox(true);
    cast(s, 'c07_cabbaF1', 'cabba', RING.foe.x, RING.foe.y, 'left', 'Cabba');
    await s.talk([
      ['vegeta', 'Pathetic. Is this what Sadala calls a warrior?', 'angry'],
      ['vegeta', 'When this is over, I think I\'ll visit your precious planet Sadala. And wipe it off the map.', 'smirk'],
      ['cabba', 'You... you wouldn\'t... NO! I WON\'T LET YOU!', 'angry'],
    ]);
    await s.powerUp('c07_cabbaF1', '#f8e048', 70);
    s.sprite('c07_cabbaF1', 'cabbaSSJ');
    s.shake(30, 3);
    await s.talk([
      ['cabba', 'What... is this? My hair... my power...', 'shock'],
      ['vegeta', 'That\'s it. That anger is what makes a Super Saiyan. Now, use it!', 'smirk'],
    ]);
    s.remove('c07_cabbaF1');
    s.letterbox(false);
    const r2 = await s.fight('c07_cabbaSSJ', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_cabbaF2' });
    bossExp(s, 'c07_cabbaSSJ', r2);
    s.letterbox(true);
    cast(s, 'c07_cabbaF2', 'cabbaSSJ', RING.foe.x, RING.foe.y, 'left', 'Cabba');
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 30);
    await s.say('vegeta', 'And this is what lies beyond it.', 'smirk');
    await s.walk('hero', RING.foe.x - 1, RING.foe.y, 4);
    s.pose('hero', 'punch2');
    await knockOut(s, 'c07_cabbaF2', RING.eastVoid.x, RING.foe.y);
    s.sprite('c07_cabbaF2', 'cabba');
    s.pose('hero', null);
    await s.talk([
      ['c07_announcer', 'Cabba is down outside the ring! Vegeta wins!', 'shout'],
      ['vegeta', 'Listen, Cabba. A Saiyan\'s pride is not something you inherit. You earn it every day you refuse to lose.', 'neutral'],
      ['vegeta', 'And for the record, I have no interest in your planet. Not yet.', 'smirk'],
      ['cabba', 'Thank you... Master Vegeta!', 'happy'],
      ['vegeta', '...Hmph. Don\'t call me that. Loudly.', 'smirk'],
    ]);
    dismiss(s, 'c07_cabbaF2');
    await leaveRing(s, 'c07_m6');
  },

  // ================================================================== 7: Vegeta vs Hit
  c07_match7: async (s) => {
    await enterRing(s, 'vegeta', 'hit', 'Hit', 'c07_a_hit');
    await s.talk([
      ['c07_announcer', 'Match seven! Vegeta versus Universe 6\'s final fighter... the legendary assassin, Hit!', 'shout'],
      ['c07_galacticKing', 'Hit stops time for a tenth of a second. That is how he has never failed a contract.', 'neutral'],
      ['vegeta', 'Three fights in a row. I\'m just getting warmed up.', 'smirk'],
    ]);
    s.transformNow('ssb');
    await s.narrate('Hit\'s Time-Skip freezes you for an instant before he strikes. Watch for the purple flash and keep moving!');
    s.remove('c07_foe');
    s.letterbox(false);
    const r = await s.fight('c07_hitV', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_hitF1', loseOk: true, survive: 50, label: 'HOLD ON' });
    bossExp(s, 'c07_hitV', r === 'lose' ? 'timeout' : r);
    s.letterbox(true);
    s.pose('hero', null);
    cast(s, 'c07_hitF1', 'hit', RING.foe.x, RING.foe.y, 'left', 'Hit');
    await s.talk([
      ['hit', 'You are strong. But you have fought three battles today. Your guard is slower than it was this morning.', 'neutral'],
      ['vegeta', 'Excuses are for... the weak...', 'angry'],
    ]);
    s.tint('rgba(80,40,120,0.35)');
    s.sfx('teleport');
    await s.wait(20);
    s.tint(null);
    s.place('c07_hitF1', RING.hero.x + 1, RING.hero.y, 'left');
    await knockOut(s, 'hero', RING.westVoid.x, RING.hero.y);
    await s.talk([
      ['c07_announcer', 'I... didn\'t even see it! Vegeta is out of the ring! Hit wins!', 'shout'],
      ['whis', 'Vegeta. A word, while you catch your breath.', 'neutral'],
      ['whis', 'Monaka is not a fighter. Lord Beerus brought him to make you and Goku try harder. Please keep that from Goku.', 'smirk'],
      ['vegeta', 'WHAT?! ...So it\'s all on Kakarot. Fantastic.', 'shock'],
    ]);
    dismiss(s, 'c07_hitF1');
    upright(s);
    await leaveRing(s, 'c07_m7');
  },

  // ================================================================== 8: Goku vs Hit
  c07_match8: async (s) => {
    await enterRing(s, 'goku', 'hit', 'Hit', 'c07_a_hit');
    await s.talk([
      ['c07_announcer', 'Goku has been reinstated! Match eight! Goku versus Hit!', 'shout'],
      ['goku', 'Time-Skip, huh? I\'ve been watching. I think I\'ve got a feel for it.', 'smirk'],
      ['hit', 'Then let us see if your feeling is faster than my time.', 'neutral'],
    ]);
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 30);
    s.remove('c07_foe');
    s.letterbox(false);
    const r1 = await s.fight('c07_hit1', { x: RING.foe.x, y: RING.foe.y, uid: 'c07_hitF2' });
    bossExp(s, 'c07_hit1', r1);
    s.letterbox(true);
    cast(s, 'c07_hitF2', 'hit', RING.foe.x, RING.foe.y, 'left', 'Hit');
    await s.talk([
      ['hit', 'You read my tenth of a second. Impressive. Then I will skip half a second instead.', 'neutral'],
      ['goku', 'Half a second?! That\'s a lifetime in a fight!', 'shock'],
    ]);
    s.tint('rgba(80,40,120,0.35)');
    s.sfx('teleport');
    s.shake(16, 2);
    s.pose('hero', 'hurt');
    await s.wait(16);
    s.tint(null);
    s.pose('hero', null);
    await s.talk([
      ['goku', 'Okay... guess I have to show you something I\'ve never shown anybody. Not even Whis.', 'smirk'],
      ['whis', 'Hm? What is he doing?', 'shock'],
      ['goku', 'Super Saiyan Blue... KAIO-KEN!', 'shout'],
    ]);
    await s.powerUp('hero', '#f83838', 70);
    s.transformNow('ssbkk');
    s.shake(30, 3);
    await s.narrate('Goku has unleashed Super Saiyan Blue Kaio-ken! It burns his HP every second - finish the fight fast!');
    await s.talk([
      ['beerus', 'Kaio-ken on top of a god\'s power?! His body will tear itself apart!', 'shock'],
      ['goku', 'Only for a little while! Let\'s go, Hit!', 'shout'],
    ]);
    s.remove('c07_hitF2');
    s.letterbox(false);
    stageBoss(s, 'c07_hit2', RING.foe.x, RING.foe.y, 'c07_hitF3', 0.6);
    const r2 = await s.fight('c07_hit2', { uid: 'c07_hitF3', existing: true });
    bossExp(s, 'c07_hit2', r2);
    s.letterbox(true);
    cast(s, 'c07_hitF3', 'hit', RING.foe.x, RING.foe.y, 'left', 'Hit');
    await s.say('goku', 'Kamehameha!', 'shout');
    await s.beamStruggle('gokuSSB', 'hit', '#f05050', '#c070f0', [
      'Hit: Time-Skip!',
      'Goku: I can see where you\'ll be!',
      'Hit: ...He is actually keeping up.',
      'Goku: HAAAAAA!',
    ], 0.24);
    s.flash('#ffffff', 16);
    s.boom(17, 13, 30, '#f8a0a0');
    s.transformNow(null);
    await s.talk([
      ['hit', '...I was holding back. Killing is forbidden here. I cannot use my true technique.', 'neutral'],
      ['goku', 'Yeah, me too. I don\'t want to win like this. Let\'s have a real fight someday, without anybody else\'s rules.', 'smirk'],
    ]);
    await s.walk('hero', RING.westVoid.x, RING.hero.y, 1);
    await s.talk([
      ['c07_announcer', 'G-Goku... has stepped out of the ring on purpose?! Hit wins!', 'shock'],
      ['beerus', 'WHAT ARE YOU DOING?! GET BACK IN THERE!', 'angry'],
      ['goku', 'Don\'t worry, Lord Beerus! We\'ve still got Monaka! I really wanna see him fight!', 'happy'],
    ]);
    dismiss(s, 'c07_hitF3');
    await leaveRing(s, 'c07_m8');
  },

  // ================================================================== 9: Monaka vs Hit → Zeno → Super Shenron
  c07_match9: async (s) => {
    s.letterbox(true);
    await s.fadeOut(16);
    force(s, 'goku');
    s.heal();
    await s.warp(ARENA_MAP, RING.bench.x, RING.bench.y, 'right');
    s.letterbox(true);
    hide(s, 'c07_a_hit');
    hide(s, 'c07_a_monaka');
    cast(s, 'c07_monakaR', 'monaka', 4, 16, 'right', 'Monaka');
    cast(s, 'c07_hitR', 'hit', RING.foe.x, RING.foe.y, 'left', 'Hit');
    await s.talk([
      ['c07_announcer', 'The final match! Universe 7\'s mightiest warrior... MONAKA!', 'shout'],
      ['goku', 'Finally! Go get him, Monaka! Show me what the strongest guy in our universe can do!', 'happy'],
      ['beerus', '(Whis... I may have miscalculated.)', 'shock'],
    ]);
    await s.walk('c07_monakaR', 7, RING.hero.y, 0.6);
    await s.flyTo('c07_monakaR', RING.hero.x, RING.hero.y, 1.2);
    await s.lift('c07_monakaR', 0, 8);
    await s.emote('c07_monakaR', '!');
    await s.talk([
      ['monaka', '...!!!', 'shock'],
      ['hit', '...', 'neutral'],
      ['hit', 'I forfeit.', 'neutral'],
      ['champa', 'WHAT?!', 'shock'],
      ['hit', 'He trembles with killing intent so strong it shakes his whole body. I would rather not test it.', 'neutral'],
      ['c07_announcer', 'Hit forfeits! Universe 7 wins the tournament!', 'shout'],
    ]);
    s.music('victory');
    await s.flyTo('c07_hitR', RING.eastVoid.x + 1, RING.foe.y, 1.5);
    s.remove('c07_hitR');
    await s.pan(26, 4, 30);
    await s.talk([
      ['champa', 'Useless! All of you! I\'ll destroy every last one of my fighters for this!', 'angry'],
    ]);
    if (s.exists('c07_a_champa')) await s.powerUp('c07_a_champa', '#a050e0', 40);
    // The Omni-King.
    s.music('godly');
    s.flash('#ffffff', 20);
    s.shake(30, 2);
    s.sfx('teleport');
    cast(s, 'c07_zeno', 'zeno', 17, 4, 'down', 'Zeno');
    cast(s, 'c07_att1', 'c07_attendant', 15, 4, 'down', 'Attendant');
    cast(s, 'c07_att2', 'c07_attendant', 19, 4, 'down', 'Attendant');
    await s.pan(17, 6, 30);
    await s.talk([
      ['c07_attendant', 'All bow before the King of All, Lord Zeno!', 'shout'],
      ['beerus', 'L-Lord Zeno?! Champa, get DOWN!', 'shock'],
      ['champa', 'M-my apologies for the noise, Your Majesty!', 'shock'],
      ['zeno', 'That was fun! I watched the whole thing. Fighting is fun.', 'happy'],
      ['zeno', 'Let\'s do a big one next time! With all the universes!', 'happy'],
    ]);
    await s.walk('hero', 6, 5, 2);
    await s.walk('hero', 16, 5, 2);
    s.face('hero', 'right');
    await s.talk([
      ['goku', 'Hiya! I\'m Goku! Nice to meet ya, little guy!', 'happy'],
      ['beerus', '(Goku, you idiot! He can erase universes with a THOUGHT!)', 'shock'],
      ['zeno', 'Goku. Okay! I\'ll remember you! Bye-bye!', 'happy'],
    ]);
    s.flash('#ffffff', 20);
    s.sfx('teleport');
    dismiss(s, 'c07_zeno', 'c07_att1', 'c07_att2');
    await s.talk([
      ['vados', 'As promised, Lord Beerus: the six Super Dragon Balls are waiting in orbit. Your prize.', 'neutral'],
      ['bulma', 'Hey, everyone! My radar finally woke up! Six blips in orbit... and the seventh is RIGHT UNDER OUR FEET!', 'shock'],
      ['whis', 'Of course. This "Nameless Planet" is the seventh Super Dragon Ball, buried under a few million years of space junk.', 'smirk'],
      ['champa', 'WHAT?! I searched two universes for that thing! I had a TOURNAMENT on it!', 'shock'],
    ]);
    s.follow();
    // Super Shenron rises over the stadium.
    s.set('c07_shenronUp');
    await s.fadeOut(24, '#ffffff');
    await s.warp('c07_nameless_grounds', 19, 13, 'up');
    s.letterbox(true);
    cast(s, 'c07_s_beerus', 'beerus', 17, 14, 'up', 'Beerus');
    cast(s, 'c07_s_whis', 'whis', 21, 14, 'up', 'Whis');
    cast(s, 'c07_s_champa', 'champa', 24, 15, 'up', 'Champa');
    await s.pan(19, 7, 50);
    s.tint('rgba(248,200,60,0.18)');
    s.shake(60, 2);
    await s.talk([
      ['whis', 'Rise, Super Shenron, in the language of the old gods... Here he comes.', 'neutral'],
      ['narrator', 'A golden dragon unfurls across the sky - so vast that galaxies drift between its scales.'],
      ['shenronAvatar', 'I AM SUPER SHENRON. STATE YOUR WISH. ANY WISH WITHIN MY POWER WILL BE GRANTED.', 'neutral'],
      ['beerus', 'Whis. Translate my wish. Quietly.', 'neutral'],
    ]);
    await s.narrate('Beerus whispers into Whis\'s ear. Whis smiles, and speaks in the language of the gods.');
    s.flash('#f8e070', 20);
    await s.talk([
      ['shenronAvatar', 'YOUR WISH HAS BEEN GRANTED. FAREWELL.', 'neutral'],
    ]);
    s.flash('#ffffff', 16);
    s.set('c07_shenronGone');
    s.field.map.removeProp('c07_shenronProp');
    s.tint(null);
    s.follow();
    await s.talk([
      ['goku', 'So what did you wish for, Lord Beerus?', 'neutral'],
      ['beerus', 'A more comfortable bed. Obviously.', 'smirk'],
      ['vados', '(Universe 6\'s Earth and all its people, restored. How sentimental, Lord Beerus.)', 'smirk'],
      ['champa', 'HEY! Wait, why does my universe have an Earth again?! ...Vados, pack my fork!', 'shock'],
    ]);
    s.set('c07_m9');
    s.set('c07_done');
    await s.done('c07_tournament', false);
    unforce(s);
    s.unlockRegion('spot_nameless');
    s.heal();
    await s.give('pow3');
    s.exp(15000);
    await s.fadeOut(30);
    if (s.hasScript('c08_start')) await s.call('c08_start');
  },

  // ================================================================== boss phase taunts
  c07_magetta_steam: async (s) => {
    s.banner('Magetta vents scalding steam!');
    s.sfx('explode');
  },
});
