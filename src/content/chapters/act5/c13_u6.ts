import { FORMS } from '../../characters';
import { STAT_CAP } from '../../../game/leveling';
import type { Dir } from '../../../engine/math';
import { registerScripts, type ScriptApi } from '../../../game/script';
import { force, unforce } from '../common';
import { battle, bossFight, freeNear, heroTile, refresh, rememberHero, removeAll, restoreHero, stage, warpTo } from './helpers';
import { SADALA } from './c13_maps';

/**
 * Chapter 13 side episode, "Meanwhile, in Universe 6" (anime eps 88-93), told in two cutaways where the anime cuts
 * to Sadala. Part one (eps 88-89, gold `c13_u6`) plays as soon as Gohan has trained or Tien has joined: Champa sends
 * Cabba home for fighters, his old captain Renso points him at his sister Caulifla, her gang jumps him, and his
 * golden hair wins her over. Part two (eps 92-93, gold `c13_u6kale`) plays between Goku's Frieza pitch and his visit
 * to Hell: Caulifla's first Super Saiyan, her spar with Cabba, then Kale's first berserk Legendary form, which
 * Caulifla talks down. The player controls Cabba, drawn as an outfit over Vegeta (Chapter 11's Vegito precedent):
 * Vegeta's level and techniques, with his own Z forms set aside so the costume never turns into Vegeta's hair.
 * Canon never has Goku meet them before the Tournament of Power, so he does not: Caulifla's first words to him in
 * Chapter 14 stay true, and her Super Saiyan 2 waits for Goku's lesson in the tournament (ep 100).
 *
 * Post-game, Cabba comes to Capsule Corp to thank Master Vegeta, Sadala opens on the space map, and Caulifla and
 * Kale want a rematch (bronze).
 */

/** Vegeta's HP, EP and Z form before he stood in for Cabba (restored when a cutaway ends). */
const STASH = 'c13_u6Stash';
/** Stat points Cabba's Super Saiyan added (so they come off exactly). */
const BOOST = 'c13_u6Boost';
/** Raised while berserk Kale is loose: the A-trigger beside Caulifla works only then. */
const RAMPAGE = 'c13_u6Rampage';
const KALE_UID = 'c13_kale1';

/** Put the player in Cabba's shoes: Vegeta forced, costume on, Z forms off, fresh HP/EP (a new fighter steps in). */
function becomeCabba(s: ScriptApi): void {
  const c = s.state.char('vegeta');
  if (s.state.get(STASH) === undefined) s.set(STASH, `${c.hp},${c.ep},${c.form ?? ''}`);
  force(s, 'vegeta');
  s.transformNow(null);
  c.form = null;
  s.outfit('vegeta', 'cabba');
  refresh(s, 'vegeta');
}

/** Cabba's Super Saiyan on (golden costume, the form's stat bonus) or off. Safe to call twice either way. */
function cabbaSSJ(s: ScriptApi, on: boolean): void {
  const c = s.state.char('vegeta');
  const raw = s.state.get(BOOST);
  const bonus = FORMS.ssj.bonus === 'max' ? 0 : FORMS.ssj.bonus;
  if (on && raw === undefined) {
    const add = (v: number): number => Math.max(0, Math.min(bonus, STAT_CAP - v));
    const a = [add(c.str), add(c.pow), add(c.end)];
    c.str += a[0];
    c.pow += a[1];
    c.end += a[2];
    s.set(BOOST, a.join(','));
  } else if (!on && typeof raw === 'string') {
    const [a, b, d] = raw.split(',').map((v) => parseInt(v, 10) || 0);
    c.str -= a;
    c.pow -= b;
    c.end -= d;
    s.clear(BOOST);
  }
  s.outfit('vegeta', on ? 'cabbaSSJ' : 'cabba');
}

/** Back to Vegeta: costume and boost off, his Z form and the HP/EP he had before the cutaway back. */
function leaveCabba(s: ScriptApi): void {
  cabbaSSJ(s, false);
  const c = s.state.char('vegeta');
  const raw = s.state.get(STASH);
  if (typeof raw === 'string') {
    const [hp, ep, form] = raw.split(',');
    c.hp = Math.max(1, Math.min(c.hpMax, parseInt(hp, 10) || c.hpMax));
    c.ep = Math.max(0, Math.min(c.epMax, parseInt(ep, 10) || 0));
    if (form) c.form = form;
  }
  s.clear(STASH);
  s.outfit('vegeta', null);
}

/** Where Universe 7's story stood when a cutaway began, and who was playing it (forced or free). */
interface Universe7 {
  map: string;
  x: number;
  y: number;
  dir: Dir;
  forced: boolean;
}

/** Remember Universe 7's side before cutting away to Sadala. */
function leaveUniverse7(s: ScriptApi): Universe7 {
  rememberHero(s, 'u6');
  const [x, y] = heroTile(s);
  return { map: s.field.def.id, x, y, dir: s.field.player.dir, forced: s.flag('noSwitch') };
}

/**
 * Cut back to Universe 7: Cabba hands the controls back to whoever was playing, forced or free as before.
 * With `here`, the story carries on from wherever it is staged next (no warp back to the old spot).
 */
async function backToUniverse7(s: ScriptApi, u7: Universe7, here = false): Promise<void> {
  leaveCabba(s);
  if (!u7.forced) unforce(s);
  restoreHero(s, 'u6');
  if (here) return;
  await s.narrate('Back in Universe 7...');
  await warpTo(s, u7.map, u7.x, u7.y, u7.dir);
}

/** Tile of an actor (cutscene NPC, enemy or hero). */
function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.floor(a.x / 16), Math.floor((a.y - 14) / 16)];
}

/** Part one's scenes as Cabba: Champa's order, then the old quarter. Ends faded out on Sadala, journal updated. */
async function recruitCaulifla(s: ScriptApi): Promise<void> {
  await s.quest('c13_u6', true);
  await s.narrate('Meanwhile, in Universe 6...');
  becomeCabba(s);
  await s.call('c13_u6_champa');
  await s.call('c13_u6_quarter');
  await s.done('c13_u6', false);
  s.letterbox(false);
  await s.fadeOut(16);
}

registerScripts({
  // ================================================================ part one: Cabba recruits Caulifla (eps 88-89)
  /** Called from `c13_check` once Gohan has trained or Tien has joined (whichever comes first). */
  c13_u6_recruit: async (s) => {
    if (s.check('done:c13_u6')) return;
    const u7 = leaveUniverse7(s);
    await s.fadeOut(16);
    await recruitCaulifla(s);
    await backToUniverse7(s, u7);
  },

  /** Ep 88: Champa is short of fighters and sends Cabba home to Sadala to find Saiyans. */
  c13_u6_champa: async (s) => {
    const T = SADALA.terrace;
    await warpTo(s, 'c13_champa_terrace', T.arrive[0], T.arrive[1], 'up');
    s.letterbox(true);
    s.music('godly');
    stage(s, 'c13_champaT', 'champa', T.champa[0], T.champa[1], 'down', 'Champa');
    stage(s, 'c13_vadosT', 'vados', T.vados[0], T.vados[1], 'down', 'Vados');
    await s.walk('hero', T.arrive[0], T.arrive[1] - 2, 1);
    await s.talk([
      ['champa', 'Seventy rival fighters, and Beerus has Goku AND Vegeta. Hit can\'t win this all by himself!', 'angry'],
      ['vados', 'Botamo and Magetta have agreed to fight again, my lord. Hit is making inquiries of his own.', 'smirk'],
      ['champa', 'Cabba! You\'re a Saiyan. Your planet is FULL of Saiyans. Bring me strong ones!', 'shout'],
      ['cabba', 'Yes, Lord Champa! My old captain, Renso, knows every fighter on Sadala. I\'ll start with him.', 'neutral'],
      ['vados', 'Do hurry. If Universe 6 loses, we will all be erased. Lord Champa first, I imagine.', 'happy'],
      ['champa', 'VADOS!', 'shout'],
    ]);
    s.letterbox(false);
    await s.fadeOut(16);
    removeAll(s, 'c13_champaT', 'c13_vadosT');
    await s.narrate('You are now Cabba, Vegeta\'s student from Universe 6. He fights with what his master taught him: Vegeta\'s level and techniques.');
  },

  /** Eps 88-89: Renso points Cabba at his sister; her gang jumps the Defense Force ace; Caulifla is curious. */
  c13_u6_quarter: async (s) => {
    const Q = SADALA.quarter;
    await warpTo(s, 'c13_sadala_quarter', Q.arrive[0], Q.arrive[1], 'up');
    s.letterbox(true);
    s.music('alien');
    stage(s, 'c13_rensoQ', 'c13_renso', Q.renso[0], Q.renso[1], 'down', 'Renso');
    s.pose('c13_rensoQ', 'hurt');
    await s.walk('hero', Q.renso[0], Q.renso[1] + 2, 1);
    s.face('hero', 'up');
    await s.talk([
      ['c13_renso', 'Cabba! The ace of the Sadala Defense Force, visiting a retired old soldier. Sorry, the door... ow, my leg.', 'hurt'],
      ['cabba', 'Captain Renso! There\'s going to be a tournament between universes. If we lose, Universe 6 is erased. I need fighters.', 'shock'],
      ['c13_renso', 'With this leg I\'d only slow you down. But my little sister... she\'s a punk, but her potential is bigger than mine ever was.', 'neutral'],
      ['c13_renso', 'Caulifla. She runs a gang in the old quarter. Even the Defense Force stays off her streets.', 'smirk'],
      ['cabba', 'Caulifla... Thank you, Captain. I\'ll bring her to the tournament!', 'happy'],
    ]);
    s.pose('c13_rensoQ', null);
    s.music('tense');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_punkQ', 'c13_gangPunk', hx + 5, hy, 'left', 'Gang Punk');
    await s.walk('c13_punkQ', hx + 3, hy, 2);
    await s.talk([
      ['c13_punkQ', 'Defense Force armour in OUR quarter? Somebody\'s lost.', 'smirk'],
      ['cabba', 'I\'m looking for Caulifla. I only want to talk to her!', 'neutral'],
      ['c13_punkQ', 'Everybody wants to talk to the boss. Nobody gets to. Hey, guys! Fresh meat!', 'shout'],
    ]);
    removeAll(s, 'c13_punkQ', 'c13_rensoQ');
    s.letterbox(false);
    s.music('battle');
    const types = ['c13_gangPunk', 'c13_gangBrute', 'c13_gangSlinger', 'c13_gangPunk', 'c13_gangSlinger', 'c13_gangBrute', 'c13_gangPunk', 'c13_gangPunk'];
    Q.gang.forEach(([x, y], i) => {
      const [gx, gy] = freeNear(s, x, y);
      s.spawnEnemy(types[i % types.length], gx, gy).onDefeat = 'c13_u6_gangDown';
    });
    s.banner('Caulifla\'s gang is all over the old quarter. Knock every one of them down!');
    await battle(s);
    s.letterbox(true);
    s.music('tense');
    await s.narrate('The street goes quiet. A whistle comes from the walled yard at the east end of it.');
    // Caulifla's yard: she waits on her throne, Kale peeks out from behind her, a henchman bars the way.
    await s.fadeOut(12);
    s.place('hero', Q.gate[0], Q.gate[1] + 1, 'up');
    stage(s, 'c13_cauliflaQ', 'caulifla', Q.throne[0], Q.throne[1], 'down', 'Caulifla');
    stage(s, 'c13_kaleQ', 'kale', Q.kale[0], Q.kale[1], 'left', 'Kale');
    stage(s, 'c13_henchQ', 'c13_gangBrute', Q.henchman[0], Q.henchman[1], 'down', 'Gang Bruiser');
    await s.fadeIn(12);
    await s.walk('hero', Q.gate[0], Q.throne[1] + 3, 1);
    s.face('hero', 'up');
    await s.pan(Q.throne[0], Q.throne[1] + 1, 24);
    await s.talk([
      ['caulifla', 'So you\'re the one flattening my crew. What does the Defense Force want with me?', 'smirk'],
      ['cabba', 'Renso sent me. Universe 6 needs ten fighters for a tournament against the other universes. If we lose, everything is erased.', 'neutral'],
      ['caulifla', 'Universes, gods, the end of everything... Not my problem. Get lost.', 'neutral'],
      ['kale', '(S-sis... who is he...?)', 'sad'],
      ['c13_henchQ', 'You heard the boss. Out you go, soldier boy.', 'angry'],
    ]);
    await s.walk('c13_henchQ', Q.throne[0], Q.throne[1] + 2, 2);
    s.face('c13_henchQ', 'hero');
    cabbaSSJ(s, true);
    await s.powerUp('hero', '#f8e048', 40);
    // One golden punch sends the henchman tumbling across the yard.
    s.pose('hero', 'punch1');
    s.sfx('hit');
    s.flash('#f8e048', 6);
    const [ex, ey] = freeNear(s, Q.henchman[0] - 2, Q.henchman[1] + 3);
    await s.walk('c13_henchQ', ex, ey, 5);
    s.pose('hero', null);
    s.pose('c13_henchQ', 'ko');
    s.shake(14, 2);
    await s.talk([
      ['caulifla', 'Whoa... your hair just turned GOLD. What was that?! Do it again!', 'shock'],
      ['cabbaSSJ', 'It\'s called Super Saiyan. Join the team, and I\'ll teach you how.', 'neutral'],
      ['caulifla', 'I\'m still not saving any universes... But fine. You\'ve got yourself a student. Teach me first, then we\'ll see.', 'smirk'],
      ['kale', '(Sis... is going to go away with him...)', 'sad'],
    ]);
    cabbaSSJ(s, false);
    removeAll(s, 'c13_cauliflaQ', 'c13_kaleQ', 'c13_henchQ');
    s.follow();
  },

  // ================================================================ part two: a Legendary Super Saiyan (eps 92-93)
  /**
   * Called from `c13_whis_frieza` between Goku's Frieza pitch and his visit to Hell. A save that skipped part one
   * (Gohan and Tien already in before it existed) plays it first, straight into part two.
   */
  c13_u6_episode: async (s) => {
    if (s.check('done:c13_u6kale')) return;
    const u7 = leaveUniverse7(s);
    await s.fadeOut(16);
    if (!s.check('done:c13_u6')) {
      await recruitCaulifla(s);
      await s.narrate('A few days later...');
    } else {
      await s.narrate('Meanwhile, in Universe 6. A few days later...');
    }
    await s.quest('c13_u6kale', true);
    becomeCabba(s);
    await s.call('c13_u6_crags');
    await s.call('c13_u6_epilogue');
    await backToUniverse7(s, u7, true);
  },

  /** Eps 92-93: the lesson in the crags, Caulifla's first Super Saiyan, the spar, then Kale. */
  c13_u6_crags: async (s) => {
    const C = SADALA.crags;
    await warpTo(s, 'c13_sadala_crags', C.centre[0] - 5, C.centre[1], 'right');
    s.letterbox(true);
    s.music('alien');
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_cauliflaC', 'caulifla', hx + 3, hy, 'left', 'Caulifla');
    await s.talk([
      ['caulifla', 'Alright, teacher. How do I get the golden hair?', 'smirk'],
      ['cabba', 'Master Vegeta made me so furious I transformed. Should I... call you names?', 'neutral'],
      ['caulifla', 'Try it and I\'ll break your face.', 'angry'],
      ['cabba', 'Right. Then... focus on a spot in your back. A sort of tingling. Let it rise up through you.', 'neutral'],
      ['caulifla', 'A tingle in my back... Like... THIS?!', 'shout'],
    ]);
    await s.powerUp('c13_cauliflaC', '#f8e048', 60);
    s.sprite('c13_cauliflaC', 'c13_cauliflaSSJ');
    s.boom(hx + 3, hy, 20, '#f8e048');
    s.shake(24, 3);
    await s.talk([
      ['caulifla', 'Ha! HAHA! Look at this! I feel like I could punch a hole in the planet!', 'happy'],
      ['cabba', 'On the first try?! It took me... Master Vegeta had to threaten to destroy Sadala!', 'shock'],
      ['caulifla', 'Bet I could take you right now. Come on, teacher. Show me what Super Saiyan is for!', 'smirk'],
    ]);
    cabbaSSJ(s, true);
    await s.powerUp('hero', '#f8e048', 30);
    s.letterbox(false);
    s.music('battle');
    const [cx, cy] = tileOf(s, 'c13_cauliflaC');
    s.remove('c13_cauliflaC');
    const r = await bossFight(s, 'c13_cauliflaSSJ', { x: cx, y: cy, uid: 'c13_caul1', loseOk: true });
    if (r === 'lose') refresh(s, 'vegeta');
    s.letterbox(true);
    const [fx, fy] = s.exists('c13_caul1') ? tileOf(s, 'c13_caul1') : [cx, cy];
    removeAll(s, 'c13_caul1');
    stage(s, 'c13_cauliflaC2', 'c13_cauliflaSSJ', fx, fy, 'left', 'Caulifla');
    s.pose('c13_cauliflaC2', 'hurt');
    await s.wait(20);
    s.sprite('c13_cauliflaC2', 'caulifla');
    await s.talk([
      r === 'lose'
        ? ['caulifla', 'Ha! Told you I\'d flatten you! ...Wait. Why am I so... tired...?', 'hurt']
        : ['caulifla', 'Hah... hah... I was just getting started! So why am I so... tired...?', 'hurt'],
      ['cabbaSSJ', 'Super Saiyan burns stamina fast. You\'ll get used to it. We\'ll call this one a draw.', 'neutral'],
      ['caulifla', 'A draw. For now.', 'smirk'],
    ]);
    cabbaSSJ(s, false);
    // The two catch their breath on the west side of the sparring ground.
    await s.fadeOut(12);
    removeAll(s, 'c13_cauliflaC2');
    s.place('hero', C.centre[0] - 6, C.centre[1], 'right');
    stage(s, 'c13_cauliflaC2', 'caulifla', C.centre[0] - 3, C.centre[1], 'left', 'Caulifla');
    await s.fadeIn(12);
    await s.call('c13_u6_kale');
  },

  /** Ep 93: Kale's turn. Her jealousy erupts into the Legendary form; Caulifla has to bring her back. */
  c13_u6_kale: async (s) => {
    const C = SADALA.crags;
    if (!s.exists('c13_cauliflaC2')) {
      const [hx, hy] = heroTile(s);
      stage(s, 'c13_cauliflaC2', 'caulifla', hx + 3, hy, 'left', 'Caulifla');
    }
    await s.talk([['caulifla', 'Kale! I know you\'re behind that rock. Get out here, you\'re next!', 'shout']]);
    stage(s, 'c13_kaleC', 'kale', C.kaleHide[0], C.kaleHide[1], 'down', 'Kale');
    await s.pan(C.kaleHide[0], C.kaleHide[1] + 2, 24);
    const [kx, ky] = freeNear(s, C.centre[0] + 2, C.centre[1] - 3);
    await s.walk('c13_kaleC', kx, ky, 1);
    s.follow();
    await s.talk([
      ['kale', 'I-I\'m sorry, sis. I can\'t do it... I\'m not a real Saiyan like you.', 'sad'],
      ['caulifla', 'Then get ANGRY! Cabba, insult her. That\'s how your master did it, right?', 'angry'],
      ['cabba', 'Er... Miss Kale, you are... not very... um... good at... being... stern?', 'shock'],
      ['kale', '...', 'sad'],
      ['caulifla', 'You made her cry! What is WRONG with you?!', 'angry'],
    ]);
    if (s.exists('c13_cauliflaC2')) {
      const [hx, hy] = heroTile(s);
      await s.walk('c13_cauliflaC2', hx + 1, hy, 2);
      s.face('c13_cauliflaC2', 'hero');
    }
    await s.talk([
      ['cabba', 'I-I didn\'t mean to! Let go of my collar!', 'shock'],
      ['kale', 'Sis... you and him... You\'re going to leave me behind, aren\'t you...?', 'sad'],
      ['kale', 'I WON\'T... LET HIM... TAKE YOU AWAY!', 'shout'],
    ]);
    s.music('tense');
    await s.powerUp('c13_kaleC', '#a0f060', 80);
    s.sprite('c13_kaleC', 'c13_kaleBerserk');
    s.flash('#d0ff90', 16);
    s.shake(40, 3);
    s.boom(kx, ky, 26, '#a0f060');
    await s.talk([
      ['caulifla', 'WHOA! Kale, look at you! Look at those muscles! That\'s amazing!', 'happy'],
      ['cabba', 'Her eyes... she can\'t hear anything! Caulifla, she\'s coming straight for me!', 'shock'],
    ]);
    // Caulifla backs off to the east rim to cheer: she has to be reached before she will step in.
    if (s.exists('c13_cauliflaC2')) {
      s.place('c13_cauliflaC2', C.caulifla[0], C.caulifla[1], 'left');
      s.aura('c13_cauliflaC2', null);
    } else stage(s, 'c13_cauliflaC2', 'caulifla', C.caulifla[0], C.caulifla[1], 'left', 'Caulifla');
    await s.say('caulifla', 'Go, Kale! Show him what you\'ve got!', 'happy');
    cabbaSSJ(s, true);
    await s.powerUp('hero', '#f8e048', 20);
    s.letterbox(false);
    s.music('battle');
    s.remove('c13_kaleC');
    s.set(RAMPAGE);
    s.banner('Nothing reaches Kale! Hold out, or get to Caulifla and press A to shout for help!');
    const r = await bossFight(s, 'c13_kaleBerserk', { x: kx, y: ky, uid: KALE_UID, survive: 40, loseOk: true, label: 'SURVIVE' });
    s.clear(RAMPAGE);
    s.letterbox(true);
    const shouted = s.flag('c13_u6Shouted');
    s.clear('c13_u6Shouted');
    // Knocked down (as in the anime): Cabba is still on the ground when Kale winds up the finishing blast.
    if (r === 'lose') s.pose('hero', 'ko');
    const [bx, by] = s.exists(KALE_UID) ? tileOf(s, KALE_UID) : [kx, ky];
    removeAll(s, KALE_UID);
    stage(s, 'c13_kaleC2', 'c13_kaleBerserk', bx, by, 'down', 'Kale');
    s.face('c13_kaleC2', 'hero');
    if (shouted) await s.say('cabbaSSJ', 'Caulifla, PLEASE! She won\'t stop! She\'s going to kill me!', 'shout');
    s.pose('c13_kaleC2', 'charge');
    s.aura('c13_kaleC2', '#a0f060');
    await s.say('kale', 'GRAAAAH!', 'shout');
    // Caulifla throws herself between them (ep 93). Kale's blast tears past them both and takes the far ridge
    // with it; then Caulifla talks her down.
    const [hx, hy] = heroTile(s);
    if (s.exists('c13_cauliflaC2')) {
      const [mx, my] = freeNear(s, Math.round((hx + bx) / 2), Math.round((hy + by) / 2));
      s.sprite('c13_cauliflaC2', 'c13_cauliflaSSJ');
      s.aura('c13_cauliflaC2', '#f8e048');
      s.sfx('dash');
      await s.walk('c13_cauliflaC2', mx, my, 6);
      s.face('c13_cauliflaC2', 'c13_kaleC2');
      await s.say('caulifla', 'KALE! STOP!', 'shout');
    }
    // The blast goes wide, over everyone's heads, into the ridge on the far side of the crags.
    const [rx, ry] = [bx < 20 ? 34 : 5, 2];
    s.spawn('c13_u6Ridge', 'kale', rx, ry, 'down');
    s.show('c13_u6Ridge', false);
    await s.blast('c13_kaleC2', 'c13_u6Ridge', '#a0f060');
    s.remove('c13_u6Ridge');
    s.flash('#ffffff', 14);
    s.boom(rx, ry, 30, '#a0f060');
    s.boom(rx + (rx > 20 ? -3 : 3), ry + 1, 24, '#d0ff90');
    s.shake(50, 4);
    s.pose('c13_kaleC2', null);
    s.aura('c13_kaleC2', null);
    s.pose('hero', null);
    await s.talk([
      ['caulifla', 'That\'s ENOUGH, Kale! Look at me! It\'s me!', 'shout'],
      ['caulifla', 'You think I\'d ditch you for this guy? Not in a million years. You\'re my little sis. Nobody\'s taking me anywhere.', 'happy'],
      ['kale', '...Sis...', 'sad'],
    ]);
    s.sprite('c13_kaleC2', 'kale');
    s.pose('c13_kaleC2', 'ko');
    if (s.exists('c13_cauliflaC2')) {
      s.aura('c13_cauliflaC2', null);
      s.sprite('c13_cauliflaC2', 'caulifla');
    }
    cabbaSSJ(s, false);
    s.music('peaceful');
    await s.talk([
      ['cabba', 'That power... it\'s nothing like a normal Super Saiyan. And that ridge... it\'s just GONE.', 'shock'],
      ['caulifla', 'Heh. Fine. We\'re in, Cabba. Both of us. Somebody has to watch her back... and somebody has to beat those Universe 7 Saiyans you keep talking about.', 'smirk'],
    ]);
    s.set('c13_u6KaleCalmed');
    removeAll(s, 'c13_kaleC2', 'c13_cauliflaC2');
    s.letterbox(false);
  },

  /** One of Caulifla's gang goes down during the brawl: say how many are still hiding in the quarter. */
  c13_u6_gangDown: async (s) => {
    const left = s.field.enemies.filter((e) => e.def.id.startsWith('c13_gang') && !e.dead && e.state !== 'dying').length;
    if (left > 0) s.toast(left === 1 ? 'One of Caulifla\'s gang is still out there!' : `${left} of Caulifla's gang are still out there.`);
  },

  /** A-trigger beside Caulifla while Kale rampages: Cabba gets through to her, and she steps in. */
  c13_u6_shout: async (s) => {
    if (!s.flag(RAMPAGE)) return;
    const kale = s.field.enemies.find((e) => e.uid === KALE_UID && !e.dead && !e.ended);
    if (!kale) return;
    s.set('c13_u6Shouted');
    s.clear(RAMPAGE);
    kale.ended = true;
    kale.state = 'ended';
    s.sfx('powerUp');
    s.flash('#f8e048', 8);
  },

  /** Champa's verdict (Hit has brought Frost in by now, ep 91), then back to Goku on his way to Hell. */
  c13_u6_epilogue: async (s) => {
    const T = SADALA.terrace;
    await s.fadeOut(16);
    await warpTo(s, 'c13_champa_terrace', T.arrive[0], T.arrive[1] - 2, 'up');
    s.letterbox(true);
    s.music('godly');
    stage(s, 'c13_champaT', 'champa', T.champa[0], T.champa[1], 'down', 'Champa');
    stage(s, 'c13_vadosT', 'vados', T.vados[0], T.vados[1], 'down', 'Vados');
    s.face('hero', 'up');
    await s.talk([
      ['vados', 'Two new Saiyans, my lord. One went Super Saiyan on her first try. The other levelled a mountain ridge by accident.', 'smirk'],
      ['vados', 'And Hit has returned with Frost, who swears he is a reformed man.', 'smirk'],
      ['champa', 'Reformed, schmeformed. A fighter is a fighter! Take THAT, Beerus! Universe 6 can\'t lose now!', 'happy'],
      ['vados', 'Do try to learn their names before the tournament.', 'smirk'],
      ['champa', 'Cabbage, Cauliflower and Kale. Easy!', 'happy'],
      ['cabba', '...It\'s Cabba, Lord Champa.', 'sad'],
    ]);
    removeAll(s, 'c13_champaT', 'c13_vadosT');
    await s.done('c13_u6kale', false);
    s.letterbox(false);
    await s.fadeOut(20);
    s.set('world', 'earth');
  },

  c13_caulifla_p2: async (s) => {
    await s.say('c13_cauliflaSSJ', 'This is FUN! Come on, teacher, hit me harder!', 'happy');
  },

  // ================================================================ post-game: Cabba at Capsule Corp, then Sadala
  c13_cabba_cc: async (s) => {
    const vegeta = s.hero === 'vegeta';
    if (!s.flag('post_game')) {
      await s.say('cabba', 'Excuse me! Is Master Vegeta at home?', 'happy');
      return;
    }
    if (!s.flag('c13_sadalaOpen')) {
      await s.talk(vegeta ? [
        ['cabba', 'Master Vegeta! Universe 6 is back, and I wanted to thank you in person. You taught me what pride really means.', 'happy'],
        ['vegeta', 'Hmph. You came all this way to say that? ...Stand up straight, Cabba.', 'smirk'],
      ] : [
        ['cabba', 'Hello again! I came to thank Master Vegeta. Universe 6 is back, thanks to your Android 17.', 'happy'],
        ['hero', 'Glad you made it, Cabba!', 'happy'],
      ]);
      await s.talk([
        ['cabba', 'I also have a message. Caulifla and Kale want a rematch with Universe 7. Caulifla says she\'s been "practising".', 'neutral'],
        ['cabba', 'Lady Vados says you are welcome on Sadala. Look for them in the old quarter. Please don\'t level it.', 'smirk'],
      ]);
      s.set('c13_sadalaOpen');
      s.unlockRegion('c13_spot_sadala');
      await s.narrate('Sadala (U6) has been added to the space map.');
      await s.quest('c13_sadala');
      return;
    }
    if (s.check('done:c13_sadala')) {
      await s.say('cabba', 'Caulifla says the rematch was "a warm-up". She has been training every day since. So has Kale. So have I!', 'happy');
      return;
    }
    const lines = vegeta
      ? ['Master Vegeta, did you really train inside a room where a year passes in a day? Could I...?', 'I\'ll wait here until you say I\'m strong enough. ...That could take a while, couldn\'t it?']
      : ['Caulifla and Kale are waiting on Sadala, in the old quarter. Fly there from the space map!', 'Master Vegeta says I\'m still too soft. He\'s right. I\'ll train harder!'];
    await s.say('cabba', lines[s.inc('c13_cabbaTalks') % lines.length], 'neutral');
  },

  c13_sadala_caulifla: async (s) => {
    const goku = s.hero === 'goku';
    if (s.check('done:c13_sadala')) {
      await s.say('caulifla', 'Next time I\'m going Super Saiyan 3. Goku showed me in the tournament. Don\'t tell him I\'ve been practising.', 'smirk');
      return;
    }
    if (!s.check('quest:c13_sadala')) {
      await s.say('caulifla', 'This is my turf. You want something, talk to Cabba first.', 'smirk');
      return;
    }
    s.letterbox(true);
    await s.talk(goku ? [
      ['caulifla', 'GOKU! Finally. You still owe me a real fight. No clock, no ring, no Jiren butting in.', 'happy'],
      ['goku', 'Heh. I was hoping you\'d ask!', 'happy'],
    ] : [
      ['caulifla', 'Universe 7! ...You\'re not Goku. Eh, you\'ll do. Show me what your universe has got.', 'smirk'],
      ['hero', 'You asked for a rematch. Here I am!', 'smirk'],
    ]);
    await s.talk([
      ['kale', 'I-I\'m fighting too. I can control it now, sis. Mostly.', 'neutral'],
      ['caulifla', 'Two on one. Don\'t cry about it later!', 'smirk'],
    ]);
    const [cx, cy] = s.exists('c13_caulifla') ? tileOf(s, 'c13_caulifla') : SADALA.quarter.throne;
    const [kx, ky] = s.exists('c13_kale') ? tileOf(s, 'c13_kale') : SADALA.quarter.kale;
    if (s.exists('c13_kale')) s.show('c13_kale', false);
    if (s.exists('c13_caulifla')) s.show('c13_caulifla', false);
    s.letterbox(false);
    s.music('boss');
    s.spawnEnemy('c13_kaleRematch', kx, ky, 'c13_kaleR');
    const r = await bossFight(s, 'c13_cauliflaRematch', { x: cx, y: cy, uid: 'c13_caulR', loseOk: true });
    removeAll(s, 'c13_caulR', 'c13_kaleR');
    if (s.exists('c13_kale')) s.show('c13_kale', true);
    if (s.exists('c13_caulifla')) s.show('c13_caulifla', true);
    s.letterbox(true);
    s.music('alien');
    if (r === 'lose') {
      await s.talk([
        ['caulifla', 'HA! Universe 6 wins! Come back when you\'re a real challenge.', 'happy'],
        ['kale', 'Sis... they can come back any time, right?', 'neutral'],
        ['caulifla', '...Yeah. Any time. I\'ll be stronger by then.', 'smirk'],
      ]);
      refresh(s, s.hero);
      s.letterbox(false);
      return;
    }
    await s.talk([
      ['caulifla', 'Hah... hah... Okay. OKAY. You\'re strong. Happy?', 'hurt'],
      ['kale', 'We had fun, didn\'t we, sis? I didn\'t lose control once!', 'happy'],
      ['caulifla', 'Yeah. You did great, Kale. Here, Universe 7: the gang\'s "protection fee" box. Take it before I change my mind.', 'smirk'],
    ]);
    s.letterbox(false);
    await s.done('c13_sadala', false);
    await s.give('str3');
    await s.give('pow3');
  },
  c13_rematch_p2: async (s) => {
    await s.say('c13_cauliflaSSJ', 'Kale, together! Show them what Universe 6 can do!', 'shout');
  },

  c13_sadala_kale: async (s) => {
    const lines = s.check('done:c13_sadala')
      ? ['Sis says I\'m the strongest Saiyan in Universe 6. After her. She says that part really loudly.', 'Cabba visits sometimes. I\'m not jealous anymore. ...Much.']
      : ['S-sis is training every day since the tournament... I have too. I can control it now. Mostly.', 'Please don\'t make me angry. I don\'t want to break the street again.'];
    await s.say('kale', lines[s.inc('c13_kaleTalks') % lines.length], 'neutral');
  },

  c13_sadala_renso: async (s) => {
    const lines = [
      'Cabba told me about your universe. Saiyans who protect people, like us! My sister just wants to punch them.',
      'My leg is nearly healed, thank you. My sister\'s manners never will be.',
      'Caulifla brought the gang home from the tournament and made them clean the street. I almost cried.',
    ];
    await s.say('c13_renso', lines[s.inc('c13_rensoTalks') % lines.length], 'happy');
  },

  c13_sadala_gang: async (s) => {
    const lines = [
      'We used to rob people. Now we "protect the neighbourhood". Same punches, better hours.',
      'The boss says when she\'s done with Universe 7, she\'s taking over the planet. Starting with the snack stalls.',
      'Kale is sweet. Do NOT make her cry. See that crater out in the crags? That was a Tuesday.',
      'Visitor from Universe 7? Nice. The boss gets cranky when nobody strong comes around.',
    ];
    const who = s.npc?.def.id ?? 'c13_gangPunk';
    await s.say(who, lines[s.inc('c13_gangTalks') % lines.length], 'smirk');
  },

  c13_sadala_folk: async (s) => {
    const lines = [
      'King Sadala is proud, loud and very fond of speeches. A bit like a certain prince from your universe, I hear.',
      'They say our whole universe was gone for a while. I don\'t remember a thing. I lost an entire afternoon!',
      'Pterodactyls nest on the red spires in the crags. Delicious, if you can catch one.',
      'Caulifla\'s gang keeps this quarter safer than the Defense Force ever did. Don\'t tell them I said so.',
      'You\'re from Universe 7? Your Saiyans have TAILS? ...Weird.',
    ];
    const who = s.npc?.def.id ?? 'c13_sadalan';
    await s.say(who, lines[s.inc('c13_folkTalks') % lines.length], 'neutral');
  },

  c13_sadala_guard: async (s) => {
    await s.say('c13_sadalaGuard', s.check('done:c13_sadala')
      ? 'You fought Caulifla and the street\'s still standing? The Defense Force should hire you.'
      : 'Sadala Defense Force. Cabba is our ace... or he was, until Caulifla turned up. Her yard is at the east end of the street.', 'neutral');
  },
});
