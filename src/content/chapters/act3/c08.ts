import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { ensureChapterState, force, unforce } from '../common';
import { bossExp, cast, clearWild, dismiss, exclusive, hide, inArena, knockOut, reloadHere, stageBoss } from './helpers';

/**
 * CHAPTER 8 — "The Copy" (Goku → Vegeta → Goku, L29-31).
 * Beats: c08_start (victory party on cc_yard, "Monaka" = Beerus in costume) → c08_monaka_fight (restartable from
 * the costumed "Monaka" NPC) → c08_p_bulma (the boys are missing) → Potaufeu: c08_boys (mushroom forest) →
 * c08_gryll (vault plaza mini-boss) → c08_vault (Commeson, Copy Vegeta with the core puzzle, Monaka's accidental
 * stomp) → c09_start. Every trigger-started beat is `exclusive` (re-entering its trigger mid-fight is a no-op).
 */

const PARTY8 = 'chapter==8&!c08_departed';
/** "Monaka" (Beerus in costume) is waiting for his match: from the challenge until the flick. */
const MONAKA_WAITS = 'chapter==8&quest:c08_monaka';
const VAULT = { hero: { x: 12, y: 12 }, seal: { x: 12, y: 5 }, copy: { x: 12, y: 8 } } as const;
/** Lawn duel with "Monaka": the hero's tile on the first run, on a rematch, and the costume's tile. */
const YARD = { hero: { x: 23, y: 13 }, rematch: { x: 23, y: 23 }, fake: { x: 23, y: 19 } } as const;
/** Invisible arena walls: Capsule Corp's door (21,7) and the west exit stay out of reach during the Monaka match. */
const YARD_ARENA = { x0: 6, y0: 11, x1: 42, y1: 30 } as const;
/** The vault's exit (row 17) stays out of reach while the copies fight. */
const VAULT_ARENA = { x0: 1, y0: 3, x1: 24, y1: 15 } as const;

registerOverlay('cc_yard', {
  props: [
    { kind: 'c08_truck', x: 8, y: 12, id: 'c08_truckProp', flag: 'chapter==8&!c08_truckGone' },
    { kind: 'table', x: 13, y: 17.6, flag: PARTY8 }, { kind: 'table', x: 29, y: 17.6, flag: PARTY8 }, { kind: 'counter', x: 19, y: 16, flag: PARTY8 },
  ],
  npcs: [
    { id: 'c08_p_bulma', sprite: 'bulma', x: 21, y: 18, dir: 'down', talk: 'c08_party_bulma', name: 'Bulma', showIf: PARTY8 },
    // Beerus is "busy" (in the Monaka costume) while his match with Goku is pending.
    { id: 'c08_p_beerus', sprite: 'beerus', x: 29, y: 20, dir: 'left', talk: 'c08_party_beerus', name: 'Beerus', showIf: `${PARTY8}&!quest:c08_monaka` },
    // Restart path: if the match was abandoned (Game Over, save/reload), "Monaka" waits on the lawn for a rematch.
    { id: 'c08_p_fake', sprite: 'c08_monakaCostume', x: YARD.fake.x, y: YARD.fake.y, dir: 'up', talk: 'c08_fake_talk', name: 'Monaka', showIf: MONAKA_WAITS },
    { id: 'c08_p_jaco', sprite: 'jaco', x: 35, y: 19, dir: 'left', talk: 'c08_party_jaco', name: 'Jaco', showIf: PARTY8 },
    { id: 'c08_p_krillin', sprite: 'krillin', x: 17, y: 22, dir: 'right', talk: 'c08_party_krillin', name: 'Krillin', showIf: PARTY8 },
    { id: 'c08_p_chichi', sprite: 'chichi', x: 14, y: 21, dir: 'up', talk: 'c08_party_chichi', name: 'Chi-Chi', showIf: PARTY8 },
    { id: 'c08_p_piccolo', sprite: 'piccolo', x: 9, y: 19, dir: 'right', talk: 'c08_party_piccolo', name: 'Piccolo', showIf: `${PARTY8}&!char:piccolo` },
    { id: 'c08_p_vegeta', sprite: 'vegeta', x: 31, y: 16, dir: 'down', talk: 'c08_party_vegeta', name: 'Vegeta', showIf: `${PARTY8}&!char:vegeta` },
    { id: 'c08_p_goten', sprite: 'goten', x: 24, y: 25, dir: 'up', talk: 'c08_party_kids', name: 'Goten', showIf: 'chapter==8&!c08_monakaDone', wander: 2 },
    { id: 'c08_p_trunks', sprite: 'trunksKid', x: 26, y: 25, dir: 'up', talk: 'c08_party_kids', name: 'Trunks', showIf: 'chapter==8&!c08_monakaDone', wander: 2 },
  ],
});

/** Copy Vegeta mirrors the real Vegeta's current stats (never weaker than its base sheet). */
function mirrorVegeta(s: ScriptApi, uid: string): void {
  const e = s.field.enemies.find((x) => x.uid === uid);
  if (!e) throw new Error(`[act3] copy ${uid} missing`);
  const v = s.state.char('vegeta');
  e.def = { ...e.def, str: Math.max(e.def.str, v.str), pow: Math.max(e.def.pow, v.pow), end: Math.min(110, Math.max(e.def.end, v.end)) };
}

/** How long the lit glyph pillars hold the Commeson core still (frames). */
const PIN_FRAMES = 60 * 12;

/** Light one glyph pillar during the core hunt; with both lit, the core is pinned and the pillars recharge. */
async function lightGlyph(s: ScriptApi, flag: 'c08_glyphW' | 'c08_glyphE', side: string): Promise<void> {
  if (!s.flag('c08_coreHunt') || s.flag(flag)) return;
  s.set(flag);
  s.sfx('powerUp');
  s.flash('#f8d060', 6);
  if (!s.flag('c08_glyphW') || !s.flag('c08_glyphE')) {
    s.banner(`The ${side} glyph pillar blazes! Now the other one!`);
    return;
  }
  const core = s.field.enemies.find((e) => e.uid === 'c08_coreE' && !e.dead);
  s.clear('c08_glyphW');
  s.clear('c08_glyphE');
  if (!core) return;
  core.frozen = PIN_FRAMES;
  s.field.fx.aura(core.x, core.y, '#f8d060', 6);
  s.shake(10, 2);
  s.banner('The glyphs pin the Commeson core in place! Smash it by hand!');
}

registerScripts({
  // ================================================================== beat 1: the victory party and "Monaka"
  c08_start: async (s) => {
    ensureChapterState(s, 8);
    if (s.flag('c07_hidBuu')) { s.clear('ea_buuAway'); s.clear('c07_hidBuu'); }
    await s.chapter(8, 'The Copy', 'Monaka must not lose');
    force(s, 'goku');
    await s.warp('cc_yard', 23, 13, 'down');
    s.letterbox(true);
    s.music('peaceful');
    await s.narrate('A few days after the Tournament of Destroyers, Bulma throws a victory party on the Capsule Corp lawn.');
    cast(s, 'c08_monakaA', 'monaka', 9, 15, 'right', 'Monaka');
    await s.walk('c08_monakaA', 15, 17, 1);
    await s.talk([
      ['c08_monakaA', 'Delivery! One box of space sweets for Mister Jaco!', 'happy'],
      ['jaco', 'My dessert order! Right on time. That driver works for Universe 7\'s best delivery company!', 'happy'],
      ['goku', 'Wait... MONAKA?! It\'s you! The strongest fighter in the universe! Fight me! Right now!', 'shock'],
      ['c08_monakaA', 'Eh? Fight? Me? I just drive the truck...', 'shock'],
    ]);
    await s.talk([
      ['beerus', '(Whis! Do something!)', 'shock'],
      ['whis', '(You told the lie, my lord. You fix it.)', 'smirk'],
      ['beerus', 'GOKU! Before you can fight Monaka, you must prove your dedication. Do... one hundred trillion sit-ups!', 'shout'],
      ['goku', 'Okay!', 'happy'],
    ]);
    s.pose('hero', 'charge');
    await s.narrate('One... two... three... Goku\'s sit-ups become a blur. The party guests finish dinner. Dessert. Coffee.');
    s.pose('hero', null);
    await s.talk([
      ['goku', 'Ninety-nine trillion, nine hundred ninety-nine billion... done! Good warm-up!', 'happy'],
      ['beerus', 'You... actually did them?! ...Excuse me. I need to... find Monaka. Somewhere private.', 'shock'],
    ]);
    hide(s, 'c08_p_beerus');
    dismiss(s, 'c08_monakaA');
    await s.fadeOut(16);
    await s.fadeIn(16);
    cast(s, 'c08_fake', 'c08_monakaCostume', 21, 9, 'down', 'Monaka');
    await s.walk('c08_fake', 23, 19, 1);
    await s.talk([
      ['c08_fake', 'I... am Monaka. Let us fight.', 'neutral'],
      ['goku', 'Huh. You got a lot taller, Monaka. And is that a tail?', 'neutral'],
      ['whis', 'He has been eating very well lately. Very, very well.', 'smirk'],
    ]);
    await s.quest('c08_monaka');
    await s.call('c08_monaka_fight');
  },

  /** The match with "Monaka". Started by c08_start, or replayed by talking to the costumed "Monaka" on the lawn. */
  c08_monaka_fight: exclusive('c08_monaka_fight', async (s) => {
    if (!s.check(`${MONAKA_WAITS}&!c08_monakaDone`)) return;
    force(s, 'goku');
    s.letterbox(true);
    s.music('peaceful');
    // Whis's travel menu waits until the match is over; Beerus is "elsewhere".
    hide(s, 'c04_whis');
    hide(s, 'c08_p_beerus');
    const rematch = !s.exists('c08_fake');
    dismiss(s, 'c08_fake', 'c08_p_fake');
    if (rematch) {
      await s.walk('hero', YARD.rematch.x, YARD.rematch.y, 1.2);
      s.face('hero', 'up');
      await s.say('goku', 'Round two, Monaka! I\'ve been training the whole time!', 'happy');
    }
    s.letterbox(false);
    const r = await inArena(s, s.fight('c08_monakaBeerus', { x: YARD.fake.x, y: YARD.fake.y, uid: 'c08_monakaF', loseOk: true }), YARD_ARENA);
    bossExp(s, 'c08_monakaBeerus', r === 'lose' ? 'end' : r);
    s.letterbox(true);
    cast(s, 'c08_monakaF', 'c08_monakaCostume', YARD.fake.x, YARD.fake.y, 'down', 'Monaka');
    s.pose('hero', null);
    await s.say('c08_monakaF', 'Enough. *flick*', 'neutral');
    s.flash('#ffffff', 10);
    await knockOut(s, 'hero', 23, 25);
    s.pose('hero', null);
    await s.talk([
      ['goku', 'WOW! One flick and I flew across the lawn! That\'s Monaka for ya! I gotta train harder!', 'happy'],
      ['c08_monakaF', 'Yes. Train. Far away. For a long time.', 'neutral'],
    ]);
    dismiss(s, 'c08_monakaF');
    s.set('c08_monakaDone');
    await s.done('c08_monaka', false);
    await s.give('pow1');
    // The real Monaka drives off - with two stowaways.
    cast(s, 'c08_monakaA', 'monaka', 12, 15, 'left', 'Monaka');
    await s.pan(10, 14, 30);
    if (s.exists('c08_p_goten') && s.exists('c08_p_trunks')) {
      await s.walkAll([['c08_p_goten', 10, 14, 2], ['c08_p_trunks', 11, 14, 2]]);
      await s.say('trunksKid', '(Psst, Goten! Let\'s hide in the truck and see where Monaka goes!)', 'smirk');
      hide(s, 'c08_p_goten');
      hide(s, 'c08_p_trunks');
    }
    await s.say('c08_monakaA', 'Next stop... the planet Potaufeu! Long drive.', 'happy');
    dismiss(s, 'c08_monakaA');
    s.field.map.removeProp('c08_truckProp');
    s.sfx('dash');
    s.set('c08_truckGone');
    s.follow();
    s.letterbox(false);
    await reloadHere(s, 'down');
    await s.narrate('The party goes on. Bulma looks worried - she seems to be searching for someone.');
  }),

  c08_fake_talk: async (s) => {
    if (!s.check(`${MONAKA_WAITS}&!c08_monakaDone`)) {
      await s.say('c08_p_fake', '...', 'neutral');
      return;
    }
    const c = await s.ask('c08_p_fake', 'I... am Monaka. Our match is not finished. Let us fight.', ['Fight!', 'Not yet']);
    if (c !== 0) {
      await s.say('c08_p_fake', 'Monaka is very patient. Very. ...Hurry up.', 'neutral');
      return;
    }
    await s.call('c08_monaka_fight');
  },

  // ================================================================== beat 2: the boys are missing
  c08_party_bulma: async (s) => {
    if (!s.check('chapter==8&c08_monakaDone&!c08_departed')) {
      await s.say('bulma', 'Grab a plate! There\'s plenty for everyone, even gods.', 'happy');
      return;
    }
    await s.talk([
      ['bulma', 'Have you seen Trunks and Goten? They were here five minutes ago, and now they\'ve completely vanished!', 'shock'],
      ['jaco', 'Hmm. Monaka\'s delivery truck has a Galactic Patrol tracker. It\'s heading for the planet Potaufeu.', 'neutral'],
      ['jaco', 'And... there\'s a second, smaller heat signature in the cargo hold. Two, actually. Kid-sized.', 'shock'],
      ['bulma', 'Those little brats stowed away?! In SPACE?! Vegeta!', 'angry'],
      ['vegeta', 'Tch. I\'ll get them. Jaco, your ship. Now.', 'angry'],
      ['goku', 'I\'ll come too! I\'ll just use Instant Trans-- whoa!', 'happy'],
    ]);
    s.flash('#ffffff', 6);
    s.sfx('teleport');
    await s.talk([
      ['goku', 'Huh? I aimed for Potaufeu and ended up behind the hedge. My ki feels all wobbly since the Hit fight...', 'hurt'],
      ['whis', 'Delayed ki disorder from the Blue Kaio-ken. Rest, Goku. No ki for a day or two.', 'neutral'],
      ['vegeta', 'Stay here and nap, Kakarot. The prince will handle it.', 'smirk'],
    ]);
    s.set('c08_departed');
    await s.quest('c08_potaufeu');
    s.unlockRegion('c08_spot_potaufeu');
    await s.narrate('Potaufeu has been added to the world map!');
    await s.fadeOut(20);
    // Hand over to Vegeta only once the lawn is dark (his party NPC is still standing there until the warp).
    force(s, 'vegeta');
    await s.narrate('Jaco\'s ship rockets across the galaxy toward Potaufeu, a desert world covered in giant mushrooms.');
    await s.warp('c08_potaufeu_landing', 18, 13, 'up');
    s.letterbox(true);
    s.music('space');
    cast(s, 'c08_jacoA', 'jaco', 16, 12, 'down', 'Jaco');
    await s.talk([
      ['jaco', 'Monaka\'s truck! But no sign of the kids. Or Monaka.', 'neutral'],
      ['vegeta', 'Their ki is north. In that... mushroom forest. And there\'s something else. Something sticky.', 'angry'],
      ['jaco', 'I\'ll guard the ship! It\'s a very important job! Galactic Patrol procedure!', 'happy'],
    ]);
    dismiss(s, 'c08_jacoA');
    s.set('c08_landed');
    s.letterbox(false);
    await reloadHere(s, 'up');
    await s.narrate('Find Goten and Trunks in the mushroom forest to the north.');
  },

  // ================================================================== beat 3: the boys and the Commeson's goo
  c08_boys: exclusive('c08_boys', async (s) => {
    if (!s.check('chapter==8&c08_landed&!c08_boysFound')) return;
    force(s, 'vegeta');
    s.letterbox(true);
    cast(s, 'c08_goten', 'goten', 4, 15, 'right', 'Goten');
    cast(s, 'c08_trunks', 'trunksKid', 6, 15, 'right', 'Trunks');
    cast(s, 'c08_hench1', 'c08_gooHench', 4, 17, 'up', 'Henchman');
    cast(s, 'c08_hench2', 'c08_gooHench', 7, 17, 'up', 'Henchman');
    await s.talk([
      ['trunksKid', 'Dad?! Uh... hi! We were totally not hiding in a delivery truck!', 'shock'],
      ['goten', 'Mr. Vegeta! These guys attacked an old man, so we punched them, and they turned into purple goo!', 'happy'],
      ['vegeta', 'Copies. Something here is copying living things. Stand back, both of you.', 'angry'],
    ]);
    dismiss(s, 'c08_hench1', 'c08_hench2');
    const uids = ['c08_w1', 'c08_w2', 'c08_w3'];
    s.spawnEnemy('c08_gooHench', 4, 17, uids[0]);
    s.spawnEnemy('c08_gooHench', 7, 17, uids[1]);
    s.spawnEnemy('c08_gooBlob', 6, 13, uids[2]);
    s.letterbox(false);
    s.free();
    await s.waitDefeat(uids);
    s.lock();
    s.letterbox(true);
    cast(s, 'c08_potageA', 'c08_potage', 8, 18, 'up', 'Potage');
    await s.talk([
      ['c08_potageA', 'Thank you, young ones... I am Potage, the last guardian of Potaufeu.', 'sad'],
      ['c08_potageA', 'A criminal named Gryll came for our "superhuman water". There is no such water. That rumour hides something far worse.', 'sad'],
      ['c08_potageA', 'The Commeson. A living weapon that copies whatever it touches. The copy grows strong; the original fades away.', 'shock'],
      ['c08_potageA', 'Gryll\'s men are already copies. And Gryll... his copy took my seal key to the vault!', 'shock'],
      ['vegeta', 'Then I\'ll stop him. You two, go back to Jaco\'s ship. And Trunks - your mother will deal with you later.', 'angry'],
      ['trunksKid', 'Ugh. Worst. Vacation. Ever.', 'sad'],
    ]);
    dismiss(s, 'c08_goten', 'c08_trunks', 'c08_potageA');
    s.set('c08_boysFound');
    await s.done('c08_potaufeu');
    await s.quest('c08_gryll');
    s.letterbox(false);
    await s.narrate('Copy Gryll is heading for the Commeson vault at the north end of the forest. There is a save point outside it.');
  }),

  // ================================================================== beat 4: Copy Gryll at the vault door
  c08_gryll: exclusive('c08_gryll', async (s) => {
    if (!s.check('chapter==8&c08_boysFound&!c08_gryllDone')) return;
    force(s, 'vegeta');
    s.letterbox(true);
    clearWild(s);
    cast(s, 'c08_gryllN', 'c08_gooGryll', 21, 4, 'down', 'Copy Gryll');
    await s.talk([
      ['c08_gryllN', 'The key to infinite power... and some monkey wants to stop me? Blehh-heh-heh!', 'smirk'],
      ['vegeta', 'You\'re not even the real Gryll. You\'re a puddle with an attitude.', 'smirk'],
    ]);
    s.remove('c08_gryllN');
    s.letterbox(false);
    const r = await s.fight('c08_gryll', { x: 21, y: 4, uid: 'c08_gryllF' });
    bossExp(s, 'c08_gryll', r);
    s.letterbox(true);
    dismiss(s, 'c08_gryllF');
    s.field.enemies = s.field.enemies.filter((e) => e.def.id !== 'c08_gooBlob');
    s.shake(30, 2);
    await s.talk([
      ['narrator', 'Copy Gryll melts into a puddle. The pacifier-shaped key rolls out of the goo... straight into the slot of the vault door.'],
      ['vegeta', 'That doesn\'t look good.', 'shock'],
    ]);
    s.sfx('explode');
    s.flash('#c070f0', 16);
    await s.give('c08_sealKey');
    s.set('c08_sealOpen');
    s.set('c08_gryllDone');
    await s.done('c08_gryll');
    await s.quest('c08_copy');
    s.letterbox(false);
    await s.narrate('The seal is breaking. Something is stirring inside the vault.');
  }),
  c08_vault_locked: async (s) => {
    await s.narrate('A thick purple goo seals the vault door shut. Something on the other side is breathing.');
  },

  // ================================================================== beat 5: the Commeson and Copy Vegeta
  c08_vault: exclusive('c08_vault', async (s) => {
    if (!s.check('chapter==8&c08_gryllDone&!c08_copyDone')) return;
    force(s, 'vegeta');
    s.letterbox(true);
    s.music('tense');
    clearWild(s);
    await s.walk('hero', VAULT.hero.x, VAULT.hero.y, 1);
    s.face('hero', 'up');
    cast(s, 'c08_coreN', 'c08_core', VAULT.seal.x, VAULT.seal.y + 1, 'down', 'Commeson');
    await s.lift('c08_coreN', 10, 10);
    await s.say('vegeta', 'So you\'re the Commeson. You\'re smaller than I expected.', 'smirk');
    await s.walk('c08_coreN', VAULT.hero.x, VAULT.hero.y - 1, 4);
    s.aura('hero', '#c070f0');
    s.flash('#c070f0', 20);
    s.shake(30, 3);
    s.pose('hero', 'hurt');
    await s.say('vegeta', 'Gah! It\'s... inside me... draining...!', 'hurt');
    dismiss(s, 'c08_coreN');
    s.aura('hero', null);
    cast(s, 'c08_copyN', 'vegetaSSB', VAULT.copy.x, VAULT.copy.y, 'down', 'Copy Vegeta');
    s.aura('c08_copyN', '#c070f0');
    s.pose('hero', 'ko');
    await s.talk([
      ['c08_copyN', '...', 'smirk'],
      ['vegeta', 'That... is my face. And my power. Give it... back...', 'hurt'],
    ]);
    // Goku arrives; Vegeta fades.
    await s.fadeOut(16);
    s.pose('hero', null);
    force(s, 'goku');
    cast(s, 'c08_vegWeak', 'vegeta', VAULT.hero.x - 3, VAULT.hero.y + 1, 'up', 'Vegeta');
    s.pose('c08_vegWeak', 'hurt');
    s.actor('c08_vegWeak').alpha = 0.55;
    cast(s, 'c08_potageV', 'c08_potage', VAULT.hero.x + 3, VAULT.hero.y + 2, 'up', 'Potage');
    s.place('hero', VAULT.hero.x, VAULT.hero.y, 'up');
    await s.fadeIn(16);
    s.flash('#ffffff', 10);
    s.sfx('teleport');
    await s.talk([
      ['goku', 'Made it! Sorry, my Instant Transmission dropped me in Bulma\'s bathtub first. Then on a penguin. Then here!', 'happy'],
      ['goku', 'Whoa, two Vegetas?! And one of them\'s see-through!', 'shock'],
      ['vegeta', 'Kakarot... that thing copied me. I\'m... fading. Don\'t you DARE lose to me.', 'hurt'],
      ['c08_potageV', 'Prince! Bite down on the seal key! Its old magic will slow the fading!', 'shock'],
      ['vegeta', '...You want me to chew on a pacifier.', 'angry'],
      ['c08_potageV', 'It is a sacred relic!', 'shock'],
    ]);
    await s.emote('c08_vegWeak', '#');
    await s.talk([
      ['vegeta', '*chomp* ...If anyone EVER mentions this, I will destroy them.', 'angry'],
      ['goku', 'Pfff--! Okay, okay! I won\'t tell anybody!', 'happy'],
    ]);
    // The Commeson spits out copies of the boys.
    await s.say('c08_copyN', '...', 'smirk');
    s.flash('#c070f0', 10);
    dismiss(s, 'c08_copyN');
    const wave = ['c08_cg1', 'c08_cg2'];
    s.spawnEnemy('c08_copyGoten', VAULT.copy.x - 3, VAULT.copy.y + 1, wave[0]);
    s.spawnEnemy('c08_copyTrunks', VAULT.copy.x + 3, VAULT.copy.y + 1, wave[1]);
    await s.say('goku', 'Copies of Goten and Trunks?! It must have grabbed a taste of them in the forest!', 'shock');
    s.letterbox(false);
    s.free();
    await inArena(s, s.waitDefeat(wave), VAULT_ARENA);
    s.lock();
    s.letterbox(true);
    cast(s, 'c08_copyN', 'vegetaSSB', VAULT.copy.x, VAULT.copy.y, 'down', 'Copy Vegeta');
    await s.talk([
      ['c08_potageV', 'Listen! The copy cannot be harmed while the Commeson\'s core still lives inside its shadow!', 'shout'],
      ['c08_potageV', 'Catch the core and crush it with your bare hands! Ki blasts only feed it!', 'shout'],
      ['c08_potageV', 'And the glyph pillars by the walls - my people built them to hold the core. Light both, and it cannot flee!', 'shout'],
      ['goku', 'Got it. Light the pillars, punch the little purple thing, then punch the big purple Vegeta!', 'smirk'],
    ]);
    await s.narrate('Copy Vegeta is invulnerable while the core lives. Press A at both glyph pillars to pin the core, then destroy it with melee attacks.');
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 30);
    dismiss(s, 'c08_copyN');
    s.letterbox(false);
    stageBoss(s, 'c08_copyVegeta', VAULT.copy.x, VAULT.copy.y, 'c08_copyF');
    mirrorVegeta(s, 'c08_copyF');
    const core = s.spawnEnemy('c08_core', VAULT.copy.x + 2, VAULT.copy.y + 2, 'c08_coreE');
    core.onDefeat = 'c08_core_broken';
    // A replayed vault (after a Game Over or reload) starts the puzzle from scratch.
    for (const f of ['c08_glyphW', 'c08_glyphE', 'c08_coreExposed']) s.clear(f);
    s.set('c08_coreHunt');
    const r = await inArena(s, s.fight('c08_copyVegeta', { uid: 'c08_copyF', existing: true }), VAULT_ARENA);
    for (const f of ['c08_coreHunt', 'c08_glyphW', 'c08_glyphE']) s.clear(f);
    bossExp(s, 'c08_copyVegeta', r);
    s.letterbox(true);
    s.transformNow(null);
    dismiss(s, 'c08_coreE');
    cast(s, 'c08_copyF', 'vegetaSSB', VAULT.copy.x, VAULT.copy.y, 'down', 'Copy Vegeta');
    s.pose('c08_copyF', 'hurt');
    cast(s, 'c08_shard', 'c08_core', VAULT.copy.x + 2, VAULT.copy.y + 3, 'down', 'Core Fragment');
    await s.talk([
      ['c08_potageV', 'The core is trying to reform! If it rejoins the copy, it will heal completely!', 'shock'],
      ['goku', 'Huff... huff... I can\'t get there in time...!', 'hurt'],
    ]);
    cast(s, 'c08_monakaV', 'monaka', VAULT.hero.x, 16, 'up', 'Monaka');
    await s.walk('c08_monakaV', VAULT.copy.x + 2, VAULT.copy.y + 4, 1);
    await s.say('c08_monakaV', 'Delivery for Mister Potage? Hello? Is this the right vau-- oops. I stepped in something.', 'neutral');
    s.sfx('blastHit');
    dismiss(s, 'c08_shard');
    s.flash('#c070f0', 24);
    s.shake(20, 2);
    dismiss(s, 'c08_copyF');
    s.actor('c08_vegWeak').alpha = 1;
    s.pose('c08_vegWeak', null);
    await s.talk([
      ['narrator', 'The core bursts under Monaka\'s boot. Copy Vegeta dissolves into harmless purple mist, and Vegeta\'s power rushes back.'],
      ['goku', 'MONAKA! You took out the Commeson with ONE STEP! You really are the strongest in the universe!', 'happy'],
      ['c08_monakaV', '...Eh? I did? Oh. Okay! Sign here for the package, please.', 'happy'],
      ['vegeta', '...*spits out the pacifier* Nobody. Speak. Of this.', 'angry'],
      ['c08_potageV', 'The Commeson is gone at last. My people\'s sacrifice is finally at rest. Thank you, all of you.', 'happy'],
    ]);
    s.take('c08_sealKey');
    s.set('c08_copyDone');
    await s.done('c08_copy', false);
    await s.give('end3');
    s.heal();
    await s.fadeOut(30);
    s.set('c08_done');
    unforce(s);
    await s.narrate('Bulma grounds Trunks for a month. Goten gets the same sentence from Chi-Chi, plus extra homework. Monaka gets a very generous tip from Lord Beerus.');
    await s.narrate('Peaceful days return to Earth... but far away, in a ruined future, a young man with a sword is running for his life.');
    if (s.hasScript('c09_start')) await s.call('c09_start');
  }),

  /** Commeson core destroyed: Copy Vegeta becomes vulnerable (vulnerableIf c08_coreExposed). */
  c08_core_broken: async (s) => {
    if (s.flag('c08_coreExposed')) return;
    s.set('c08_coreExposed');
    s.banner('The Commeson core cracked! The copy can be hurt!');
    s.sfx('explode');
  },
  c08_glyph_w: async (s) => lightGlyph(s, 'c08_glyphW', 'west'),
  c08_glyph_e: async (s) => lightGlyph(s, 'c08_glyphE', 'east'),
  c08_copy_phase2: async (s) => {
    s.banner('Copy Vegeta: "Galick Gun!"');
    s.sfx('charge');
  },

  // ================================================================== Potaufeu NPCs
  c08_jaco_talk: async (s) => {
    await s.say('jaco', s.flag('c08_boysFound')
      ? 'The kids are safe in my ship! I gave them snacks. They ate ALL the snacks. Even the emergency snacks.'
      : 'I\'m guarding the ship! From... mushrooms. Hurry and find those kids, Vegeta!', 'neutral');
  },
  c08_patrol_talk: async (s) => {
    await s.talk([
      ['c08_patrolman', 'Galactic Patrol, sector 8. We\'ve been after Gryll for years. Turns out the goo got him first.', 'neutral'],
      ['c08_patrolman', 'Jaco? He\'s... enthusiastic. Very enthusiastic. Please don\'t tell him I said that.', 'smirk'],
    ]);
  },
  c08_monaka_talk: async (s) => {
    if (s.check('done:c08_delivery')) {
      await s.say('monaka', 'All deliveries complete! Lord Beerus says I\'m his favourite driver. He also says never to fight anyone. Easy!', 'happy');
      return;
    }
    if (s.check('quest:c08_delivery') && s.count('c08_parcel') >= 3) {
      await s.call('c08_parcels_turnin');
      return;
    }
    if (s.check('quest:c08_delivery')) {
      await s.say('monaka', `You found ${s.count('c08_parcel')} of my 3 parcels! They bounced out somewhere in the mushroom forest.`, 'neutral');
      return;
    }
    if (!s.check('chapter>=8')) {
      await s.say('monaka', 'Deliveries anywhere in Universe 7!', 'happy');
      return;
    }
    await s.talk([
      ['monaka', 'Oh no, oh no. My truck hit a mushroom and three parcels flew out the back!', 'shock'],
      ['monaka', 'They\'re all addressed to Potaufeu\'s guardian. Could you find them? I\'m scared of the forest. And of everything.', 'sad'],
    ]);
    await s.quest('c08_delivery');
  },
  c08_parcels_turnin: async (s) => {
    if (!s.check('quest:c08_delivery') || s.count('c08_parcel') < 3) return;
    s.take('c08_parcel', 3);
    await s.say('hero', 'Three parcels, delivered.', 'smirk');
    await s.done('c08_delivery', false);
    await s.give('pow3');
  },
  c08_potage_talk: async (s) => {
    if (s.check('quest:c08_delivery') && s.count('c08_parcel') >= 3) {
      await s.say('c08_potage', 'Those parcels have my name on them! I ordered new slippers a century ago. Delivery is slow out here.', 'happy');
      await s.call('c08_parcels_turnin');
      return;
    }
    if (s.check('quest:c08_water') && s.count('c08_water') >= 3) {
      s.take('c08_water', 3);
      await s.talk([
        ['c08_potage', 'The jars! Gryll\'s gang dug these up thinking they were the "superhuman water".', 'happy'],
        ['c08_potage', 'It is spring water. Very nice spring water, but water. The legend was a lie to hide the Commeson.', 'neutral'],
        ['c08_potage', 'Take this instead. My people\'s last remedy. It is worth more than any legend.', 'happy'],
      ]);
      await s.done('c08_water', false);
      await s.give('end3');
      await s.give('senzu');
      return;
    }
    if (s.check('done:c08_water')) {
      await s.say('c08_potage', s.check('c08_copyDone') ? 'A century of guarding a seal, and it ends with a delivery man\'s boot. The universe has a sense of humour.' : 'Please, be careful near the vault.', 'happy');
      return;
    }
    if (s.check('quest:c08_water')) {
      await s.say('c08_potage', `${s.count('c08_water')} of 3 jars so far. Gryll\'s gang hid them in jars all over the forest. Break them open.`, 'neutral');
      return;
    }
    if (!s.check('chapter>=8')) {
      await s.say('c08_potage', 'Welcome to Potaufeu, traveller.', 'neutral');
      return;
    }
    await s.talk([
      ['c08_potage', 'Gryll\'s men buried three jars of their precious "superhuman water" in the mushroom forest.', 'sad'],
      ['c08_potage', 'If anyone drinks it believing it gives power, more fools will come here. Please, bring the jars to me.', 'sad'],
    ]);
    await s.quest('c08_water');
  },
  c08_boys_talk: async (s) => {
    await s.talk([
      ['trunksKid', 'Mom is going to ground me until I\'m thirty.', 'sad'],
      ['goten', 'Space was cool though! It was really cold in the truck. My toes are still blue!', 'happy'],
    ]);
  },

  // ================================================================== party NPCs (cc_yard, chapter 8)
  c08_party_beerus: async (s) => {
    await s.say('beerus', s.flag('c08_monakaDone') ? 'Monaka is the strongest fighter in the universe. If anyone says otherwise, I destroy them.' : 'Why is Goku looking at the delivery truck like that? Whis. WHIS.', 'angry');
  },
  c08_party_jaco: async (s) => {
    await s.say('jaco', s.flag('c08_monakaDone') ? 'My sweets were delicious. And my tracker says Monaka\'s truck is already halfway to Potaufeu. Efficient!' : 'Monaka is our best courier. He has never once been late. Or hit anyone.', 'happy');
  },
  c08_party_krillin: async (s) => {
    await s.say('krillin', 'Everyone keeps telling me to "keep the Monaka thing quiet". What Monaka thing? ...Oh. OH.', 'shock');
  },
  c08_party_chichi: async (s) => {
    await s.say('chichi', 'Goten! Where did you run off to? If you got into that truck I swear...', 'angry');
  },
  c08_party_piccolo: async (s) => {
    await s.say('piccolo', 'Goku is the strongest fighter in the universe and he can\'t tell a god in a costume from a delivery man. Incredible.', 'smirk');
  },
  c08_party_vegeta: async (s) => {
    await s.say('vegeta', 'I know the truth about Monaka. If Kakarot finds out, his motivation dies. ...Let him believe. It\'s funnier.', 'smirk');
  },
  c08_party_kids: async (s) => {
    await s.talk([
      ['trunksKid', 'Hey Goten, wanna see what\'s inside Monaka\'s truck?', 'smirk'],
      ['goten', 'Yeah! Maybe it\'s full of candy!', 'happy'],
    ]);
  },
});
