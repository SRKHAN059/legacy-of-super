import { registerScripts, type ScriptApi } from '../../../game/script';
import { registerOverlay } from '../../registry';
import { ensureChapterState, force, unforce } from '../common';
import { addProp, exclusive, removeIf, removeProp, respawn } from './shared';

/**
 * Chapter 5 - "Resurrection 'F'" (Gohan L16 forced, then Piccolo L18). Main beats:
 *   c05_start (cc_yard): Jaco crash-lands with the warning; Gohan answers Bulma's call (suit).
 *   waste_entry: the team assembles (Piccolo joins, Gohan gets his gi back) -> wave 1.
 *   waste_canyon: wave 2 -> Shisami (ends 35%) -> Tagoma blasts him -> Gohan survives Tagoma -> Piccolo takes over.
 *   waste_mesa: wave 3 (Piccolo) -> Tagoma / Ginyu body change -> Ginyu-Tagoma boss (ends 30%) -> Gohan SSJ ->
 *   Frieza (scripted) -> Piccolo shields Gohan -> Goku & Vegeta arrive with Whis -> c06_start.
 */

const WAVE_ALLIES: Array<[string, string]> = [['c05_krillin', 'krillinGi'], ['c05_tien', 'tien'], ['c05_roshi', 'roshi'], ['c05_jaco', 'jaco']];

/** Wildlife bolts when the ships land: clear map-defined enemies (no uid) so the waves stand alone. */
function scatterWildlife(s: ScriptApi): void {
  for (const e of s.field.enemies) if (!e.uid) e.dead = true;
}

/**
 * Spawn a wave of soldiers and fight until the field is clear (LoG2 field battle). The local wildlife has already
 * scattered, so `clearEnemies` only waits on the soldiers.
 */
async function wave(s: ScriptApi, tag: string, spawns: Array<[string, number, number]>): Promise<void> {
  scatterWildlife(s);
  spawns.forEach(([type, x, y], i) => s.spawnEnemy(type, x, y, `${tag}_${i}`));
  s.toast(`${spawns.length} Frieza Force soldiers incoming!`);
  await s.clearEnemies();
  s.field.forceHostile = null;
}

/** Allies trade blows with a few cosmetic soldiers before a wave (they hold the flanks during the fight). */
async function alliesEngage(s: ScriptApi, ax: number, ay: number, tx: number, ty: number): Promise<void> {
  WAVE_ALLIES.forEach(([id, sprite], i) => respawn(s, id, sprite, ax - 1 - (i % 2), ay - 1 + i, 'right'));
  for (let i = 0; i < 3; i++) respawn(s, `c05_dummy${i}`, i === 1 ? 'frizaSoldierB' : 'frizaSoldier', tx + i, ty - 1 + i, 'left');
  await s.blast('c05_krillin', 'c05_dummy0', '#f8e070');
  s.boom(tx, ty - 1, 12);
  s.remove('c05_dummy0');
  await s.blast('c05_tien', 'c05_dummy1', '#f8f0a0');
  s.boom(tx + 1, ty, 12);
  s.remove('c05_dummy1');
  await s.blast('c05_jaco', 'c05_dummy2', '#60e0f0');
  s.boom(tx + 2, ty + 1, 12);
  s.remove('c05_dummy2');
}

// ---------------------------------------------------------------- opening at Capsule Corp
async function opening(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.show('hero', false);
  s.place('hero', 21, 12, 'down');
  respawn(s, 'c05_bulmaA', 'bulma', 24, 20, 'down');
  respawn(s, 'c05_gotenA', 'goten', 22, 21, 'right');
  respawn(s, 'c05_trunksA', 'trunksKid', 26, 21, 'left');
  await s.pan(26, 21, 1);
  await s.fadeIn(20);
  await s.narrate('Months later. Goku and Vegeta were still training on Lord Beerus\'s planet, and back on Earth, baby Pan was growing fast...');
  s.shake(50, 3);
  s.sfx('explode');
  s.flash('#ffffff', 12);
  addProp(s, 'c05_jacoShip', 28.5, 22, 'c05_jacoShipProp');
  s.boom(30, 23, 20, '#f0a040');
  respawn(s, 'c05_jacoA', 'jaco', 30, 25, 'up');
  s.music('tense');
  await s.talk([
    ['bulma', 'My LAWN! Who parks a spaceship in somebody\'s- Jaco?!', 'angry'],
    ['jaco', 'Bulma! Jaco of the Galactic Patrol. Elite. You remember. No time! Terrible news!', 'shock'],
    ['jaco', 'Frieza has been brought back to life. He\'s coming here, to Earth, with a thousand soldiers. They\'ll land within the hour!', 'shout'],
    ['bulma', 'FRIEZA?! Goku and Vegeta are on Beerus\'s planet, and Goku has my phone!', 'shock'],
  ]);
  await s.narrate('Bulma dialled the number Whis had given her. It rang. And rang. And rang.');
  await s.talk([
    ['bulma', 'Of course an angel doesn\'t pick up his phone. Okay. Plan B.', 'angry'],
    ['bulma', 'Gohan, Piccolo, Krillin, Tien, Master Roshi - I\'m calling everyone!', 'neutral'],
    ['goten', 'We\'ll fight too! Right, Trunks?', 'happy'],
    ['bulma', 'Absolutely NOT. You two are staying right here.', 'angry'],
  ]);
  // Gohan arrives - straight from work.
  s.place('hero', 21, 12, 'down');
  await s.join('gohan', 16);
  force(s, 'gohan');
  s.outfit('gohan', 'gohanSuit');
  await s.learn('gohan', 'masenko');
  s.show('hero', true);
  await s.walk('hero', 23, 19, 1.6);
  s.face('hero', 'c05_bulmaA');
  await s.talk([
    ['gohan', 'Bulma! I came straight from the university. Videl and Pan are safe with Mr. Satan. Is it true? Frieza?', 'shock'],
    ['bulma', 'Jaco tracked his fleet. They\'re landing in the Rocky Wasteland. Piccolo and the others will meet you there.', 'neutral'],
    ['gohan', 'I haven\'t trained properly in years... but I\'ll hold them off until Dad gets here.', 'neutral'],
    ['bulma', 'Yajirobe sent these down from Korin\'s. Use them wisely.', 'neutral'],
  ]);
  await s.give('senzu', 2);
  s.unlockRegion('spot_wasteland');
  await s.quest('c05_army');
  await s.narrate('New destination on the world map: Rocky Wasteland.');
  s.set('c05_called');
  removeIf(s, 'c05_bulmaA', 'c05_gotenA', 'c05_trunksA', 'c05_jacoA');
  removeProp(s, 'c05_jacoShipProp');
  s.follow();
  s.letterbox(false);
  // Scene cut: reload the lawn so the chapter-5 crowd (Bulma, Jaco, the boys) can be talked to.
  await s.warp('cc_yard', 23, 18, 'down');
  await s.narrate('Fly to the Rocky Wasteland from the world sign in West City. Gohan fights alone until Piccolo takes over.');
  s.music('heroic');
}

// ---------------------------------------------------------------- waste_entry
async function assemble(s: ScriptApi): Promise<void> {
  s.set('c05_assembled');
  s.letterbox(true);
  s.place('hero', 4, 15, 'right');
  respawn(s, 'c05_piccoloA', 'piccolo', 8, 13, 'left');
  respawn(s, 'c05_krillin', 'krillinGi', 9, 15, 'left');
  respawn(s, 'c05_tien', 'tien', 8, 16, 'left');
  respawn(s, 'c05_roshi', 'roshi', 10, 16, 'left');
  respawn(s, 'c05_jaco', 'jaco', 10, 14, 'left');
  await s.pan(7, 15, 20);
  await s.talk([
    ['piccolo', 'Gohan. You\'re going to fight Frieza\'s army in a necktie?', 'smirk'],
    ['gohan', 'I didn\'t have time to change!', 'sad'],
    ['piccolo', 'Hmph. Hold still.', 'neutral'],
  ]);
  await s.blast('c05_piccoloA', 'hero', '#f8f8d0');
  s.flash('#ffffff', 12);
  s.outfit('gohan', null);
  await s.talk([
    ['gohan', 'My old gi! Thanks, Mr. Piccolo!', 'happy'],
    ['krillin', 'I can\'t believe I\'m fighting Frieza again. He blew me up once, you know! On Namek! I have feelings about this!', 'shock'],
    ['roshi', 'Leave the small fry to the Turtle Hermit. These old bones still have one Max Power left in them!', 'smirk'],
    ['jaco', 'And Jaco the Elite will cover your flank! From a safe distance! Strategically!', 'happy'],
    ['tien', 'They\'re here.', 'neutral'],
  ]);
  s.shake(60, 2);
  s.sfx('explode');
  await s.narrate('Round ships streaked overhead by the dozen, and the canyon echoed with the roar of landing engines.');
  await s.join('piccolo', 18);
  await s.learn('piccolo', 'specialBeamCannon', true);
  await s.say('piccolo', 'Gohan leads here. I\'ll be right behind you. Go!', 'neutral');
  s.follow();
  s.letterbox(false);
  await s.narrate('The first wave is landing on the east road. Break through!');
}

async function waveOne(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.music('battle');
  scatterWildlife(s);
  await s.pan(27, 13, 30);
  await s.say('frizaSoldier', 'Earthlings! Surrender in the name of Lord Frieza!', 'shout');
  await alliesEngage(s, 16, 12, 22, 9);
  s.follow();
  s.letterbox(false);
  await wave(s, 'c05w1', [
    ['c05_grunt', 24, 11], ['c05_grunt', 30, 12], ['c05_raider', 27, 13], ['c05_raider', 33, 14],
    ['soldier', 26, 16], ['soldier', 31, 16], ['c05_grunt', 35, 12],
  ]);
  s.set('c05_wave1');
  s.letterbox(true);
  await s.talk([
    ['gohan', 'Huff... huff... I\'m slower than I used to be. A lot slower.', 'hurt'],
    ['piccolo', 'Don\'t stop now. Ships are still coming down in the canyon to the east.', 'neutral'],
  ]);
  removeIf(s, ...WAVE_ALLIES.map(([id]) => id), 'c05_piccoloA');
  s.letterbox(false);
  s.music('field');
}

// ---------------------------------------------------------------- waste_canyon
async function waveTwo(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.music('battle');
  scatterWildlife(s);
  await alliesEngage(s, 8, 12, 14, 11);
  await s.say('krillin', 'Gohan, they\'re coming out of the rocks! We\'ll hold the west side!', 'shout');
  s.letterbox(false);
  await wave(s, 'c05w2', [
    ['c05_grunt', 14, 12], ['c05_grunt', 20, 12], ['c05_raider', 17, 13], ['c05_brute', 23, 12],
    ['c05_raider', 15, 14], ['c05_officer', 12, 15], ['soldier', 18, 12],
  ]);
  s.set('c05_wave2');
  // Krillin's senzu: Gohan goes into the Shisami fight (no save point in the canyon) at full strength.
  s.letterbox(true);
  await s.talk([
    ['krillin', 'Gohan, catch! A senzu - Yajirobe only had a few left, so don\'t waste it. Something nasty is waiting up north.', 'happy'],
    ['gohan', '*crunch* ...Thanks, Krillin. I feel like new.', 'happy'],
  ]);
  s.heal();
  s.toast('HP and EP fully restored!');
  removeIf(s, ...WAVE_ALLIES.map(([id]) => id));
  s.letterbox(false);
  await s.say('gohan', 'That\'s the last of them here. The path north leads up to the mesa...', 'neutral');
  s.music('field');
}

async function shisamiAndTagoma(s: ScriptApi): Promise<void> {
  force(s, 'gohan');
  s.letterbox(true);
  s.music('tense');
  s.place('hero', 22, 4, 'right');
  respawn(s, 'c05_shisamiA', 'shisami', 28, 4, 'left');
  await s.talk([
    ['shisami', 'So you\'re the one carving through our ranks. I am Shisami, elite of the Frieza Force. My blade-hand is faster than your eyes.', 'smirk'],
    ['gohan', 'Then I\'ll just have to keep up.', 'neutral'],
  ]);
  s.remove('c05_shisamiA');
  s.letterbox(false);
  s.music('battle');
  const r = await s.fight('c05_shisami', { x: 28, y: 4, uid: 'c05_shisami1' });
  if (r === 'win' || r === 'end') s.exp(5000);
  s.letterbox(true);
  await s.say('shisami', 'Impossible... a mere Earthling...', 'hurt');
  // Tagoma's blast tears straight through Shisami.
  respawn(s, 'c05_tagomaA', 'tagoma', 31, 1, 'down');
  await s.walk('c05_tagomaA', 31, 3, 1);
  await s.say('tagoma', 'Out of the way, Shisami.', 'smirk');
  if (s.exists('c05_shisami1')) await s.blast('c05_tagomaA', 'c05_shisami1', '#f0a040');
  s.flash('#ffffff', 14);
  s.boom(28, 4, 18, '#f0a040');
  removeIf(s, 'c05_shisami1');
  await s.talk([
    ['gohan', 'He shot right through his own ally!', 'shock'],
    ['tagoma', 'Shisami was weak. I am not. Come, Earthling - show me what made Lord Frieza so nervous.', 'smirk'],
  ]);
  s.remove('c05_tagomaA');
  s.letterbox(false);
  await s.fight('c05_tagoma', { x: 30, y: 4, uid: 'c05_tagoma1', survive: 25, loseOk: true, label: 'HOLD ON' });
  s.letterbox(true);
  s.remove('c05_tagoma1');
  respawn(s, 'c05_tagomaA', 'tagoma', 27, 4, 'left');
  s.pose('hero', 'ko');
  s.shake(20, 2);
  await s.talk([
    ['tagoma', 'Hm. Disappointing. Not a scratch on me.', 'smirk'],
    ['gohan', 'Ugh... my hits aren\'t... doing anything...', 'hurt'],
  ]);
  // Piccolo steps in.
  respawn(s, 'c05_piccoloA', 'piccolo', 14, 3, 'right');
  await s.walk('c05_piccoloA', 23, 4, 2.4);
  await s.talk([
    ['piccolo', 'That\'s enough. Gohan, rest. I\'ll take it from here.', 'neutral'],
    ['tagoma', 'Another one? Fine. Lord Frieza\'s landing site is on the mesa - follow me if you want to die in front of him.', 'smirk'],
  ]);
  await s.flyTo('c05_tagomaA', 31, -1, 3);
  s.remove('c05_tagomaA');
  s.pose('hero', null);
  // Perspective switch: Piccolo is now the player; Gohan stays behind to recover.
  const hx = 22;
  respawn(s, 'c05_gohanRest', 'gohan', hx, 5, 'up');
  s.pose('c05_gohanRest', 'ko');
  s.remove('c05_piccoloA');
  force(s, 'piccolo');
  s.place('hero', 23, 4, 'up');
  s.set('c05_shisamiDone');
  await s.done('c05_army');
  await s.quest('c05_mesa');
  await s.talk([
    ['krillin', '(running up) Gohan! Here, eat this. Krillin\'s emergency senzu stash. Rest a minute before you go back in.', 'shock'],
    ['piccolo', 'Gohan. When you\'re ready, come find me. Not before.', 'neutral'],
  ]);
  s.heal();
  await s.narrate('Piccolo now leads. His Special Beam Cannon (B) pierces every foe in its path.');
  await s.say('piccolo', 'Time to stop holding back.', 'neutral');
  await s.setForm('piccolo', 'unweighted');
  s.letterbox(false);
  await s.narrate('Follow Tagoma north to the Great Mesa.');
  s.music('field');
}

// ---------------------------------------------------------------- waste_mesa
async function waveThree(s: ScriptApi): Promise<void> {
  force(s, 'piccolo');
  s.letterbox(true);
  s.music('battle');
  scatterWildlife(s);
  addProp(s, 'spaceship', 26, 5.5, 'c05_flagship');
  await s.pan(24, 18, 30);
  await s.talk([
    ['piccolo', 'So this is where they set up camp. Frieza\'s flagship...', 'neutral'],
    ['frizaElite', 'The green one! Lord Frieza wants him alive. Mostly alive!', 'shout'],
  ]);
  s.follow();
  s.letterbox(false);
  await wave(s, 'c05w3', [
    ['c05_grunt', 16, 22], ['c05_officer', 20, 20], ['c05_brute', 24, 19], ['c05_raider', 28, 21],
    ['c05_officer', 32, 20], ['c05_grunt', 22, 23], ['c05_raider', 26, 23], ['soldierB', 18, 19],
  ]);
  s.set('c05_wave3');
  respawn(s, 'c05_tagomaNpc', 'tagoma', 24, 13, 'down');
  await s.say('piccolo', 'Tagoma is waiting by the flagship. Time to end this.', 'neutral');
  s.music('tense');
}

async function ginyuScene(s: ScriptApi): Promise<void> {
  force(s, 'piccolo');
  s.letterbox(true);
  s.music('tense');
  s.place('hero', 24, 17, 'up');
  respawn(s, 'c05_tagomaNpc', 'tagoma', 24, 13, 'down');
  await s.talk([
    ['tagoma', 'You made it. Good. I wanted Lord Frieza to watch this.', 'smirk'],
    ['piccolo', 'Talk less.', 'angry'],
  ]);
  // The frog.
  respawn(s, 'c05_frogA', 'c05_frog', 20, 14, 'right');
  await s.walk('c05_frogA', 22, 14, 0.6);
  await s.narrate('A small frog hopped up beside Tagoma and began scratching letters into the dirt with one toe...');
  await s.talk([
    ['tagoma', 'What is this? A frog... writing? "C... H... A... N... G..."', 'neutral'],
    ['tagoma', '"CHANGE"?', 'shock'],
  ]);
  await s.blast('c05_frogA', 'c05_tagomaNpc', '#f8e040');
  s.flash('#f8f8a0', 20);
  s.shake(20, 2);
  s.pose('c05_tagomaNpc', 'raise');
  await s.talk([
    ['ginyu', '(in Tagoma\'s body) Hahahaha! FINALLY! A body worthy of the great Captain Ginyu!', 'happy'],
    ['piccolo', 'Ginyu?! The body-swapping freak from Namek!', 'shock'],
    ['ginyu', 'Do not call me a freak! Behold - the Ginyu Force... SPECIAL POSE!', 'shout'],
  ]);
  s.pose('c05_tagomaNpc', 'guard');
  await s.wait(20);
  s.pose('c05_tagomaNpc', 'raise');
  await s.wait(20);
  await s.walk('c05_frogA', 18, 14, 1.2);
  removeIf(s, 'c05_frogA');
  await s.say('piccolo', '...Somewhere, a frog is very confused right now.', 'smirk');
  removeIf(s, 'c05_tagomaNpc');
  s.letterbox(false);
  s.music('battle');
  const r = await s.fight('c05_ginyuTagoma', { x: 24, y: 13, uid: 'c05_ginyu1' });
  if (r !== 'end' && r !== 'win') return;
  s.exp(9000);
  s.set('c05_ginyuDone');
  await gohanReturns(s);
}

async function gohanReturns(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  if (!s.exists('c05_ginyu1')) respawn(s, 'c05_ginyu1', 'tagoma', 24, 13, 'down');
  await s.say('ginyu', 'Grr... this body is magnificent, but YOU are annoying! Time for my ultimate-', 'angry');
  respawn(s, 'c05_gohanB', 'gohan', 17, 21, 'up');
  s.sprite('c05_gohanB', 'gohanSSJ');
  s.aura('c05_gohanB', '#f8e048');
  await s.walk('c05_gohanB', 21, 15, 3);
  await s.talk([
    ['gohan', 'Mr. Piccolo, step back. I remember now - how this feels.', 'shout'],
    ['ginyu', 'A Super Saiyan?! W-wait, I was only posing-', 'shock'],
  ]);
  await s.blast('c05_gohanB', 'c05_ginyu1', '#f8f070');
  s.boom(24, 13, 24, '#f8f070');
  s.flash('#ffffff', 12);
  s.pose('c05_ginyu1', 'ko');
  await s.wait(30);
  removeIf(s, 'c05_ginyu1');
  // Frieza descends.
  s.stopMusic();
  s.shake(30, 1);
  respawn(s, 'c05_frieza', 'frieza', 24, 5, 'down');
  respawn(s, 'c05_sorbet', 'sorbet', 27, 6, 'down');
  await s.walk('c05_frieza', 24, 10, 0.8);
  s.music('frieza');
  await s.talk([
    ['frieza', 'Well, well. Ginyu, you never change. Losing, I mean.', 'smirk'],
    ['frieza', 'And you must be Gohan. The little boy from Namek. My, how you\'ve grown. A Super Saiyan, even.', 'smirk'],
    ['gohan', 'Frieza. You\'re not going to hurt anyone on this planet.', 'angry'],
    ['frieza', 'Ohoho. Let\'s see how long you keep that face.', 'smirk'],
  ]);
  // Gohan takes over for the scripted Frieza fight.
  s.remove('c05_gohanB');
  respawn(s, 'c05_piccoloB', 'piccolo', 20, 16, 'up');
  force(s, 'gohan');
  s.place('hero', 22, 15, 'up');
  await s.setForm('gohan', 'ssj');
  s.transformNow('ssj');
  s.remove('c05_frieza');
  s.letterbox(false);
  await s.fight('c05_frieza', { x: 24, y: 10, uid: 'c05_frieza1', survive: 30, loseOk: true, label: 'SURVIVE' });
  await finale(s);
}

async function finale(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.remove('c05_frieza1');
  respawn(s, 'c05_frieza', 'frieza', 24, 10, 'down');
  s.transformNow(null);
  s.pose('hero', 'ko');
  await s.talk([
    ['frieza', 'Is that all? You let yourself go, Gohan. What a waste of a Saiyan.', 'smirk'],
    ['frieza', 'Let\'s end this. One little beam, right through the heart.', 'neutral'],
  ]);
  s.pose('c05_frieza', 'blast');
  await s.walk('c05_piccoloB', 22, 13.8, 4);
  await s.blast('c05_frieza', 'c05_piccoloB', '#f070f0');
  s.flash('#f070f0', 16);
  s.shake(20, 3);
  s.pose('c05_piccoloB', 'ko');
  s.pose('c05_frieza', null);
  await s.talk([
    ['gohan', 'MR. PICCOLO!', 'shout'],
    ['piccolo', 'Heh... couldn\'t let you... get hit... Gohan...', 'hurt'],
    ['frieza', 'How touching. The Namekian protects his pet monkey. Again.', 'smirk'],
  ]);
  s.pose('hero', null);
  await s.powerUp('hero', '#f8e048', 70);
  await s.say('gohan', 'Frieza... I\'ll never forgive you!', 'shout');
  s.flash('#ffffff', 24);
  s.music('heroic');
  respawn(s, 'c05_goku', 'gokuWhis', 26, 15, 'up');
  respawn(s, 'c05_vegeta', 'vegeta', 27, 15.6, 'up');
  respawn(s, 'c05_whis', 'whis', 29, 16, 'up');
  respawn(s, 'c05_beerus', 'beerus', 30, 16.4, 'up');
  await s.talk([
    ['goku', 'Sorry we\'re late, Gohan! Whis didn\'t check his phone until he finished his dessert.', 'neutral'],
    ['whis', 'It was a very good dessert.', 'happy'],
    ['vegeta', 'Frieza. You picked the wrong planet to come back to.', 'smirk'],
    ['frieza', 'Son Goku. And Vegeta. Perfect. I didn\'t come all this way just to play with children.', 'smirk'],
    ['goku', 'Gohan, get Piccolo out of here. Frieza is ours.', 'angry'],
  ]);
  s.exp(6000);
  s.set('c05_done');
  await s.done('c05_mesa', false);
  unforce(s);
  s.heal();
  s.letterbox(false);
  if (s.hasScript('c06_start')) await s.call('c06_start');
}

// ---------------------------------------------------------------- overlays
registerOverlay('waste_entry', {
  triggers: [{ id: 'c05_wave1T', x: 16, y: 3, w: 2, h: 24, script: 'c05_wave1', showIf: 'c05_assembled&!c05_wave1&chapter==5' }],
  onEnter: 'c05_entry_enter',
});

registerOverlay('waste_canyon', {
  triggers: [
    { id: 'c05_wave2T', x: 10, y: 10, w: 1, h: 8, script: 'c05_wave2', showIf: 'c05_wave1&!c05_wave2&chapter==5' },
    { id: 'c05_shisamiT', x: 22, y: 2, w: 1, h: 5, script: 'c05_shisami', showIf: 'c05_wave2&!c05_shisamiDone&chapter==5' },
  ],
});

registerOverlay('waste_mesa', {
  npcs: [{ id: 'c05_tagomaNpc', sprite: 'tagoma', x: 24, y: 13, dir: 'down', talk: 'c05_ginyu', name: 'Tagoma', showIf: 'c05_wave3&!c05_ginyuDone&chapter==5' }],
  props: [{ kind: 'spaceship', x: 26, y: 5.5, flag: 'quest:c05_mesa' }],
  triggers: [
    { id: 'c05_wave3T', x: 2, y: 27, w: 42, h: 1, script: 'c05_wave3', showIf: 'quest:c05_mesa&!c05_wave3' },
    { id: 'c05_tagomaT', x: 20, y: 15, w: 9, h: 2, script: 'c05_ginyu', showIf: 'c05_wave3&!c05_ginyuDone&chapter==5' },
  ],
  onEnter: 'c05_mesa_enter',
});

registerScripts({
  /** Chapter 5 entry point (called at the end of chapter 4). */
  c05_start: async (s) => {
    ensureChapterState(s, 5);
    s.setChapter(5);
    await s.chapter(5, 'Resurrection \'F\'', 'Gohan holds the line');
    await s.warp('cc_yard', 21, 12, 'down');
    await opening(s);
  },
  c05_entry_enter: async (s) => {
    if (!s.check('chapter==5&quest:c05_army') || s.flag('c05_assembled')) return;
    force(s, 'gohan');
    await assemble(s);
  },
  // Every trigger-started beat is `exclusive`: re-entering its trigger while its fight runs is a no-op.
  c05_wave1: exclusive('c05_wave1', async (s) => {
    if (!s.check('c05_assembled&!c05_wave1')) { await s.narrate('Scorch marks and scattered armour. The fighting has moved on.'); return; }
    await waveOne(s);
  }),
  c05_wave2: exclusive('c05_wave2', async (s) => {
    if (!s.check('c05_wave1&!c05_wave2')) { await s.narrate('The canyon is quiet.'); return; }
    await waveTwo(s);
  }),
  c05_shisami: exclusive('c05_shisami', async (s) => {
    if (!s.check('c05_wave2&!c05_shisamiDone')) { await s.narrate('The northern path climbs toward the Great Mesa.'); return; }
    await shisamiAndTagoma(s);
  }),
  c05_mesa_enter: async (s) => {
    if (!s.check('chapter==5&quest:c05_mesa') || s.flag('c05_mesaSeen')) return;
    s.set('c05_mesaSeen');
    await s.say('piccolo', 'The ships are on the mesa. And Frieza\'s ki... it\'s like ice down my spine. Save while you can.', 'neutral');
  },
  c05_wave3: exclusive('c05_wave3', async (s) => {
    if (!s.check('quest:c05_mesa&!c05_wave3')) { await s.narrate('Smoke drifts across the mesa.'); return; }
    await waveThree(s);
  }),
  /** Tagoma's trigger band and his NPC talk both start the Ginyu beat (one copy at a time). */
  c05_ginyu: exclusive('c05_ginyu', async (s) => {
    if (!s.check('c05_wave3&!c05_ginyuDone')) { await s.narrate('Only craters remain where the battle raged.'); return; }
    await ginyuScene(s);
  }),
  c05_shisami_p2: async (s) => {
    await s.say('shisami', 'You\'re not bad for a scholar. Let me get serious!', 'smirk');
  },
  c05_ginyu_pose: async (s) => {
    await s.say('ginyu', 'Ginyu Force... RECOOME... no wait, that\'s someone else\'s pose. GINYU FORCE!', 'shout');
  },
});
