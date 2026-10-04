import { registerScripts } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import './c14_enemies';
import { clearStage, eliminated, erased, FIGHT_MARGIN, onStage, QUIET, ringOut, stageOn, wave } from './c14_kit';
import './c14_setpieces';
import { battle, bossFight, handOff, heroTile, readyGuest, refresh, removeAll, stage, sweepRivals, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Chapter 14 — "The Tournament of Power" (L45→48 + god-mode finale). LoG2's Cell Games gauntlet:
 * a relay of forced characters across the three ring-out stage sections (A west → B centre → C east),
 * with save points between sections. Guests Android 17 and Frieza are playable via `switchTo`.
 * The relays run the anime's set pieces in episode order; the ones with their own mechanics (squad formation,
 * transformations, fighting partners, a twin boss, an invisible fighter) live in `c14_setpieces.ts`.
 */

registerScripts({
  // ================================================================ chapter start: the Mighty Ten assemble
  /**
   * Title card and the gathering at Capsule Corp, a few hours before the tournament (Frieza's twenty-four hours
   * cover the tournament day). Like LoG2's week before the Cell Games, control returns here so the player can
   * save and prepare; telling Beerus "let's go" departs for the World of Void.
   */
  c14_start: async (s) => {
    ensureChapterState(s, 14);
    unforce(s);
    await s.chapter(14, 'The Tournament of Power', 'The World of Void');
    readyGuest(s, 'android17', 46);
    readyGuest(s, 'frieza', 47);
    s.switchTo('goku');
    s.set('world', 'earth');
    await warpTo(s, HUB.cc.map, HUB.cc.arrive[0], HUB.cc.arrive[1], 'up');
    s.letterbox(true);
    s.music('heroic');
    const [hx, hy] = heroTile(s);
    // A loose circle around Goku, kept above the dialogue box.
    const team: Array<[string, string, number, number, string, 'left' | 'right' | 'up']> = [
      ['c14_gGohan', 'gohanUltimate', hx - 1, hy + 1, 'Gohan', 'up'], ['c14_gPiccolo', 'piccolo', hx - 2, hy, 'Piccolo', 'right'],
      ['c14_gKrillin', 'krillinGi', hx - 3, hy + 1, 'Krillin', 'right'], ['c14_g18', 'android18', hx - 3, hy - 1, 'Android 18', 'right'],
      ['c14_gTien', 'tien', hx - 4, hy, 'Tien', 'right'], ['c14_gRoshi', 'roshi', hx + 1, hy + 1, 'Master Roshi', 'up'],
      ['c14_gVegeta', 'vegeta', hx + 2, hy, 'Vegeta', 'left'], ['c14_g17', 'android17Top', hx + 3, hy + 1, 'Android 17', 'left'],
    ];
    for (const [id, sp, x, y, name, dir] of team) stage(s, id, sp, x, y, dir, name);
    await s.narrate('Capsule Corp, a few hours later. The Mighty Ten of Universe 7 gather on the lawn.');
    await s.talk([
      ['krillin', 'So, uh... is Frieza actually coming? Because I wouldn\'t mind if he got lost on the way.', 'shock'],
    ]);
    s.flash('#f070f0', 10);
    s.sfx('teleport');
    stage(s, 'c14_gFrieza', 'frieza', hx + 4, hy - 1, 'left', 'Frieza');
    s.face('hero', 'c14_gFrieza');
    await s.talk([
      ['frieza', 'Ohoho. Did you miss me? Don\'t worry, little Krillin. I only kill people on Tuesdays these days.', 'smirk'],
      ['android17', 'Frieza. On our team. This should be interesting.', 'neutral'],
      ['vegeta', 'One false move, Frieza, and I knock you out of the ring myself.', 'angry'],
      ['goku', 'Okay, everybody! Gohan\'s our team leader. He\'s way better at plans than me!', 'happy'],
      ['gohan', 'Me? ...Alright, Dad. Then everyone, listen. We fight as a team. If someone is in trouble, cover them. Nobody gets left alone out there.', 'neutral'],
      ['goku', 'Heh. That\'s our leader! And remember... have fun!', 'happy'],
      ['beerus', '...FUN?! Our universe is on the line! When you are all quite ready, tell me, and Whis will take us. Don\'t keep Zeno waiting.', 'angry'],
    ]);
    removeAll(s, ...team.map((t) => t[0]), 'c14_gFrieza');
    await s.quest('c14_ready');
    await s.narrate('Save your game and finish your preparations. Talk to Beerus at the garden table when you are ready to leave for the World of Void.');
    s.music('westCity');
    s.letterbox(false);
  },

  /** Beerus at Capsule Corp in Chapter 14, before departure: leave for the World of Void? */
  c14_depart: async (s) => {
    const c = await s.ask('beerus', 'Well? Is Universe 7 ready to fight for its life?', ['We\'re ready. Let\'s go!', 'Not yet'], 'angry');
    if (c !== 0) {
      await s.say('beerus', 'Then hurry up. Frieza\'s twenty-four hours won\'t wait, and Whis is already on his third slice of cake.', 'smirk');
      return;
    }
    await s.say('whis', 'Everyone, take hold of my staff, please. Next stop: the World of Void!', 'happy');
    s.flash('#80c0f8', 16);
    await s.done('c14_ready');
    await s.quest('c14_top', true);
    await s.call('c14_arrival');
  },

  /** The opening of the Tournament of Power, then stage A runs inline (later entries restart it: `c14_topA_enter`). */
  c14_arrival: async (s) => {
    s.set('c14_departed');
    s.set(QUIET);
    readyGuest(s, 'android17', 46);
    readyGuest(s, 'frieza', 47);
    unforce(s);
    s.switchTo('goku');
    await s.warp('top_arena_a', 22, 19, 'up');
    s.letterbox(true);
    s.music('topArena');
    const team: Array<[string, string, number, number]> = [
      ['c14_tGohan', 'gohanUltimate', 18, 19], ['c14_tVegeta', 'vegeta', 20, 19], ['c14_tPiccolo', 'piccolo', 24, 19],
      ['c14_t17', 'android17Top', 26, 19], ['c14_tFrieza', 'frieza', 28, 19], ['c14_tKrillin', 'krillinGi', 17, 20],
      ['c14_t18', 'android18', 19, 20], ['c14_tTien', 'tien', 25, 20], ['c14_tRoshi', 'roshi', 27, 20],
    ];
    for (const [id, sp, x, y] of team) stageOn(s, id, sp, x, y, 'up');
    const rivals: Array<[string, string, number, number]> = [
      ['c14_rJiren', 'jiren', 22, 12], ['c14_rToppo', 'toppo', 20, 12], ['c14_rDyspo', 'dyspo', 24, 12],
      ['c14_rCaulifla', 'caulifla', 16, 13], ['c14_rKale', 'kale', 17, 13], ['c14_rBergamo', 'bergamo', 28, 13],
      ['c14_rRibrianne', 'ribrianne', 13, 14], ['c14_rFrost', 'frost', 31, 14],
    ];
    for (const [id, sp, x, y] of rivals) stageOn(s, id, sp, x, y, 'down');
    await s.pan(22, 13, 40);
    await s.talk([
      ['grandPriest', 'Fighters of eight universes, welcome to the World of Void! The Tournament of Power begins now.', 'happy'],
      ['grandPriest', 'Forty-eight minutes. Knock your opponents off the stage. The last universe standing wins. The others...', 'neutral'],
      ['zeno', 'Erase! Hehe!', 'happy'],
      ['vegeta', 'Kakarot. Don\'t you dare lose before I settle things with you.', 'smirk'],
      ['frieza', 'Do try to keep up, monkeys.', 'smirk'],
      ['goku', 'I\'ve been waiting for this! Let\'s go, everyone!', 'shout'],
      ['grandPriest', 'Begin!', 'shout'],
    ]);
    s.follow();
    s.flash('#ffffff', 10);
    removeAll(s, ...team.map((t) => t[0]), ...rivals.map((r) => r[0]));
    s.set('c14_opened');
    await s.call('c14_stageA');
  },

  /**
   * West ring onEnter: if the west ring was left before stage A was won (Whis's Charm mid-fight, a reload, the
   * Grand Priest's "return to the stage"), the stage A relay starts over. The first arrival runs it from `c14_arrival`.
   */
  c14_topA_enter: async (s) => {
    if (!s.check('chapter==14') || !s.flag('c14_opened') || s.flag('c14_stageA')) return;
    s.set(QUIET);
    s.letterbox(true);
    // Let the arrival fade-in finish first (the relay's own hand-off fades would race it).
    await s.wait(14);
    await s.narrate('The west ring. The battle royale rages on, and Universe 7 is right back in the thick of it!');
    await s.call('c14_stageA');
  },

  // ================================================================ Stage A (west ring)
  c14_stageA: async (s) => {
    if (s.flag('c14_stageA')) return;
    s.set(QUIET);
    s.letterbox(true);
    await clearStage(s);
    // --- 1. Opening melee: Gohan, the team leader, takes the lead while Goku runs off to find the strongest.
    await handOff(s, 'gohan', s.hero === 'goku' ? { out: { id: 'c14_gokuA0', name: 'Goku' }, dx: -1 } : {});
    if (s.exists('c14_gokuA0')) {
      await s.talk([
        ['goku', 'Gohan, you lead the team! I\'m gonna go find the strongest guy here!', 'happy'],
        ['gohan', 'Dad, wait! Stick to the plan!', 'shock'],
      ]);
      const [ox, oy] = heroTile(s);
      await s.flyTo('c14_gokuA0', ox + 10, oy - 12, 4);
      removeAll(s, 'c14_gokuA0');
    }
    await s.talk([
      ['gohan', 'Universe 7, stick to the plan! Back to back, cover each other!', 'shout'],
      ['vegeta', 'Plan? I fight who I please.', 'smirk'],
    ]);
    await s.narrate('Fighters from eight universes crash together! Knock them into the void to eliminate them - a hard blow near the edge sends them flying.');
    s.letterbox(false);
    s.music('battle');
    wave(s, [['c14_u9Wolf', 17, 13], ['c14_u9Wolf', 27, 13], ['c14_u10Fighter', 17, 20], ['c14_u10Fighter', 27, 20]]);
    await battle(s);
    wave(s, [['c14_u4Fighter', 22, 11], ['c14_u2Fighter', 15, 16], ['c14_pride', 29, 16], ['c14_u3Robot', 22, 22]]);
    await battle(s);
    s.letterbox(true);

    // --- 2. The Trio de Dangers (eps 97-98): Gohan hands over to Vegeta.
    await handOff(s, 'vegeta', { out: { id: 'c14_gohanA', name: 'Gohan' } });
    await s.talk([
      ['gohan', 'Vegeta! Universe 9 is regrouping - all three of them are coming this way!', 'shock'],
      ['vegeta', 'Then get out of my way, Gohan. I\'ll deal with them myself.', 'smirk'],
      ['gohan', 'Right! I\'ll go and cover Piccolo!', 'neutral'],
    ]);
    if (s.exists('c14_gohanA')) {
      const [ax0, ay0] = heroTile(s);
      await s.walk('c14_gohanA', ax0 - 8, ay0 + 2, 3);
      removeAll(s, 'c14_gohanA');
    }
    stageOn(s, 'c14_bergamoA', 'bergamo', 22, 11, 'down', 'Bergamo', FIGHT_MARGIN);
    stageOn(s, 'c14_basilA', 'basil', 18, 12, 'down', 'Basil', FIGHT_MARGIN);
    stageOn(s, 'c14_lavenderA', 'lavender', 26, 12, 'down', 'Lavender', FIGHT_MARGIN);
    await s.talk([
      ['bergamo', 'Universe 9, all together! Take down the Saiyans who caused this tournament!', 'shout'],
      ['vegeta', 'Kakarot\'s mess, as always. Fine. I\'ll clean it up myself.', 'smirk'],
    ]);
    s.letterbox(false);
    removeAll(s, 'c14_bergamoA', 'c14_basilA', 'c14_lavenderA');
    const [b1x, b1y] = onStage(s, 18, 12, FIGHT_MARGIN);
    const [b2x, b2y] = onStage(s, 26, 12, FIGHT_MARGIN);
    s.spawnEnemy('c14_basil', b1x, b1y, 'c14_basil1');
    s.spawnEnemy('c14_lavender', b2x, b2y, 'c14_lavender1');
    const [bx, by] = onStage(s, 22, 11, FIGHT_MARGIN);
    s.music('boss');
    await bossFight(s, 'c14_bergamo', { x: bx, y: by, uid: 'c14_bergamo1' });
    removeAll(s, 'c14_basil1', 'c14_lavender1');
    // Any Universe 9 brawlers Bergamo called in are caught in the blast that follows.
    sweepRivals(s);
    s.letterbox(true);
    const [vx, vy] = heroTile(s);
    stageOn(s, 'c14_gokuA', 'gokuSSB', vx - 1, vy + 1, 'up', 'Goku');
    // A ring-out ends the fight with the boss hidden at the edge: bring him back for the finishing blow.
    if (s.exists('c14_bergamo1')) { s.show('c14_bergamo1', true); s.place('c14_bergamo1', bx, by, 'down'); } else stageOn(s, 'c14_bergamo1', 'bergamo', bx, by, 'down', 'Bergamo');
    stageOn(s, 'c14_basilA2', 'basil', bx - 2, by, 'down', 'Basil');
    stageOn(s, 'c14_lavenderA2', 'lavender', bx + 2, by, 'down', 'Lavender');
    await s.talk([
      ['goku', 'Vegeta! Together!', 'shout'],
      ['vegeta', 'Tch. Just this once, Kakarot!', 'angry'],
    ]);
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 30);
    await s.blast('c14_gokuA', 'c14_bergamo1', '#70c8f8');
    await s.blast('hero', 'c14_bergamo1', '#c070f8');
    s.boom(bx, by, 30, '#a0e8ff');
    await Promise.all([ringOut(s, 'c14_bergamo1', bx, 1), ringOut(s, 'c14_basilA2', bx - 3, 1), ringOut(s, 'c14_lavenderA2', bx + 3, 1)]);
    s.transformNow(null);
    await eliminated(s, 'The Trio de Dangers fly off the stage! Universe 9 has no fighters left.');
    await erased(s, 'Zeno raises his hand... and Universe 9 vanishes. Its fighters, its gods, its stars. Gone.');
    await s.say('goku', '...', 'sad');

    // --- 3. Krillin is Universe 7's first elimination (ep 99), right in front of the two Saiyans.
    const [kx0, ky0] = heroTile(s);
    stageOn(s, 'c14_krillinA', 'krillinGi', kx0 - 3, ky0 - 2, 'left', 'Krillin');
    stageOn(s, 'c14_frostA', 'frost', kx0 - 6, ky0 - 2, 'right', 'Frost');
    await s.talk([
      ['krillin', 'Ha! I\'ve taken out two already! I\'m on fire tod-', 'happy'],
      ['frost', 'How nice for you.', 'smirk'],
    ]);
    await s.blast('c14_frostA', 'c14_krillinA', '#a0d0f0');
    await ringOut(s, 'c14_krillinA', 1, 6);
    await eliminated(s, 'Krillin has been eliminated! Universe 7: nine fighters remain.');
    await s.say('krillin', '(from the stands) Why is it ALWAYS me?!', 'sad');
    if (s.exists('c14_frostA')) await s.walk('c14_frostA', kx0 - 12, ky0 - 4, 3);
    removeAll(s, 'c14_frostA');

    // --- 4. Goku vs Caulifla, then Kale goes berserk (ep 100): Vegeta hands over to Goku. Goku shows Caulifla Super
    //        Saiyan 2 (Chapter 13 leaves her at Super Saiyan for this lesson), she copies it on the spot, and Kale's
    //        jealousy erupts. Goku has to survive her.
    await handOff(s, 'goku', { out: { id: 'c14_vegetaA', name: 'Vegeta' }, at: 'c14_gokuA' });
    await s.talk([
      ['vegeta', 'Don\'t lose focus, Kakarot. That\'s what happens to the losers.', 'angry'],
      ['vegeta', 'I\'m going after Universe 11. Don\'t follow me.', 'smirk'],
    ]);
    if (s.exists('c14_vegetaA')) {
      const [ex, ey] = heroTile(s);
      await s.walk('c14_vegetaA', ex + 9, ey - 1, 3);
      removeAll(s, 'c14_vegetaA');
    }
    const [gx, gy] = heroTile(s);
    stageOn(s, 'c14_cauliflaA', 'caulifla', gx - 3, gy - 3, 'down', 'Caulifla');
    stageOn(s, 'c14_kaleA', 'kale', gx + 1, gy - 3, 'down', 'Kale', FIGHT_MARGIN);
    await s.say('caulifla', 'So you\'re the Saiyan from Universe 7! Cabba said you could teach me stuff. Teach me by losing!', 'smirk');
    s.sprite('c14_cauliflaA', 'c13_cauliflaSSJ');
    s.flash('#f8e048', 8);
    s.transformNow('ssj');
    await s.clash('hero', 'c14_cauliflaA', 40);
    await s.say('goku', 'Heh, you\'re good! But Super Saiyan isn\'t the end of the road. Watch closely!', 'happy');
    await s.powerUp('hero', '#f8f080', 40);
    await s.narrate('Sparks crackle through Goku\'s golden aura. Super Saiyan 2!');
    await s.say('caulifla', 'Sparks... and that tingle in my back, only way stronger. Like THIS?!', 'shout');
    await s.powerUp('c14_cauliflaA', '#f8f080', 40);
    await s.talk([
      ['goku', 'You got it on your first try?! Now THAT\'s talent!', 'shock'],
      ['caulifla', 'Super Saiyan 2, huh? Hah! Now we can really go at it!', 'smirk'],
      ['kale', 'Sis... he\'s all you look at now... I won\'t let anyone take you away from me!', 'shout'],
    ]);
    await s.powerUp('c14_kaleA', '#90f070', 50);
    s.sprite('c14_kaleA', 'kaleLSSJ');
    await s.talk([
      ['caulifla', 'K-Kale?! Calm down! It\'s me!', 'shock'],
      ['goku', 'Whoa... that power\'s out of control. I can\'t hurt her like this. I\'ll just have to hold out!', 'shock'],
    ]);
    s.transformNow(null);
    s.letterbox(false);
    s.music('tense');
    const [kx, ky] = onStage(s, gx + 1, gy - 3, FIGHT_MARGIN);
    removeAll(s, 'c14_kaleA');
    await bossFight(s, 'c14_kaleBerserk', { x: kx, y: ky, uid: 'c14_kale1', survive: 40, label: 'SURVIVE' });
    s.letterbox(true);
    if (!s.exists('c14_kale1')) stageOn(s, 'c14_kale1', 'kaleLSSJ', kx, ky, 'down', 'Kale');
    stageOn(s, 'c14_jirenA', 'jiren', gx + 6, gy - 5, 'left', 'Jiren');
    await s.pan(gx + 6, gy - 5, 20);
    await s.say('jiren', '...', 'neutral');
    await s.blast('c14_jirenA', 'c14_kale1', '#f05050');
    s.boom(kx, ky, 20, '#f05050');
    s.sprite('c14_kale1', 'kale');
    s.pose('c14_kale1', 'ko');
    s.follow();
    await s.talk([
      ['goku', 'He stopped her... with one shot. That\'s Jiren.', 'shock'],
      ['caulifla', 'Kale! ...We\'ll be back for you, Universe 7. Count on it!', 'angry'],
    ]);
    removeAll(s, 'c14_kale1', 'c14_cauliflaA');
    if (s.exists('c14_jirenA')) await s.walk('c14_jirenA', gx + 12, gy - 6, 2);
    removeAll(s, 'c14_jirenA');
    await s.say('goku', 'Jiren... I have to fight him. But not yet. Not like this.', 'neutral');

    // --- 5. The Pride Troopers corner the Saiyans (ep 101), then Universe 2's Kamikaze Fireballs meet 17 (ep 102).
    await s.call('c14_pride');
    await s.call('c14_fireballs');

    // --- 6. Universe 10 falls in the dark (ep 103); Goku and Hit team up against Dyspo and K'nsi (ep 104).
    await s.fadeOut(20);
    await erased(s, 'Twenty minutes in. Gohan outlasts Universe 10\'s last fighter, Obuni... and Zeno erases Universe 10.');
    await s.call('c14_dyspoTag');

    // --- 7. More time passes in the dark (eps 105-107), then Frieza vs Frost (ep 108; Frieza is a guest).
    readyGuest(s, 'frieza', 47);
    await s.fadeOut(20);
    await s.narrate('Tien takes Universe 2\'s sniper out of the ring with him; Master Roshi frees Vegeta from Frost\'s trap, then retires on his own two feet.');
    force(s, 'frieza');
    refresh(s, 'frieza');
    await s.fadeIn(20);
    const [fhx, fhy] = heroTile(s);
    stageOn(s, 'c14_frostB', 'frost', fhx + 4, fhy - 2, 'left', 'Frost', FIGHT_MARGIN);
    await s.talk([
      ['frost', 'Frieza. You and I are the same. Help me knock out Universe 7 and we\'ll split the universe between us.', 'smirk'],
      ['frieza', 'Why, what a generous offer. I accept.', 'happy'],
      ['frost', 'Excellent. Then-', 'happy'],
      ['frieza', '...said no one with any taste. You\'re a cheap copy, Frost.', 'smirk'],
    ]);
    s.letterbox(false);
    s.music('frieza');
    const [fx, fy] = onStage(s, fhx + 4, fhy - 2, FIGHT_MARGIN);
    removeAll(s, 'c14_frostB');
    await bossFight(s, 'c14_frost', { x: fx, y: fy, uid: 'c14_frost1' });
    removeAll(s, 'c14_frost1');
    s.letterbox(true);
    await eliminated(s, 'Frost has been eliminated by Frieza!');
    await s.say('frieza', 'Hohoho. Whose side am I on? Mine, as always. It simply happens to be yours today.', 'smirk');

    // --- 8. Goku vs Jiren (eps 109-110): Frieza hands back to Goku. The Spirit Bomb and the first sign of Ultra Instinct.
    await handOff(s, 'goku', { out: { id: 'c14_friezaA', name: 'Frieza' } });
    await s.talk([
      ['frieza', 'Your turn, Goku. Jiren hasn\'t moved a muscle all this time. Go and find out what he is hiding.', 'smirk'],
    ]);
    if (s.exists('c14_friezaA')) {
      const [ex, ey] = heroTile(s);
      await s.walk('c14_friezaA', ex - 9, ey + 1, 3);
      removeAll(s, 'c14_friezaA');
    }
    s.music('jiren');
    const [jgx, jgy] = heroTile(s);
    stageOn(s, 'c14_jirenA', 'jiren', jgx + 4, jgy - 3, 'left', 'Jiren', FIGHT_MARGIN);
    s.face('hero', 'c14_jirenA');
    await s.talk([
      ['goku', 'Jiren! Fight me!', 'shout'],
      ['jiren', 'Your strength is not enough. But come, if you must.', 'neutral'],
    ]);
    s.letterbox(false);
    const [jx, jy] = onStage(s, jgx + 4, jgy - 3, FIGHT_MARGIN);
    removeAll(s, 'c14_jirenA');
    await bossFight(s, 'c14_jiren1', { x: jx, y: jy, uid: 'c14_jiren1', loseOk: true });
    s.letterbox(true);
    if (!s.exists('c14_jiren1')) stageOn(s, 'c14_jiren1', 'jiren', jx, jy, 'left', 'Jiren');
    await s.talk([
      ['jiren', 'Is that all?', 'neutral'],
      ['goku', 'Not even Blue Kaio-ken reaches him... Then I\'ll borrow everyone\'s energy!', 'hurt'],
      ['goku', 'Everyone in Universe 7... lend me your strength!', 'shout'],
    ]);
    await s.learn('goku', 'spiritBomb');
    s.pose('hero', 'raise');
    await s.beamStruggle('goku', 'jiren', '#a8e0ff', '#f05050', [
      'Universe 7\'s energy gathers into a giant Spirit Bomb!',
      'Jiren catches it with one hand!',
      'Push, {hero}! Don\'t let it fall back!',
    ], 0.22);
    s.pose('hero', null);
    await s.narrate('The Spirit Bomb hangs between them... then Jiren hurls it straight back. It swallows Goku whole.');
    s.flash('#ffffff', 30);
    s.show('hero', false);
    await s.wait(40);
    await s.narrate('Silence. Then, from the heart of the light, something new.');
    s.flash('#d0d8ff', 20);
    s.show('hero', true);
    s.transformNow('ui');
    await s.say('jiren', '...What is this?', 'shock');
    await s.narrate('Ultra Instinct -Sign-. For a few moments, Goku\'s body moves on its own, faster than thought.');
    await s.clash('hero', 'c14_jiren1', 80);
    s.transformNow(null);
    s.pose('hero', 'ko');
    await s.talk([
      ['jiren', 'Your power is gone. The form has abandoned you.', 'neutral'],
      ['goku', 'Heh... heh... I... almost had something there...', 'hurt'],
    ]);
    // --- 9. Hit steps in between them (ep 111): his Time Prison holds Jiren for a moment, then Hit is thrown out.
    await s.call('c14_hitJiren');
    s.pose('hero', null);
    s.set('c14_stageA');
    s.clear(QUIET);
    // Goku gets back up after the scripted loss (a 1 HP hero is never handed back to a hostile stage).
    refresh(s, 'goku');
    unforce(s);
    s.music('topArena');
    await s.narrate('The west ring is crumbling. Save if you like - fighters from every universe still prowl the stage - then head east to the central ring.');
    s.letterbox(false);
  },

  // ================================================================ Stage B (central ring)
  c14_stageB: async (s) => {
    if (s.flag('c14_stageB')) return;
    s.clear('c14_reactorDown');
    s.letterbox(true);
    await clearStage(s);
    // --- 1. Caulifla and Kale fuse: Kefla (eps 112-116). Goku takes the central ring; Ultra Instinct -Sign- returns.
    await handOff(s, 'goku');
    s.music('tense');
    const [gx, gy] = heroTile(s);
    stageOn(s, 'c14_cauliflaB', 'caulifla', gx - 2, gy - 4, 'down', 'Caulifla');
    stageOn(s, 'c14_kaleB', 'kale', gx + 2, gy - 4, 'down', 'Kale');
    await s.talk([
      ['caulifla', 'Told you we\'d be back, Universe 7! Kale\'s got that power under control now.', 'smirk'],
      ['caulifla', 'Earrings from our Supreme Kai. Put one on, Kale. Let\'s see how he handles two of us... as ONE.', 'smirk'],
      ['goku', 'Potara?! Uh oh.', 'shock'],
    ]);
    await s.walkAll([['c14_cauliflaB', gx, gy - 4, 2], ['c14_kaleB', gx, gy - 4, 2]]);
    s.flash('#ffffff', 20);
    s.shake(20, 3);
    removeAll(s, 'c14_cauliflaB', 'c14_kaleB');
    stageOn(s, 'c14_keflaB', 'kefla', gx, gy - 4, 'down', 'Kefla', FIGHT_MARGIN);
    await s.talk([
      ['kefla', 'I\'m Kefla. And you\'re finished, Goku!', 'smirk'],
    ]);
    s.letterbox(false);
    s.music('boss');
    const [kx, ky] = onStage(s, gx, gy - 4, FIGHT_MARGIN);
    removeAll(s, 'c14_keflaB');
    await bossFight(s, 'c14_kefla', { x: kx, y: ky, uid: 'c14_kefla1' });
    s.letterbox(true);
    await s.talk([
      ['kefla', 'Blue, God, whatever. None of it works on me!', 'smirk'],
      ['goku', 'She\'s too strong... no, wait. Don\'t think. Just... move.', 'hurt'],
    ]);
    s.flash('#d0d8ff', 24);
    s.transformNow('ui');
    await s.narrate('Ultra Instinct -Sign- returns! Goku\'s body dodges on its own - and his strength has no ceiling.');
    s.music('heroic');
    removeAll(s, 'c14_kefla1');
    s.letterbox(false);
    await bossFight(s, 'c14_keflaUI', { x: kx, y: ky, uid: 'c14_kefla2' });
    removeAll(s, 'c14_kefla2');
    s.letterbox(true);
    s.transformNow(null);
    await eliminated(s, 'Kefla is knocked out of the ring - and splits back into Caulifla and Kale as she falls!');

    // --- 2. The androids against Ribrianne and Rozie (eps 117-118).
    await s.call('c14_ribrianne');
    // --- 3. Gohan and Piccolo against Universe 6's Namekians (ep 118); Universe 6 and Universe 2 are erased.
    await s.call('c14_namek');
    // --- 4. Piccolo hunts the invisible Gamisalas; Damom takes Piccolo out; Universe 4 is erased (ep 119).
    await s.call('c14_gamisalas');

    // --- 5. Universe 3's fusion robot (eps 120-121): Android 17 (guest) takes over.
    readyGuest(s, 'android17', 46);
    await s.fadeOut(20);
    s.show('hero', true);
    force(s, 'android17');
    refresh(s, 'android17');
    await s.fadeIn(20);
    s.music('tense');
    const [ax, ay] = heroTile(s);
    stageOn(s, 'c14_18B', 'android18', ax - 1, ay + 1, 'up', 'Android 18');
    for (let i = 0; i < 4; i++) stageOn(s, `c14_u3r${i}`, 'c14_u3Robot', ax - 4 + i * 3, ay - 5, 'down');
    await s.talk([
      ['android18', 'Universe 3\'s robots are linking up. All four of them.', 'neutral'],
      ['android17', 'Of course they are.', 'smirk'],
    ]);
    await s.walkAll([['c14_u3r0', ax, ay - 5, 2], ['c14_u3r1', ax, ay - 5, 2], ['c14_u3r2', ax, ay - 5, 2], ['c14_u3r3', ax, ay - 5, 2]]);
    s.flash('#f05050', 20);
    s.shake(30, 3);
    removeAll(s, 'c14_u3r0', 'c14_u3r1', 'c14_u3r2', 'c14_u3r3');
    await s.talk([
      ['android18', 'Its armor is too thick. Something on this stage is feeding it energy.', 'shock'],
      ['android17', 'Then we find it and break it. Like any poacher\'s generator.', 'smirk'],
    ]);
    s.letterbox(false);
    s.music('boss');
    const [rx, ry] = onStage(s, 38, 22);
    const reactor = s.spawnEnemy('c14_reactor', rx, ry, 'c14_reactor1');
    reactor.onDefeat = 'c14_reactor_down';
    const [nx, ny] = onStage(s, ax, ay - 5, FIGHT_MARGIN);
    await bossFight(s, 'c14_anilaza', { x: nx, y: ny, uid: 'c14_anilaza1' });
    removeAll(s, 'c14_reactor1');
    // Robots Anilaza called in go down with it.
    sweepRivals(s);
    s.letterbox(true);
    const [px, py] = heroTile(s);
    await s.narrate('Anilaza\'s giant fist slams Android 17 toward the edge of the stage!');
    s.place('hero', px, py);
    if (s.exists('c14_18B')) {
      await s.walk('c14_18B', px, py - 1, 4);
      await s.say('android18', 'Not today, little brother!', 'shout');
      await ringOut(s, 'c14_18B', px - 8, py + 8);
    }
    await eliminated(s, 'Android 18 kicks 17 back onto the stage - and falls in his place! Android 18 has been eliminated.');
    await s.say('android17', '...18. Fine. Then I end this.', 'angry');
    s.pose('hero', 'raise');
    s.flash('#60e0a0', 20);
    s.boom(nx, ny, 34, '#60e0a0');
    await ringOut(s, 'c14_anilaza1', nx, 1);
    s.pose('hero', null);
    await erased(s, 'Anilaza crashes out of the ring. Universe 3 is erased. Only Universe 7 and Universe 11 remain.');
    s.set('c14_stageB');
    await handOff(s, 'goku');
    unforce(s);
    s.music('topArena');
    await s.narrate('The central ring is breaking apart. Save if you like - Universe 11\'s troopers are still hunting - then head east for the final stand.');
    s.letterbox(false);
  },

  c14_reactor_down: async (s) => {
    s.set('c14_reactorDown');
    await s.narrate('The energy reactor shatters! Anilaza\'s shields flicker out - now it can be hurt!');
  },

  // ================================================================ Stage C (east ring): the finale
  c14_stageC: async (s) => {
    if (s.flag('c14_stageC')) return;
    s.letterbox(true);
    await clearStage(s);
    // --- 1. Vegeta vs Jiren (eps 122-123), told in the dark: Vegeta first reaches SSB Evolved. Spent, he hands the
    //        relay to Gohan for Dyspo (ep 124).
    await s.fadeOut(20);
    await s.narrate('The east ring. Goku throws himself at Jiren again and again... until Vegeta shoves him aside and takes Jiren on himself.');
    await s.narrate('A Final Flash at point-blank range. Then the prince breaks through his own limits: Super Saiyan Blue, Evolved!');
    await s.setForm('vegeta', 'ssbe');
    await s.learn('vegeta', 'finalFlash');
    await handOff(s, 'gohan', { out: { id: 'c14_vegetaC', name: 'Vegeta', pose: 'hurt', sprite: 'vegeta' }, dx: 2 });
    await s.say('vegeta', 'Hah... hah... Jiren took everything I had. Gohan... the fast one is yours. Don\'t you dare lose.', 'hurt');

    // --- 2. Gohan and Frieza vs Dyspo (ep 124): Frieza cages Dyspo and blasts him off the stage, Gohan with him.
    const [gx, gy] = heroTile(s);
    stageOn(s, 'c14_friezaC', 'goldenFrieza', gx - 2, gy - 1, 'right', 'Frieza');
    stageOn(s, 'c14_dyspoC', 'dyspo', gx + 4, gy - 2, 'left', 'Dyspo', FIGHT_MARGIN);
    await s.talk([
      ['dyspo', 'Universe 7\'s team leader. I\'ll be eliminating you at the speed of light!', 'smirk'],
      ['gohan', 'Frieza, he reads your movements before you make them. We have to think ahead of him!', 'shout'],
      ['frieza', 'Don\'t order me around, Gohan. ...But fine.', 'smirk'],
    ]);
    s.letterbox(false);
    const [dx, dy] = onStage(s, gx + 4, gy - 2, FIGHT_MARGIN);
    removeAll(s, 'c14_dyspoC');
    s.music('boss');
    await bossFight(s, 'c14_dyspo', { x: dx, y: dy, uid: 'c14_dyspo1' });
    s.letterbox(true);
    if (!s.exists('c14_dyspo1')) stageOn(s, 'c14_dyspo1', 'dyspo', dx, dy, 'left', 'Dyspo');
    await s.say('frieza', 'Caught you.', 'smirk');
    s.aura('c14_dyspo1', '#f070f0');
    s.flash('#f070f0', 10);
    await s.talk([
      ['dyspo', 'An energy cage?! I can\'t move!', 'shock'],
      ['gohan', 'Got him! Frieza, now!', 'shout'],
      ['frieza', 'Gladly.', 'smirk'],
    ]);
    const [ox, oy] = heroTile(s);
    s.show('hero', false);
    stageOn(s, 'c14_gohanOut', 'gohanUltimate', ox, oy, 'right', 'Gohan');
    await s.walk('c14_gohanOut', dx - 1, dy, 3);
    await s.blast('c14_friezaC', 'c14_dyspo1', '#f070f0');
    s.boom(dx, dy, 26, '#f070f0');
    await Promise.all([ringOut(s, 'c14_gohanOut', dx + 8, dy - 8), ringOut(s, 'c14_dyspo1', dx + 10, dy - 7)]);
    await eliminated(s, 'Frieza\'s blast throws Dyspo AND Gohan off the stage! Gohan has been eliminated.');
    await s.say('frieza', 'A necessary sacrifice. You may thank me later. Or never.', 'smirk');
    removeAll(s, 'c14_friezaC', 'c14_vegetaC');

    // --- 3. Toppo, God of Destruction vs Vegeta (eps 125-126): back on his feet, Vegeta returns to SSB Evolved.
    await handOff(s, 'vegeta');
    s.music('tense');
    const [hx, hy] = heroTile(s);
    stageOn(s, 'c14_toppoC', 'toppo', hx + 4, hy - 2, 'left', 'Toppo', FIGHT_MARGIN);
    await s.talk([
      ['toppo', 'Dyspo... I will not let his fall be for nothing.', 'angry'],
      ['toppo', 'To protect my universe, I cast aside justice itself. I am a God of Destruction now.', 'angry'],
    ]);
    await s.powerUp('c14_toppoC', '#b040f0', 60);
    await s.talk([
      ['vegeta', 'So you threw away your pride for power. Pathetic. I\'ll show you what pride is worth!', 'shout'],
      ['vegeta', 'I am Vegeta, prince of a fallen race... and a prince kneels to no god!', 'shout'],
    ]);
    await s.powerUp('hero', '#3058d8', 70);
    s.transformNow('ssbe');
    s.letterbox(false);
    s.music('boss');
    const [tx, ty] = onStage(s, hx + 4, hy - 2, FIGHT_MARGIN);
    removeAll(s, 'c14_toppoC');
    await bossFight(s, 'c14_toppoGoD', { x: tx, y: ty, uid: 'c14_toppo1' });
    s.letterbox(true);
    if (s.exists('c14_toppo1')) { s.show('c14_toppo1', true); s.place('c14_toppo1', tx, ty, 'left'); } else stageOn(s, 'c14_toppo1', 'toppo', tx, ty, 'left', 'Toppo');
    await s.talk([
      ['toppo', 'Hakai!', 'shout'],
      ['vegeta', 'Erase THIS. FINAL... FLASH!', 'shout'],
    ]);
    await s.beamStruggle('vegetaSSBE', 'toppo', '#f8f080', '#b040f0', [
      'Final Flash against the Energy of Destruction!',
      'Vegeta pours his whole life into the beam!',
    ], 0.24);
    await ringOut(s, 'c14_toppo1', 25, 13);
    s.transformNow(null);
    await eliminated(s, 'Toppo is blasted clean off the stage! Vegeta eliminated a God of Destruction candidate.');

    // --- 4. Goku vs Jiren (eps 127-129): Mastered Ultra Instinct (god-mode). Time passes in the dark.
    await s.fadeOut(20);
    await s.narrate('Jiren unleashes his full power. Android 17 vanishes in an explosion shielding Goku and Vegeta; then Vegeta gives Goku the last of his energy and is thrown out of the ring.');
    await handOff(s, 'goku');
    s.music('jiren');
    const [jx0, jy0] = heroTile(s);
    stageOn(s, 'c14_jirenC', 'jiren', jx0 + 4, jy0 - 2, 'left', 'Jiren', FIGHT_MARGIN);
    await s.talk([
      ['jiren', 'Power is everything. Trust gets you killed. That is what I learned when I lost my family. My master.', 'angry'],
      ['goku', 'Then I\'ll show you what trusting everyone can do!', 'shout'],
    ]);
    s.flash('#ffffff', 30);
    s.transformNow('ui');
    await s.narrate('Silver hair. Silver eyes. Body and mind, moving as one. Mastered Ultra Instinct!');
    s.letterbox(false);
    s.music('finale');
    const [jx, jy] = onStage(s, jx0 + 4, jy0 - 2, FIGHT_MARGIN);
    removeAll(s, 'c14_jirenC');
    await bossFight(s, 'c14_jiren2', { x: jx, y: jy, uid: 'c14_jiren2' });
    s.letterbox(true);
    if (!s.exists('c14_jiren2')) stageOn(s, 'c14_jiren2', 'jiren', jx, jy, 'left', 'Jiren');
    await s.say('jiren', 'I... will... NOT... LOSE!', 'shout');
    s.aura('c14_jiren2', '#f02020');
    await s.narrate('Jiren pushes past his limits. And Goku\'s body, pushed past its own, simply... breaks.');
    s.transformNow(null);
    s.pose('hero', 'ko');
    s.music('tense');

    // --- 5. The last stand (eps 130-131): Frieza stands over the fallen Goku, then Android 17 returns.
    readyGuest(s, 'frieza', 47);
    await handOff(s, 'frieza', { out: { id: 'c14_gokuKO', name: 'Goku', pose: 'ko' }, dx: 1, form: 'goldenFrieza' });
    if (s.exists('c14_jiren2')) s.face('hero', 'c14_jiren2');
    await s.talk([
      ['frieza', 'Get up, Goku. I refuse to be erased because YOU ran out of stamina.', 'angry'],
      ['goku', 'Ngh... my body... won\'t move...', 'hurt'],
      ['frieza', 'Then lie there and watch. Try to look grateful.', 'smirk'],
    ]);
    s.letterbox(false);
    removeAll(s, 'c14_jiren2');
    s.music('jiren');
    await bossFight(s, 'c14_jiren3', { x: jx, y: jy, uid: 'c14_jiren3', loseOk: true });
    s.letterbox(true);
    removeAll(s, 'c14_jiren3');
    stageOn(s, 'c14_jirenL', 'jiren', jx, jy, 'left', 'Jiren');
    s.transformNow(null);
    s.pose('hero', 'hurt');
    await s.say('frieza', 'Tch... where is that android when you need him...', 'hurt');
    readyGuest(s, 'android17', 46);
    await handOff(s, 'android17', { out: { id: 'c14_friezaHurt', name: 'Frieza', pose: 'hurt' }, dx: 1 });
    s.face('hero', 'c14_jirenL');
    s.flash('#60e0a0', 14);
    await s.talk([
      ['android17', 'Right here. Did you all think a little explosion would finish me?', 'smirk'],
      ['jiren', 'You survived.', 'shock'],
      ['android17', 'I have a cruise ship to win.', 'smirk'],
    ]);
    s.letterbox(false);
    removeAll(s, 'c14_jirenL');
    s.music('finale');
    await bossFight(s, 'c14_jiren4', { x: jx, y: jy, uid: 'c14_jiren4', loseOk: true });
    s.letterbox(true);
    if (!s.exists('c14_jiren4')) stageOn(s, 'c14_jiren4', 'jiren', jx, jy, 'left', 'Jiren');
    // Goku and Frieza get back on their feet beside 17.
    const [sx, sy] = heroTile(s);
    const [g2x, g2y] = onStage(s, sx - 2, sy);
    const [f2x, f2y] = onStage(s, sx - 1, sy + 1);
    s.pose('c14_gokuKO', null);
    s.pose('c14_friezaHurt', null);
    s.sprite('c14_friezaHurt', 'goldenFrieza');
    await s.walkAll([['c14_gokuKO', g2x, g2y, 2], ['c14_friezaHurt', f2x, f2y, 2]]);
    s.face('c14_gokuKO', 'c14_jiren4');
    s.face('c14_friezaHurt', 'c14_jiren4');
    await s.talk([
      ['goku', 'Frieza... 17... one more time. Everything we have!', 'shout'],
      ['frieza', 'Just this once, monkey.', 'smirk'],
    ]);
    await s.beamStruggle('android17', 'jiren', '#60e0a0', '#f02020', [
      'Goku, Frieza and Android 17 fire as one!',
      'Jiren\'s red ki pushes back!',
      'For every erased universe - PUSH!',
    ], 0.26);
    await s.narrate('Jiren holds. Then Goku and Frieza charge, grab him... and all three tumble off the edge together.');
    await Promise.all([ringOut(s, 'c14_gokuKO', jx + 2, 30), ringOut(s, 'c14_friezaHurt', jx + 1, 30), ringOut(s, 'c14_jiren4', jx, 30)]);
    s.music('victory');
    await s.narrate('The timer runs out. One fighter remains on the stage.');
    await s.talk([
      ['grandPriest', 'The Tournament of Power is over! The last one standing is Android 17. Universe 7 is the winner!', 'happy'],
      ['zeno', 'Universe 7 wins! Yay!', 'happy'],
    ]);
    await erased(s, 'Universe 11 has no fighters left. Zeno raises his hand... and Jiren, Toppo and Belmod vanish along with their universe.');

    // --- 6. The wish.
    stageOn(s, 'c14_shenron', 'c14_superShenron', sx + 2, sy - 6, 'down', 'Super Shenron');
    s.flash('#f8d040', 30);
    s.shake(30, 3);
    await s.talk([
      ['c14_superShenron', 'I am Super Shenron. State your wish, and I shall grant it. Any wish at all.', 'neutral'],
      ['android17', 'Any wish... A cruise ship crossed my mind. But no.', 'neutral'],
      ['android17', 'I wish for every universe erased in this tournament to be restored.', 'neutral'],
      ['c14_superShenron', 'Your wish... is GRANTED.', 'shout'],
    ]);
    s.flash('#ffffff', 40);
    await s.narrate('Light pours into the void. One after another, the erased universes return: Universe 9, 10, 6, 2, 4, 3... and Universe 11.');
    await s.talk([
      ['grandPriest', 'A pure-hearted wish. Had he wished for anything selfish, Lord Zeno would have erased all the universes anyway. Ohoho.', 'happy'],
      ['zeno', 'Good wish! Good wish!', 'happy'],
    ]);
    removeAll(s, 'c14_shenron');
    s.set('c14_stageC');
    s.set('c14_won');
    // LoG2's Mr. Satan rule looks at Goku's level when the final battle was won (see `post_satan_unlock`).
    s.set('c14_gokuLv', s.state.char('goku').level);
    await s.done('c14_top', false);
    await s.fadeOut(20);
    unforce(s);
    s.switchTo('goku');
    s.letterbox(false);
    await s.call('c14_epilogue');
  },
  // ================================================================ Epilogue: back to Earth, then free roam
  /**
   * LoG2 (§14.10, §16): after the final battle the game hands control back for free roam; the canonical ending (the
   * epilogue scenes and the credits) plays only when the player talks to the hub NPC, here Beerus and Whis at the
   * Capsule Corp garden table (`post_beerus_talk`). Mr. Satan's ZTV press conference is the alternative ending.
   */
  c14_epilogue: async (s) => {
    await s.narrate('For Frieza\'s "help", Whis restores his life on Beerus\'s grudging order. Frieza flies off to rebuild his army - and to train.');
    await s.narrate('And Universe 7\'s fighters go home to Earth, to their families... and to a very large victory dinner.');
    if (s.hasScript('post_start')) await s.call('post_start');
  },

  // ================================================================ Zeno's palace (from chapter 12 on)
  /** The Grand Priest: back to the stage mid-tournament, or a training trip there after the credits. */
  c14_gp_talk: async (s) => {
    if (s.check('chapter==14') && !s.flag('c14_departed')) {
      await s.say('grandPriest', 'The tournament begins when all ten of Universe 7\'s fighters arrive together. Lord Beerus and Whis will bring you. Ohoho.', 'happy');
      return;
    }
    if (s.check('chapter==14') && !s.flag('c14_won')) {
      const c = await s.ask('grandPriest', 'The tournament is still under way. Shall I return you to the stage?', ['Return to the stage', 'Not yet']);
      if (c !== 0) return;
      const map = s.flag('c14_stageB') ? 'top_arena_c' : s.flag('c14_stageA') ? 'top_arena_b' : 'top_arena_a';
      await warpTo(s, map, 3, 15, 'right');
      return;
    }
    if (s.flag('post_game')) {
      const c = await s.ask('grandPriest', 'The tournament stage still floats in the World of Void. Lord Zeno lets fighters train there. Shall I send you?', ['Take me there', 'No thank you']);
      if (c === 0) await warpTo(s, 'top_arena_a', 3, 15, 'right');
      return;
    }
    if (s.check('chapter>=13')) {
      await s.say('grandPriest', 'Eight universes, ten fighters each. Do prepare well. Lord Zeno is so looking forward to it. Ohoho.', 'happy');
      return;
    }
    await s.say('grandPriest', 'His Majesty has been asking about "the tournament" every hour. I do hope someone reminds him gently.', 'smirk');
  },

  /** The Grand Priest on the west ring during post-game training trips: back to Zeno's palace. */
  act5_gp_stage_talk: async (s) => {
    const c = await s.ask('grandPriest', 'I trust the training is going well. Shall I return you to Lord Zeno\'s palace?', ['Back to the palace', 'Keep training']);
    if (c !== 0) {
      await s.say('grandPriest', 'Take your time. The stage is not going anywhere. Ohoho.', 'happy');
      return;
    }
    await warpTo(s, HUB.zeno.map, HUB.zeno.arrive[0], HUB.zeno.arrive[1], 'up');
  },

  act5_zeno_talk: async (s) => {
    const line = s.flag('post_game') ? 'That was fun! Can we do it again? Erase... no, no erasing. Hehe!'
      : s.check('chapter>=14') ? 'Go go, Universe 7! ...Go go, everyone! Hehe!'
        : s.check('chapter>=13') ? 'Tournament! Tournament! Goku promised!'
          : 'Goku! When is the tournament? Is it now? Is it now?';
    await s.say('zeno', line, 'happy');
  },

  // ================================================================ stage triggers + boss taunts
  c14_bergamo_grow: async (s) => {
    await s.say('bergamo', 'Every blow you land only makes me BIGGER!', 'smirk');
  },
  c14_frost_p2: async (s) => {
    await s.say('frost', 'Poison needles. I did say I\'d use every trick, didn\'t I?', 'smirk');
  },
  c14_kefla_p2: async (s) => {
    await s.say('kefla', 'Super Saiyan 2! Gigantic Burst!', 'shout');
  },
  c14_anilaza_p2: async (s) => {
    await s.say('android17', 'It\'s reeling. Keep hitting it!', 'shout');
  },
  c14_toppo_p2: async (s) => {
    await s.say('toppo', 'Hakai spheres. Touch one and you vanish.', 'angry');
  },
  c14_dyspo_p2: async (s) => {
    await s.say('dyspo', 'Super Maximum Light Speed Mode!', 'shout');
  },
  c14_jiren_p2: async (s) => {
    await s.say('jiren', 'Your body moves without you. Then I will strike faster than your instinct!', 'angry');
  },
  c14_jiren_p3: async (s) => {
    await s.say('goku', 'I can feel everyone behind me, Jiren. That\'s my strength!', 'shout');
  },
});
