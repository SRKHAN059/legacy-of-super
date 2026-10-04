import { registerScripts, type ScriptApi } from '../../../game/script';
import { ensureChapterState, force, unforce } from '../common';
import { removeIf, respawn, stage } from './shared';

/**
 * Chapter 4 - "Student of the Angel" (Vegeta, then Goku; L15-18). Main beats:
 *   c04_start (cc_yard): Whis is being wined and dined by Bulma; Vegeta wants a teacher.
 *   cc_inside kitchen: Bulma's secret stash (instant ramen) -> Whis agrees -> Whis's Training Field.
 *   Training: 3 water jars (carry), 3 boulders, the spoon thief -> land one hit on Whis (c04_whis, ends at 98.5%).
 *   Goku hitches a ride -> Goku vs Vegeta spar (c04_vegetaSpar, ends at 50%) -> Hell / Frieza revival -> c05_start.
 */

/** True once all three chores on the training field are done. */
function choresDone(s: ScriptApi): boolean {
  return s.flag('c04_jarsDone') && boulders(s) >= 3 && (s.has('c04_spoon') || s.flag('c04_spoonReturned'));
}

/** Training boulders smashed so far. */
function boulders(s: ScriptApi): number {
  return ['c04_rock1', 'c04_rock2', 'c04_rock3'].filter((id) => s.flag(`broke:c04_whis_field:${id}`)).length;
}

/** Opening: Bulma treats Whis to tempura on the lawn; Vegeta wants in. */
async function opening(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  s.music('peaceful');
  stage(s, 'c04_whis', 'whis', 23, 17, 'down');
  stage(s, 'c04_bulma', 'bulma', 21, 18, 'right');
  s.place('hero', 29, 22, 'left');
  await s.pan(24, 18, 30);
  await s.narrate('Some weeks after Lord Beerus\'s visit, Capsule Corporation had a regular dinner guest.');
  await s.talk([
    ['whis', 'Tempura! Crispy batter, tender shrimp... Bulma, your planet is a treasure.', 'happy'],
    ['bulma', 'Glad you like it! Next week I\'ll take you to this sushi bar downtown. Keeping Lord Beerus\'s teacher happy is the best insurance policy in the universe.', 'happy'],
  ]);
  await s.emote('hero', '!');
  await s.say('vegeta', '(His... teacher? That ridiculous angel trains the God of Destruction?!)', 'shock');
  await s.walk('hero', 25, 19, 1.2);
  s.face('c04_whis', 'hero');
  await s.talk([
    ['vegeta', 'Whis. Is it true that you trained Beerus?', 'neutral'],
    ['whis', 'Ohoho. I am Lord Beerus\'s attendant, and yes, his martial arts teacher. Why do you ask?', 'happy'],
    ['vegeta', 'Train me. I will not stay a step behind Kakarot - or behind a god.', 'angry'],
    ['whis', 'Hmm. I\'m terribly busy. Eating, mostly. What would I get out of it?', 'smirk'],
    ['vegeta', 'Food! I\'ll take you to the finest restaurant in West City!', 'shout'],
    ['whis', 'Bulma has already taken me to all of them, I\'m afraid. Unless you know of something truly... new?', 'neutral'],
  ]);
  s.face('c04_bulma', 'hero');
  await s.talk([
    ['bulma', 'And don\'t you DARE go raiding my secret stash in the kitchen, Vegeta. That\'s my emergency supply!', 'angry'],
    ['vegeta', '...Her secret stash. In the kitchen.', 'smirk'],
  ]);
  s.follow();
  s.letterbox(false);
  await s.quest('c04_whis');
  s.music('town');
}

/** Ramen scene: Whis falls for instant ramen and takes Vegeta to Beerus's planet. */
async function ramenScene(s: ScriptApi): Promise<void> {
  s.take('c04_ramen');
  s.letterbox(true);
  await s.talk([
    ['vegeta', 'Here. "Instant ramen." Add hot water, wait three minutes. Even an angel can manage that.', 'smirk'],
    ['whis', 'Three minutes? How mysterious.', 'neutral'],
  ]);
  await s.narrate('Three very long minutes later...');
  await s.talk([
    ['whis', '...', 'neutral'],
    ['whis', 'The noodles! The broth! How can something so cheap be so DIVINE?!', 'happy'],
    ['bulma', 'VEGETAAA! That was my last one!', 'angry'],
    ['whis', 'Very well, Vegeta. A deal is a deal. Hold on to my back - and bring more of these next time.', 'happy'],
  ]);
  s.flash('#80c0f8', 16);
  s.sfx('dash');
  await s.done('c04_whis');
  s.unlockRegion('spot_beerus');
  s.unlockRegion('spot_space_earth');
  s.set('c04_fieldIntro');
  await s.warp('c04_whis_field', 6, 5, 'down');
  s.letterbox(true);
  respawn(s, 'c04_introWhis', 'whis', 8, 5, 'left');
  await s.talk([
    ['whis', 'Welcome to Lord Beerus\'s planet. The gravity here is about fifty times Earth\'s. Do try to keep up.', 'happy'],
    ['vegeta', 'Fifty times? Ha. I train in more than that. Show me your techniques.', 'smirk'],
    ['whis', 'First, chores. Fill a jar at the pond and carry it to the basin by the plaza - three times. Without spilling a drop.', 'neutral'],
    ['whis', 'Then smash the three training boulders. And a puffbird has run off with Lord Beerus\'s dessert spoon. Do get it back.', 'neutral'],
    ['vegeta', 'CHORES?! I am the Prince of all Saiyans!', 'angry'],
    ['whis', 'Chores are training, Vegeta. Your body must move without wasted effort. Come and see me at the ring when you\'re done.', 'smirk'],
  ]);
  s.remove('c04_introWhis');
  await s.quest('c04_training');
  await s.narrate('Beerus\'s Planet is now on the space map. Whis can fly you between Earth and space - find him at Capsule Corp or by the palace.');
  await s.quest('c04_delicacies', true);
  await s.narrate('Whis will also reward you for Earth Delicacies (25 are hidden around the world and beyond). Show him your collection any time.');
  s.letterbox(false);
}

/** The "land one hit" fight against Whis on the training ring. Returns true when the hit landed. */
async function whisFight(s: ScriptApi): Promise<boolean> {
  s.letterbox(true);
  // The field Whis NPC steps into the ring himself (hide the idle copy while he fights).
  if (s.exists('c04_fieldWhis')) s.show('c04_fieldWhis', false);
  s.place('hero', 28, 16, 'right');
  respawn(s, 'c04_ringWhis', 'whis', 32, 16, 'left');
  await s.talk([
    ['whis', 'Chores complete! Now then: land a single clean hit on me. Ki won\'t do much - I\'ll simply bat it away.', 'happy'],
    ['vegeta', 'One hit? I\'ll land a hundred!', 'smirk'],
    ['whis', 'Watch for the moment my guard drops. And do stop clenching so much.', 'neutral'],
  ]);
  s.letterbox(false);
  s.remove('c04_ringWhis');
  s.music('battle');
  for (let tries = 0; tries < 20; tries++) {
    const r = await s.fight('c04_whis', { x: 32, y: 16, uid: 'c04_whis1', loseOk: true });
    if (r === 'end' || r === 'win') {
      s.remove('c04_whis1');
      return true;
    }
    s.remove('c04_whis1');
    s.heal();
    await s.say('whis', 'Oh my, are you alright? Shake it off. Again!', 'smirk');
  }
  return false;
}

/** After the hit: Goku arrives as a stowaway, gets Whis's gi, and spars Vegeta. */
async function gokuArrives(s: ScriptApi): Promise<void> {
  s.letterbox(true);
  if (s.exists('c04_fieldWhis')) s.show('c04_fieldWhis', false);
  respawn(s, 'c04_ringWhis', 'whis', 31, 16, 'left');
  await s.talk([
    ['whis', '...Oh! You actually touched me. Well done, Vegeta. Your body moved before your pride did.', 'happy'],
    ['vegeta', 'Hmph. Naturally.', 'smirk'],
  ]);
  s.exp(4000);
  s.set('c04_whisHit');
  await s.done('c04_training');
  await s.fadeOut(20);
  // Meanwhile on Earth (ep 17): Pan is born first; only then does Goku learn about Vegeta's teacher and stow away.
  await s.narrate('Months went by. Back on Earth, Videl gave birth to a healthy baby girl. She and Gohan named her Pan.');
  await s.talk([
    ['mrSatan', 'Pan, sweetie, watch Grandpa Satan defeat the evil Great Saiyaman! HYAAAH!', 'happy'],
    ['gohan', '(as the Great Saiyaman) Justice never loses! ...Look, Videl, she\'s laughing!', 'happy'],
    ['chichi', 'Fighting?! In front of the BABY?! Into that room, both of you. And don\'t come out until you\'ve thought about it!', 'angry'],
    ['goku', 'Wait... Vegeta\'s been training with Whis this whole time?! Bulma, lend me your phone! I gotta catch that angel before he leaves!', 'shock'],
  ]);
  await s.narrate('That evening, Whis finished another food run on Earth and set off for home... with a stowaway clinging to his back.');
  respawn(s, 'c04_goku', 'goku', 30, 17, 'left');
  await s.fadeIn(20);
  await s.talk([
    ['goku', 'Hiya, Vegeta! Bulma lent me her phone to call Whis, so I just grabbed on when he left!', 'happy'],
    ['vegeta', 'KAKAROT! This is MY training!', 'angry'],
    ['goku', 'Chi-Chi would\'ve made me farm all month. C\'mon, there\'s plenty of angel to go around!', 'happy'],
    ['whis', 'Two students, double the ramen. Goku, put this on - training clothes, with my mark on them.', 'happy'],
  ]);
  s.flash('#ffffff', 10);
  s.sprite('c04_goku', 'gokuWhis');
  s.outfit('goku', 'gokuWhis');
  await s.talk([
    ['goku', 'Whoa, it\'s so light! Thanks, Whis!', 'happy'],
    ['whis', 'Now, why don\'t you two spar? Show me what each of you has learned. Goku, you first.', 'neutral'],
  ]);
  // Swap perspective: Goku is now the player, Vegeta steps into the ring as the opponent.
  s.remove('c04_goku');
  force(s, 'goku');
  s.place('hero', 29, 16, 'right');
  respawn(s, 'c04_sparVegeta', 'vegeta', 32, 16, 'left');
  await s.quest('c04_spar');
  await s.talk([
    ['vegeta', 'Don\'t think I\'ll go easy on you just because you showed up late.', 'smirk'],
    ['goku', 'Wouldn\'t have it any other way!', 'happy'],
  ]);
  s.remove('c04_sparVegeta');
  s.remove('c04_ringWhis');
  s.letterbox(false);
  s.music('battle');
  await s.fight('c04_vegetaSpar', { x: 32, y: 16, uid: 'c04_vegeta1', loseOk: true });
  s.remove('c04_vegeta1');
  s.letterbox(true);
  respawn(s, 'c04_sparVegeta', 'vegeta', 32, 16, 'left');
  respawn(s, 'c04_ringWhis', 'whis', 30.5, 13.5, 'down');
  s.pose('c04_sparVegeta', 'hurt');
  s.pose('hero', 'hurt');
  await s.talk([
    ['whis', 'That\'s enough! Honestly, the two of you leak ki like a pair of broken kettles.', 'smirk'],
    ['whis', 'Power is not the point. When your body moves on its own, without thought, then we will talk about real strength.', 'neutral'],
    ['goku', 'Moving without thinking... that sounds kinda like me already!', 'happy'],
    ['vegeta', 'For once, Kakarot, that is not a compliment.', 'angry'],
  ]);
  s.pose('c04_sparVegeta', null);
  s.pose('hero', null);
  s.exp(7000);
  s.set('c04_sparDone');
  await s.done('c04_spar');
  s.heal();
  removeIf(s, 'c04_sparVegeta', 'c04_ringWhis');
  s.letterbox(false);
  unforce(s);
  await s.call('c04_hell');
}

registerScripts({
  /** Chapter 4 entry point (called at the end of chapter 3). */
  c04_start: async (s) => {
    ensureChapterState(s, 4);
    s.setChapter(4);
    force(s, 'vegeta');
    await s.chapter(4, 'Student of the Angel', 'Vegeta seeks a teacher');
    await s.warp('cc_yard', 29, 22, 'left');
    await opening(s);
  },
  /** Vegeta serves Whis the instant ramen (from Whis's talk script at Capsule Corp). */
  c04_ramen_scene: async (s) => {
    if (!s.has('c04_ramen')) return;
    await ramenScene(s);
  },
  /** Bulma's secret stash in the Capsule Corp kitchen. */
  c04_stash: async (s) => {
    if (!s.check('quest:c04_whis') || s.has('c04_ramen')) {
      await s.narrate('A cupboard full of fancy plates. Behind them, a hidden drawer - empty.');
      return;
    }
    await s.narrate('A cupboard full of fancy plates. Behind them, a hidden drawer labelled "EMERGENCY - FOR GODS ONLY".');
    await s.give('c04_ramen');
    await s.say('vegeta', 'Instant ramen? THIS is her secret weapon? ...It will have to do.', 'smirk');
  },
  /** First visit to the training field (normal travel; the story warp sets c04_fieldIntro itself). */
  c04_field_enter: async (s) => {
    if (!s.check('chapter==4') || s.flag('c04_fieldIntro')) return;
    s.set('c04_fieldIntro');
    await s.quest('c04_training');
  },
  /** Fill a jar at the pond (LoG2 egg escort). */
  c04_jar_fill: async (s) => {
    if (!s.check('quest:c04_training') || s.flag('c04_jarsDone')) {
      await s.narrate('The pond water is crystal clear. A school of tiny glowing fish darts away.');
      return;
    }
    if (s.carrying) { await s.narrate('You are already carrying a full jar. Take it to the basin by the plaza!'); return; }
    await s.narrate(`You fill a heavy clay jar with water (${s.num('c04_jars') + 1}/3). You can't attack while carrying it - and if anything hits you, it breaks!`);
    s.carry('water jar', 'c04_jar_broke');
  },
  /** Deliver a jar at the basin. */
  c04_jar_deliver: async (s) => {
    if (!s.carrying) return;
    s.drop();
    s.sfx('item');
    const n = s.inc('c04_jars');
    if (n >= 3) {
      s.set('c04_jarsDone');
      await s.narrate('Three jars delivered - the basin is full!');
      await s.say('whis', '(from across the field) Lovely! Not a drop spilled. Your footwork is improving already.', 'happy');
    } else {
      s.toast(`Water jars: ${n}/3`);
    }
  },
  c04_jar_broke: async (s) => {
    await s.say('whis', '(from across the field) Oh dear, a little more grace, please. Fetch another one!', 'smirk');
  },
  /** The puffbird drops Beerus's spoon when caught. */
  c04_critter_caught: async (s) => {
    if (s.has('c04_spoon') || s.flag('c04_spoonReturned')) return;
    await s.narrate('The puffbird squawks and drops something shiny before fluttering away.');
    await s.give('c04_spoon');
  },
  /** Whis on the training field: progress checks, the hit challenge, and the delicacy tally. */
  c04_fieldWhis_talk: async (s) => {
    if (!s.check('chapter==4') || s.flag('c04_sparDone')) {
      await s.call('c04_delicacy_menu');
      return;
    }
    if (s.flag('c04_whisHit')) { await gokuArrives(s); return; }
    if (!s.check('quest:c04_training')) await s.quest('c04_training');
    if (choresDone(s)) {
      if (s.has('c04_spoon')) {
        s.take('c04_spoon');
        s.set('c04_spoonReturned');
        await s.say('whis', 'Lord Beerus\'s spoon! He would have destroyed a galaxy over this. Thank you.', 'happy');
      }
      const c = await s.ask('whis', 'Your chores are done. Ready to try landing a hit on me?', ['Let\'s go!', 'Not yet']);
      if (c !== 0) return;
      if (await whisFight(s)) await gokuArrives(s);
      return;
    }
    const left: string[] = [];
    if (!s.flag('c04_jarsDone')) left.push(`water jars ${s.num('c04_jars')}/3`);
    if (boulders(s) < 3) left.push(`boulders ${boulders(s)}/3`);
    if (!s.has('c04_spoon') && !s.flag('c04_spoonReturned')) left.push('the spoon from the puffbird');
    await s.say('whis', `Still to do: ${left.join(', ')}. Chores are training, Vegeta!`, 'smirk');
  },
  /** Spar phase 2: Vegeta goes Super Saiyan. */
  c04_spar_p2: async (s) => {
    if (s.exists('c04_vegeta1')) s.sprite('c04_vegeta1', 'vegetaSSJ');
    await s.say('vegeta', 'Enough warming up, Kakarot!', 'shout');
  },
});
